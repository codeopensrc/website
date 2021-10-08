"use strict";

const CONSUL_HOST = process.env.CONSUL_HOST || "172.17.0.1";

const consul = require('consul')({host: CONSUL_HOST});
const serverState = require("./serverState.js");
const auth = require("./auth.js");
const mongoose = require('mongoose')
const ObjectID = mongoose.Types.ObjectId

const CONSUL_RETRY_INTERVAL = 1000 * 2
const DB_RETRY_INTERVAL = 1000 * 2

const KEY = process.env.BLOG_KEY || "dev";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "blog";
const DEV_DB_URL = process.env.DEV_DATABASE_URL || "";

let connectionAttempts = 0

module.exports = {

    db: null,
    client: null,

    mongoinit: function () {

        let mongoOpts = {}

        // If we're not providing a URL look for address in consul
        if(!DEV_DB_URL) {
            consul.catalog.service.nodes("mongo", (err, res) => {
                if (err) { console.log("ERR - db.js", err); }
                let host = res && res[0] ? res[0].Address : ""
                let port = res && res[0] ? res[0].ServicePort : ""
                let connectionString = `mongodb://${host}:${port}/${MONGO_DB_NAME}`
                if(!host) {
                    console.log("No Mongo Host found for DB.js");
                    setTimeout(this.mongoinit.bind(this), CONSUL_RETRY_INTERVAL * ++connectionAttempts);
                    return console.log(`Search consul cluster again in ${CONSUL_RETRY_INTERVAL * connectionAttempts}ms`);
                }
                this.mongoConnect(connectionString, mongoOpts)
            })
        }
        else {
            this.mongoConnect(DEV_DB_URL, mongoOpts)
        }
    },

    mongoConnect: function(connectionString, mongoOpts) {
        mongoose.connect(connectionString,/* mongoOpts,*/ (err) => {
            if(err) {
                setTimeout(this.mongoinit.bind(this), DB_RETRY_INTERVAL * ++connectionAttempts);
                console.log("mongoConnect: MongoErr", err);
                return console.log(`Attempting Mongo connection for 30 seconds again in ${DB_RETRY_INTERVAL * connectionAttempts}ms`);
            }
            connectionAttempts = 0;
            this.db = mongoose.connection;
            this.attachListeners()
            serverState.changeServerState("mongo", true)
            serverState.startIfAllReady()
        })
    },

    attachListeners: function() {
        this.db.on("disconnected", (e) => {
            serverState.changeServerState("mongo", false)
            console.log("MongoClose")
        })
        this.db.on("error", (e) => {
            serverState.changeServerState("mongo", false)
            console.log("MongoErr")
        })
        this.db.on("reconnect", (e) => {
            serverState.changeServerState("mongo", true)
        })
        serverState.registerSigHandler(this.db, "mongo", false)
    },

    resWithErr: function(err, res) {
        console.error(err);
        res.writeHead(200, {'Access-Control-Allow-Origin' : '*'} );
        res.end(JSON.stringify({status: "Error"}));
    },

    resWithNoAccess: function (res) {
        res.writeHead(200, {'Access-Control-Allow-Origin' : '*'} );
        res.end(JSON.stringify({authorized: false}));
    },

    checkAccess: function (headers, accessReq, callback) {
        auth.checkAccess({headers, app: "website", accessReq: accessReq})
        .then(({ status, hasPermissions }) => {
            if(!status) {
                console.log("User has incorrect authentication credentials");
                return callback({status: false})
            }
            if(!hasPermissions) {
                console.log("User does not have required access for action");
                return callback({status: false})
            }
            callback({status: true})
        })
        .catch((e) => { console.log("ERR - MONGO.CHECKACCESS:", e); callback({status: "error", err: e}) })
    },

    createPostUrl: function(title, date) {
        let year = new Date(date).getFullYear();
        let month = new Date(date).getMonth()+1;
        let addZero = (input) => { return input < 10 ? "0"+input : input }
        let spacesReplaced = title.toLowerCase().replace(/ /g, "-");
        let punctuationRemoved = spacesReplaced.replace(/[()\[\]$#<>;:.!,?]/g, "");
        let urlWithDate = "/posts/"+year+"/"+addZero(month)+"/"+punctuationRemoved
        return urlWithDate;
    },

    retrieve: function (type, headers, res) {
        let db = this.db
        if(!db) { return this.resWithErr("No DB Connection", res) }
        let collection = db.collection(type);

        collection.find({}).toArray((err, docs) => {
            if(err) { return this.resWithErr(err, res) }
            res.setHeader("Content-Type", "application/json")
            res.writeHead(200, {'Access-Control-Allow-Origin' : '*'} );
            res.end(JSON.stringify(docs));
        });
    },

    retrieveOne: function (query, type, headers, res) {
        let db = this.db
        if(!db) { return this.resWithErr("No DB Connection", res) }
        let collection = db.collection(type);

        collection.findOne(query, (err, doc) => {
            if(err) { return this.resWithErr(err, res) }
            res.setHeader("Content-Type", "application/json")
            res.writeHead(200, {'Access-Control-Allow-Origin' : '*'} );
            res.end(JSON.stringify(doc));
        });
    },

    submit: function (doc, type, headers, res) {
        this.checkAccess(headers, "admin", ({status, err}) => {
            if(doc.storageKey !== KEY || !status) { return this.resWithNoAccess(res); }
            if(status === "error") { return this.resWithErr(err, res); }
            let db = this.db
            if(!db) { return this.resWithErr("No DB Connection", res) }
            let collection = db.collection(type);
            // Until we remove storagekey and update the client
            doc = doc.post ? doc.post : doc;
            let id = doc.id ? ObjectID(doc.id) : ObjectID()
            // let id = doc._id ? ObjectID(doc._id) : ObjectID()
            type === "posts" && (doc.url = this.createPostUrl(doc.title, doc.date))
            delete doc.id

            collection.updateOne({"_id": id}, {$set: doc}, {upsert: true}, (err, docs) => {
                if(err) { return this.resWithErr(err, res) }
                doc._id = id
                res.setHeader("Content-Type", "application/json")
                res.writeHead(200, {'Access-Control-Allow-Origin' : '*'} );
                res.end(JSON.stringify(doc));
            });
        })
    },

    remove: function(doc, type, headers, res) {
        this.checkAccess(headers, "admin", ({status, err}) => {
            if(doc.storageKey !== KEY || !status) { return this.resWithNoAccess(res); }
            if(status === "error") { return this.resWithErr(err, res); }
            let db = this.db
            if(!db) { return this.resWithErr("No DB Connection", res) }
            let collection = db.collection(type);
            // let id = doc._id ? ObjectID(doc._id) : "";
            let id = doc.id ? ObjectID(doc.id) : "";

            collection.findOneAndDelete({"_id": id}, (err, docs) => {
                if(err) { return this.resWithErr(err, res) }
                res.setHeader("Content-Type", "text/html")
                res.writeHead(200, {'Access-Control-Allow-Origin' : '*'} );
                res.end("");
            });
        })
    },
}
