'use strict';

const url = require("url");
const fs = require("fs");
const https = require("https");
const { service } = require("os-npm-util");
const mongojs = require("./mongo.js");
const mongoose = require('mongoose')
const ObjectID = mongoose.Types.ObjectId
const auth = require("./auth.js");

const KEY = process.env.BLOG_KEY || "dev";
const STATIC_FILES = process.env.STATIC_FILES || "./server/static";
const TOKEN_API_SELF_READ = process.env.TOKEN_API_SELF_READ || "";
const GITLAB_API_URL = process.env.GITLAB_API_URL || "";

let gameList = [];
generateGameList((list) => gameList = list)

mongojs.mongoinit();


const routes = function (req, res) {

    const respond = (response) => {
        response = response || "";
        typeof(response) == "object" && res.setHeader("Content-Type", "application/json");
        res.writeHead(200, {'Access-Control-Allow-Origin' : '*'} );
        "err" === response && res.end("err") // TODO: We should really send a more explicit msg in future
        "err" !== response && res.end(JSON.stringify(response));
    }

    //Convert post data to string
    let input = '';
    req.on('data', (buffer) => { input += buffer.toString(); })

    req.on('end', () => {
        let parsed = input ? JSON.parse(input) : "";
        let headers = req.headers;

        let path = req.url.split("/")
        let fileName = path[path.length-1]

        switch(req.url) {
            // TODO: Review ping/pong
            case "/api/get/ping": respond("pong");
            break;
            case "/api/get/menu": auth.getMenu(headers, respond) //username / key
            break;
            case "/api/get/username": getUser(headers, "user", respond) //username / key
            break;
            case "/api/post/logout": sendLogout(headers, respond) //username / key
            break;
            case "/api/get/gamelist": respond({status: true, body: gameList})
            break;
            case `/api/get/md/${fileName}`: sendMarkdown(headers, fileName, respond);
            break;
            case `/api/get/mddir`: sendMarkdownDir(headers, respond);
            break;

            case `/api/get/build_badge`: sendBadgeJson(headers, "build", respond);
            break;
            case `/api/get/version_badge`: sendBadgeJson(headers, "version", respond);
            break;
            case `/api/get/docker_badge`: sendBadgeJson(headers, "docker", respond);
            break;

            case "/ajaxGet": mongojs.retrieve("posts", headers, res)
            break;
            case "/ajaxGetTodo": mongojs.retrieve("todo_list", headers, res)
            break;
            case "/ajaxGetSingle": mongojs.retrieveOne({_id: ObjectID(parsed.id)}, "posts", headers, res)
            break;
            case "/ajaxGetFullPost": mongojs.retrieveOne({url: parsed.url}, "posts", headers, res)
            break;

            case "/ajaxRemoveTodoItem": mongojs.remove(parsed, "todo_list", headers, res)
            break;
            case "/ajaxDelete": mongojs.remove(parsed, "posts", headers, res)
            break;

            case "/ajaxEdit": mongojs.submit(parsed, "posts", headers, res)
            break;
            case "/ajaxNew": mongojs.submit(parsed, "posts", headers, res)
            break;
            case "/ajaxSubmitTodoItem": mongojs.submit(parsed, "todo_list", headers, res)
            break;

            case "/ajaxAuth": respond({storageKey:parsed.storageKey===KEY?"accepted":"denied"})
            break;



            default: respond();
        }
    })

}

function sendBadgeJson(headers, badgeType, respond) {
    if(!TOKEN_API_SELF_READ) { return respond() }
    if(!GITLAB_API_URL) { return respond() }
    let badgetypes = {
        build: {
            label: "Build",
            apiReq: `${GITLAB_API_URL}/projects/161/pipelines?ref=master&scope=finished&private_token=${TOKEN_API_SELF_READ}`,
            color: "brightgreen",
        },
        version: {
            label: "Version",
            apiReq: `${GITLAB_API_URL}/projects/161/repository/tags?private_token=${TOKEN_API_SELF_READ}`,
            color: "blue",
        },
        docker: {
            label: "Docker",
            apiReq: `${GITLAB_API_URL}/projects/161/registry/repositories/11/tags/latest?private_token=${TOKEN_API_SELF_READ}`,
            color: "blue",
        }
    }

    let jsonres = {
        schemaVersion: 1,
        label: badgetypes[badgeType].label,
        color: badgetypes[badgeType].color,
        message: "",
    }

    let apireq = badgetypes[badgeType].apiReq
    https.get(apireq, (res) => {
        let str = ""
        res.on("data", (d) => {
            str += d.toString()
        })
        res.on("end", () => {
            let json = JSON.parse(str)
            if(badgeType === "build") {
                json[0].status !== "success" ? jsonres.color = "red" : ""
                jsonres.message = json[0].status
            }
            if(badgeType === "version") {
                jsonres.message = json[0].name
            }
            if(badgeType === "docker") {
                let date = new Date(json.created_at)
                let datestr = `${date.getMonth()+1}-${date.getDate()}-${date.getFullYear()}`
                jsonres.message = datestr
            }

            respond(jsonres)
        })
    })
}

function sendMarkdown(headers, fileName, respond) {
    let filePath = STATIC_FILES+`/md/${fileName}.md`.replace(/%20/g, " ")
    fs.readFile(filePath, (err, fileData) => {
        if(err) {
            return respond({status: false, data: ""});
        }
        respond({status: true, data: fileData})
    })
}


function sendMarkdownDir(headers, respond) {
    let markdownDir = `${STATIC_FILES}/md`
    fs.readdir(markdownDir, (err, markdownfiles) => {
        if(err) {
            console.log("Err reading markdownDir");
            return respond({status: false, data: []});
        }

        //TODO: Detect dirs and create multi-dimensional array
        let filteredList = markdownfiles.filter((file) => file.match(/\.md$/) && !file.match(/^Home/))
        let modifiedList = filteredList.map((file) => file.replace(/\.md$/, ""))
        modifiedList.unshift("Home");
        respond({status: true, body: modifiedList});
    })
}

// TODO: Maybe start caching credentials for a minute at a time to prevent
// multiple consecutive and frequent calls
function checkAccess(headers, app, accessReq, callback) {
    auth.checkAccess({headers, app, accessReq})
    .then(({ status, hasPermissions }) => {
        if(!status) {
            console.log("checkAccess: User has incorrect authentication credentials");
            return callback({status: false, data: "Incorrect credentials"})
        }
        if(!hasPermissions) {
            console.log("checkAccess: User does not have required access for action");
            return callback({status: false, data: "Insufficient priveleges"})
        }
        callback({status: true})
    })
    .catch((e) => {
        console.log("ERR - ROUTES.CHECKACCESS:\n", e);
        callback({status: "error", data: e})
    })
}

function sendLogout(headers, respond) {
    auth.logout({headers, app: "website"})
    .then(({ status }) => {
        if(!status) {
            console.log("sendLogout: User has incorrect authentication credentials");
            return respond({status: false, data: "Incorrect credentials"})
        }
        respond({status: true, data: "Success"})
    })
    .catch((e) => {
        console.log("ERR - ROUTES.LOGOUT:\n", e);
        respond({status: "error", data: e})
    })
}

function getUser(headers, accessReq, respond) {
    checkAccess(headers, "website", accessReq, ({status, data}) => {
        if(status) {
            let email = headers["auth-email"]
            respond({status: true, data: email})
        }
        else {
            respond({status: false, data})
        }
    })
}

function generateGameList(cb) {
    let list = []
    let unityDir = `${process.cwd()}/server/static/unity`
    fs.readdir(unityDir, (err, projectdirs) => {
        if(err) { console.log("No projectdirs"); return list; }
        let dirsLeft = projectdirs.length;
        projectdirs.forEach((dir, i) => {
            let projectname = ""
            let index = fs.createReadStream(`${unityDir}/${dir}/index.html`, "utf8")
            index.on("data", (chunk) => {
                // Parse name in <div id="unity-build-title"></div>
                let str = chunk.toString()
                if(str.match(/unity-build-title/)) {
                    projectname = str.match(/unity-build-title">(.+)</)[1]
                }
            })
            index.on("end", () => {
                list.push({ folder: dir, projectname: projectname })
                if(--dirsLeft <= 0) { cb(list) }
            })
        })
    })
}


module.exports = routes;
