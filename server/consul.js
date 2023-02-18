"use strict";

const os = require("os");
const http = require("http");

const consulBridgeIP = "172.17.0.1"
const consulAPIPort = 8500;
const CONSUL_HOST = process.env.CONSUL_HOST || consulBridgeIP
const CONSUL_PORT = process.env.CONSUL_PORT || consulAPIPort
const CONSUL_CHECK_UUID = process.env.POD_NAME || os.hostname();
const CONSUL_SERVICE_NAME = process.env.CONSUL_SERVICE_NAME || "react"
const IMAGE_TAG = process.env.IMAGE_TAG || "dev"

module.exports = {
    registerCheck: function() {
        let short_id = CONSUL_CHECK_UUID.substr(-5)
        let check = {
            definition: "check",
            path: `/v1/agent/check/register`,
            metadata: {
                "ID": CONSUL_CHECK_UUID,
                "Name": `${CONSUL_SERVICE_NAME}_v${IMAGE_TAG}_${short_id}`,
                "Notes": `${CONSUL_SERVICE_NAME} does a curl internally every 10 seconds`,
                "TTL": "30s",
                "Service_ID": CONSUL_SERVICE_NAME
            }
        }
        console.log(`Registering check ${CONSUL_CHECK_UUID} for ${CONSUL_SERVICE_NAME}`);
        this.sendConsulReq(check, () => this.sendHealthCheck())
    },

    deregisterCheck: function(respond) {
        let checkToDegister = {
            definition: "deregister",
            path: `/v1/agent/check/deregister/${CONSUL_CHECK_UUID}`,
            metadata: {}
        }
        console.log(`Deregistering ${CONSUL_CHECK_UUID}`);
        this.sendConsulReq(checkToDegister, respond)
    },

    sendHealthCheck: function(status = "fail") {
        let TTL = {
            definition: "passOrFail",
            path: `/v1/agent/check/${status}/${CONSUL_CHECK_UUID}`,
            metadata: {}
        }
        this.sendConsulReq(TTL)
    },

    getServiceNodes: function (service, respond) {
        let serviceRequest = {
            definition: "serviceRequest",
            path: `/v1/catalog/service/${service}`,
            metadata: {},
            method: "GET"
        }
        this.sendConsulReq(serviceRequest, respond)
    },

    sendConsulReq: function({metadata, definition, path, method = "PUT"}, respond) {
        let opts = {
            method: method,
            port: CONSUL_PORT,
            path: path,
            hostname: CONSUL_HOST
        }
        let response = "";
        let req = http.request(opts, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => { response += chunk.toString(); });
            res.on('error', (e) => {
                console.log("res ERR - consul.SENDCONSULREQ:", e);
                respond && respond(e)
            });
            res.on('end', () => {
                definition === "check" && console.log(`Registered check for ${CONSUL_SERVICE_NAME}!`);
                definition === "deregister" && console.log(`Deregistered ${CONSUL_SERVICE_NAME}!`);
                definition === "serviceRequest" && console.log(`Got res from ${path}!`);
                respond && respond(null, response)
            });
        })
        req.on("error", (e) => {
            console.log("req ERR - consul.SENDCONSULREQ:", e)
            respond && respond(e)
        })
        req.end(JSON.stringify(metadata))
    },
}
