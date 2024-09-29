"use strict";

const url = require("url")
const { auth } = require("os-npm-util/server");

const AUTH_URL = process.env.AUTH_URL || ""
const AUTH_PROTO = AUTH_URL ? url.parse(AUTH_URL).protocol : ""
const AUTH_PORT = AUTH_PROTO === "https:" ? "443" : "80"
const AUTH_DOMAIN = AUTH_URL && AUTH_URL.match(/([\w]+)\.[\w]+$/)
    ? AUTH_URL.match(/([\w]+)\.[\w]+$/)[0]
    : ""

auth.URL = AUTH_URL ? `${AUTH_PROTO}//auth.${AUTH_DOMAIN}:${AUTH_PORT}` : "";
auth.USE_AUTH = AUTH_URL !== "";

const APP_TO_CHECK = "website"

// TODO: Maybe start caching credentials for a minute at a time to prevent
// multiple consecutive and frequent calls
auth.getAccess = function(headers, accessReq, callback) {
    if(!auth.USE_AUTH) {
        return callback({status: true})
    }

    auth.checkAccess({headers, app: APP_TO_CHECK, accessReq: accessReq})
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
        console.log("ERR - AUTH.GETACCESS:\n", e);
        callback({status: "error", data: e})
    })
}

auth.sendLogout = function (headers, respond) {
    if(!auth.USE_AUTH) {
        return respond({status: true, data: "Success"})
    }

    auth.logout({headers, app: APP_TO_CHECK})
    .then(({ status }) => {
        if(!status) {
            console.log("sendLogout: User has incorrect authentication credentials");
            return respond({status: false, data: "Incorrect credentials"})
        }
        respond({status: true, data: "Success"})
    })
    .catch((e) => {
        console.log("ERR - AUTH.LOGOUT:\n", e);
        respond({status: "error", data: e})
    })
}

auth.getUser = function (headers, respond) {
    if(!auth.USE_AUTH) {
        return respond({status: true, data: "devuser"})
    }

    auth.getAccess(headers, "user", ({status, data}) => {
        if(status) {
            let email = headers["auth-email"]
            respond({status: true, data: email})
        }
        else {
            respond({status: false, data})
        }
    })
}

auth.resWithNoAccess = function (res) {
    res.writeHead(403, {'Access-Control-Allow-Origin' : '*'} );
    res.end(JSON.stringify({authorized: false}));
}


module.exports = auth
