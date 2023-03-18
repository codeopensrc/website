"use strict";

const PM2_TZ = process.env.PM2_TZ || "UTC"

module.exports = {
    apps: [{
        "name": "App",
        "cwd": "./",
        "watch": ["server"],
        "watch_options": {
            "usePolling": true,
            "interval": 300,
            "binaryInterval": 300
        },
        "script": "./server/server.js",
        "out_file": "./logs/server-out.log",
        "error_file": "./logs/server-err.log",
        "log_date_format": "MM-D-YY, h:mm:ss a Z",
        "min_uptime": 10000,
        "max_restarts": 3,
        // We'll still use output until we configure a way to create files and send
        //   them back regardless of docker container
        "ignore_watch": ["server/bin", "server/output", "server/static", "server/.*"],
        "exec_mode": "cluster",
        "instances": 1,
        "kill_timeout" : 8000,
        "wait_ready": true,
        "env": {
            "TZ": `${PM2_TZ}`
        }
  }]
}
