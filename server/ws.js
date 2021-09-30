'use strict';

const WebSocketServer = require('ws').Server;

const { auth } = require("os-npm-util");

const serverState = require("./serverState.js");
// GENERAL NOTES:
// Connections are stored in this.wss.clients
// ws.upgradeReq.url === CLIENT "ROOM"

// Setup
let connectedPeers = [];

// More aggressive at start for testing purposes
const KEEP_ALIVE_INTERVAL = 1000 * 90 //90 seconds
const TTL = 3 // 3 sets of pings and no pong, you dead

module.exports = {

    init: function(opts) {
        let serverInit = typeof(opts) === "number"
            ? { port: opts }
            : { server: opts }
        this.wss = new WebSocketServer(serverInit);
        this.attachListeners();
        this.attachMethods();
        setInterval(this.startKeepAliveChecks.bind(this), KEEP_ALIVE_INTERVAL)
        console.log("WSS running");
    },

    startKeepAliveChecks: function () {
        this.wss.clients.forEach((client) => {
            let clientId = client.upgradeReq.headers['sec-websocket-key'];
            this.canSend(client) && client.send(JSON.stringify({type: "ping"}))
            let peerInd = connectedPeers.findIndex((masterPeer) => masterPeer.wsId === clientId)
            let peer = connectedPeers[peerInd];
            ++peer.pings && peer.pings > TTL && connectedPeers.splice(peerInd, 1)
        })
    },

    stilAlive: function (chatroom, evt, ws) {
        let wsId = ws.upgradeReq.headers['sec-websocket-key'];
        let peerInd = connectedPeers.findIndex((masterPeer) => masterPeer.wsId === wsId)
        connectedPeers[peerInd] && (connectedPeers[peerInd].pings = 0);
        // Inflates logs -- Good for testing
        // console.log(wsId+" sent pong");
    },

    attachMethods: function() {
        this.wss.broadcast = (data) => {
            this.wss.clients.forEach((client) => {
                if(client.readyState === WebSocket.OPEN) {
                    this.canSendInfo(client, (canSend) => {
                         canSend && client.send(data);
                    })
                }
            });
        };
    },

    attachListeners: function() {
        this.wss.on("listening", () => {
            serverState.changeServerState("ws", true)
            serverState.startIfAllReady()
        })
        this.wss.on("error", () => { serverState.changeServerState("ws", false) })
        this.wss.on("connection", (ws, req) => {
            ws.upgradeReq = req
            let wsId = ws.upgradeReq.headers['sec-websocket-key'];
            ws.send(JSON.stringify({type: "id", msg: wsId}))
            console.log("Client Connected");

            ws.on('message', (evt) => {
                evt = JSON.parse(evt);
                let chatroom = ws.upgradeReq.url
                evt.type === "pong" && this.stilAlive(chatroom, evt, ws);
                evt.type === "auth" && this.addHeaders(chatroom, evt, ws);
                evt.type === "nameCheck" && this.checkRTCName(chatroom, evt, ws);
                evt.type === "master" && this.getUsers(chatroom, evt, ws);
                if(evt.type === "offer" || evt.type === "answer" || evt.type === "candidate") {
                    this.sendRTC(chatroom, evt, ws);
                }
            })
            ws.on("close", (evt) => {
                let peerInd = connectedPeers.findIndex((masterPeer) => masterPeer.wsId === wsId)
                peerInd > -1 && connectedPeers.splice(peerInd, 1);
                console.log("Client closed. Clients in room after close evt: ", connectedPeers.length);
            })
        });
        // TODO: Create a default "close" or "kill" command to all clients to have
        //   them close the connection and allow us to gracefully shutdown the ws server
        serverState.registerSigHandler(this.wss, "ws", false)
    },

    // Add credentials to ws client
    addHeaders: function (chatroom, evt, ws) { ws.headers = evt.headers },

    canSendInfo: function (ws, callback) {
        this.checkAccess(ws.headers, "user", ({status}) => {
            let canSend = status && ws.readyState === 1
            callback(canSend)
        })
    },

    // Be sure to check chatroom when it's implemented
    checkRTCName: function (chatroom, evt, ws) {
        let nameToCheck = evt.name;
        let wsId = ws.upgradeReq.headers['sec-websocket-key'];
        let nameIsOk = !connectedPeers.some((masterPeer) => masterPeer.name === nameToCheck && masterPeer.room === chatroom);
        this.canSend(ws) && ws.send(JSON.stringify({
            type: "nameCheck", nameOk: nameIsOk, name: evt.name
        }))
    },

    getUniquePeers: function (chatroom, evt, ws) {
        let wsId = ws.upgradeReq.headers['sec-websocket-key'];
        let isUnique = !connectedPeers.some((masterPeer) => masterPeer.wsId === wsId && masterPeer.room === chatroom)
        isUnique && connectedPeers.push({wsId: wsId, pings: 0, name: evt.name, room: chatroom});

        let sendToPeers = connectedPeers.filter((masterPeer) => masterPeer.wsId !== wsId && masterPeer.room === chatroom)
        return sendToPeers
    },

    getUsers: function(chatroom, evt, ws) {
        let sendToPeers = this.getUniquePeers(chatroom, evt, ws)
        console.log("Total clients in room: ", connectedPeers.length);
        this.canSend(ws) && ws.send(JSON.stringify({type: "master", msg: sendToPeers}))
    },

    sendRTC: function(chatroom, evt, ws) {
        this.wss.clients.forEach((client) => {
            let clientId = client.upgradeReq.headers['sec-websocket-key'];
            clientId === evt.sendToId && this.canSend(client) && client.send(JSON.stringify(evt));
            return clientId === evt.sendToId;
        })
    },

    canSend: function (ws) { return ws.readyState === 1 },

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
        .catch((e) => { console.log("ERR - WS.CHECKACCESS:\n", e); callback({status: false}) })
    },

}
