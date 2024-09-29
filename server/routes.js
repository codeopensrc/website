'use strict';

const url = require("url");
const fs = require("fs");
const https = require("https");
const db = require("./mongo.js");
//const mongoose = require('mongoose')
//const ObjectID = mongoose.Types.ObjectId
//const auth = require("./auth.js");

// Toggle initializing DB
const enableDB = process.env.ENABLE_DB == "true"
db.init(enableDB)

const KEY = process.env.BLOG_KEY || "dev";
const STATIC_FILES = process.env.STATIC_FILES || "./server/static";
const GITLAB_API_URL = process.env.GITLAB_API_URL || "";

let gameList = [];
generateGameList((list) => gameList = list)

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

        let requrl = url.parse(req.url).pathname
        let headers = req.headers;

        let path = req.url.split("/")
        let fileName = path[path.length-1]

        switch(requrl) {
            // TODO: Review ping/pong
            case "/api/get/ping": respond("pong");
            break;
            //case "/api/get/menu": auth.getMenu(headers, respond) //username / key
            //break;
            //case "/api/get/username": auth.getUser(headers, respond) //username / key
            //break;
            //case "/api/post/logout": auth.sendLogout(headers, respond) //username / key
            //break;
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

            //case "/ajaxGet": db.retrieve("posts", headers, res)
            //break;
            //case "/ajaxGetTodo": db.retrieve("todo_list", res)
            //break;
            //case "/ajaxGetSingle": db.retrieveOne({_id: ObjectID(parsed.id)}, "posts", headers, res)
            //break;
            //case "/ajaxGetFullPost": db.retrieveOne({url: parsed.url}, "posts", res)
            //break;

            //case "/ajaxRemoveTodoItem": db.remove(parsed, "todo_list", headers, res)
            //break;
            //case "/ajaxDelete": db.remove(parsed, "posts", headers, res)
            //break;

            //case "/ajaxEdit": db.submit(parsed, "posts", headers, res)
            //break;
            //case "/ajaxNew": db.submit(parsed, "posts", headers, res)
            //break;
            //case "/ajaxSubmitTodoItem": db.submit(parsed, "todo_list", headers, res)
            //break;

            //case "/ajaxAuth": respond({storageKey:parsed.storageKey===KEY?"accepted":"denied"})
            //break;



            default: respond();
        }
    })
}

function sendBadgeJson(headers, badgeType, respond) {
    if(!GITLAB_API_URL) { return respond() }
    let badgetypes = {
        build: {
            label: "Build",
            apiReq: `${GITLAB_API_URL}/projects/161/pipelines?ref=master&scope=finished`,
            color: "brightgreen",
        },
        version: {
            label: "Version",
            apiReq: `${GITLAB_API_URL}/projects/161/repository/tags`,
            color: "blue",
        },
        docker: {
            label: "Docker",
            apiReq: `${GITLAB_API_URL}/projects/161/registry/repositories/11/tags/latest`,
            color: "blue",
        }
    }

    let jsonToSend = {
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
            let parsedJson = JSON.parse(str)

            if(parsedJson.length == 0) {
                jsonToSend.message = "unavailable"
                return respond(jsonToSend)
            }
            if(badgeType === "build") {
                parsedJson[0].status !== "success" ? jsonToSend.color = "red" : ""
                jsonToSend.message = parsedJson[0].status
            }
            if(badgeType === "version") {
                jsonToSend.message = parsedJson[0].name
            }
            if(badgeType === "docker") {
                let date = new Date(parsedJson.created_at)
                let datestr = `${date.getMonth()+1}-${date.getDate()}-${date.getFullYear()}`
                jsonToSend.message = datestr
            }

            respond(jsonToSend)
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
