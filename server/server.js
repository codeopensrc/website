"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const url = require("url");
const path = require("path");
const qs = require('querystring');
const zlib = require("zlib")
const crypto = require("crypto")
const { service } = require("os-npm-util");
const routes = require("./routes.js");
const serverState = require("./serverState.js");
const ws = require("./ws.js");

const BIN = process.env.BIN || "./server/bin";
const PUB_FILES = process.env.PUB_FILES || "./pub";
const STATIC_FILES = process.env.STATIC_FILES || "./server/static";
const OUTPUT_FILES = process.env.OUTPUT_FILES || "./server/output";
const DEV_ENV = process.env.DEV_ENV === "true"
const REGISTER_SERVICE = process.env.REGISTER_SERVICE === "true";
const CONSUL_SERVICE_NAME = process.env.CONSUL_SERVICE_NAME || "website"
const CONSUL_HOST = process.env.CONSUL_HOST || "172.17.0.1"
const SERVE_FROM_PUB_DIR = ["404.html", "favicon.ico", "app.bundle.js", "index.html", "assets"]

service.setConfig({
    register: REGISTER_SERVICE,
    devEvn: DEV_ENV,
    serviceName: CONSUL_SERVICE_NAME,
    consulHost: CONSUL_HOST
})

serverState.registerConnection("http")
serverState.registerConnection("ws")




const server = {
    startServer: function() {
        console.log("======= Starting server =======");
        let options = {};
        let keyExists = fs.existsSync("/run/secrets/privkey")

        if(keyExists) {
            options = {
                key: fs.readFileSync("/run/secrets/privkey", "utf8"),
                cert: fs.readFileSync("/run/secrets/fullchain", "utf8"),
                ca: fs.readFileSync("/run/secrets/chain", "utf8")
            }
        }

        let server = keyExists && options.key !== ""
            ? https.createServer(options, this.serverListener.bind(this))
            : http.createServer(this.serverListener.bind(this))

        // Not sure how having this before server.listen affects it, just noting it here
        ws.init(server)
        serverState.registerSigHandler(server, "http", REGISTER_SERVICE)
        if(REGISTER_SERVICE) { service.register(DEV_ENV); }

        let serverType = keyExists && options.key !== "" ? "https" : "http"
        let serverPort = serverType === "https" ? 443 : 80;

        server.listen(serverPort, () => {
            console.log(`${serverType} server running on port ${serverPort}`)
            serverState.changeServerState("http", true)
            serverState.startIfAllReady()
        });
    },

    serverListener: function (req, res) {

        let isDockerHealthCheck = req.headers.host === "localhost" && req.url === "/healthcheck"

        if(req.url.match('/api/') || req.url.match(/ajax/)) { routes(req, res); }
        else if (isDockerHealthCheck) {
            serverState.handleHealthCheck(res)
        }
        else {
            let extname = path.extname(url.parse(req.url).pathname);
            let file = (url.parse(req.url).pathname).slice(1, this.length);
            let exts = {
                ".unityweb": { mime: "application/octet-stream", encoding: null },
                ".datagz": { mime: "text/javascript", encoding: "utf8" },
                ".memgz": { mime: "text/javascript", encoding: "utf8" },
                ".jsgz": { mime: "text/javascript", encoding: "utf8" },
                ".json": { mime: "application/json", encoding: "utf8" },
                ".js": { mime: "text/javascript", encoding: "utf8" },
                ".gz": { mime: "application/gzip", encoding: null },
                ".ico": { mime: "image/x-icon", encoding: null },
                ".png": { mime: "image/png", encoding: null },
                ".jpg": { mime: "image/jpeg", encoding: null },
                ".jpeg": { mime: "image/jpeg", encoding: null },
                ".svg": { mime: "image/svg+xml", encoding: null },
                ".css": { mime: "text/css", encoding: "utf8" },
                ".html": { mime: "text/html", encoding: "utf8" },
                ".xls": { mime: "application/vnd.ms-excel", encoding: "utf8" },
                ".xlsx": { mime: "application/vnd.ms-excel", encoding: "utf8" },
                ".xlsm": { mime: "application/vnd.ms-excel", encoding: "utf8" },
                ".pdf": { mime: "application/pdf", encoding: "utf8" },
                ".sh": { mime: "text/plain", encoding: "utf8" }
            }
            let filePath = exts[extname] ? STATIC_FILES+"/"+file : PUB_FILES+"/"+"index.html";
            let contentType = exts[extname] ? exts[extname].mime : 'text/html';
            let encoding = exts[extname] ? exts[extname].encoding : "utf8";

            if(file.indexOf("wasm.gz") > 1 || file.indexOf("wasm.unityweb") > 1) { contentType = "application/wasm" }
            if(file.indexOf("js.gz") > 1 || file.indexOf("js.unityweb") > 1) { contentType = "text/javascript" }
            if(file.indexOf("data.gz") > 1 || file.indexOf("data.unityweb") > 1) { contentType = "text/javascript" }
            SERVE_FROM_PUB_DIR.forEach((pubFile) => file.match(pubFile) && (filePath = PUB_FILES+"/"+file) )

            let readable = fs.createReadStream(filePath, {encoding: encoding})

            readable.on("error", () => {
                res.writeHead(404, {"Content-Type": 'text/html'});
                fs.createReadStream(`${PUB_FILES}/404.html`).pipe(res)
            })

            readable.on("open", () => {
                let isIndex = filePath.match(`${PUB_FILES}/index.html`)

                if(extname.indexOf("gz") > -1 || extname.indexOf("unityweb") > -1) { res.setHeader("Content-Encoding", "gzip"); }

                // TODO: We need to implement authentication for downloading files.
                if(req.url.indexOf("/download/") > -1 && !isIndex) {
                    res.setHeader('Content-Disposition', 'attachment; filename='+path.basename(STATIC_FILES+"/"+file));
                    filePath = STATIC_FILES+"/"+file.replace("download/", "");
                }

                let lastMod = fs.statSync(filePath).mtime.toString()
                let lastModHash = crypto.createHash('sha1').update(lastMod).digest('hex');
                let ifNoneMatchValue = req.headers['if-none-match']

                res.setHeader('Content-Type', contentType)
                res.setHeader('Cache-Control', 'max-age='+ (60 * 60 * 24 * 30))
                res.setHeader('Vary', 'ETag, Content-Encoding')
                res.setHeader('ETag', lastModHash)

                if(ifNoneMatchValue && ifNoneMatchValue === lastModHash) {
                    res.writeHead(304)
                    return res.end()
                }

                res.writeHead(200);

                contentType == "application/gzip" && readable.pipe(zlib.createGunzip()).pipe(res)
                contentType != "application/gzip" && !isIndex && readable.pipe(res)
                isIndex && readable.on("end", () => res.end())
                isIndex && readable.on("data", (chunk) => {
                    res.write(chunk.toString().replace(/%%VERSION%%/, service.IMAGE_VER))
                })
            })
        }
    }
}

module.exports = server;

if(!module.parent) {
    module.exports.startServer();
}
