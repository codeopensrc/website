"use strict";

// TODO: Add proper connecting/unconnecting checks    Eh there's some
// TODO: Add support for FF/iPad(Bowser)      Soon enough

// Maybe make masterPeer.name a string
// Break remotePeer into several strings instead of object

module.exports = MasterPeer;

// TODO: Crete a public API for use while keeping other methods internal
// TODO: Enscapulate these into a single object to prevent namespace collision
// TODO: Review peer.renegotiating checks, not checked thoroughly

// TODO: All important task - Scale out peer connections per 8 users
//  ie, first 8 would be broadcasters to any "broadcastedTo" peer forming a bridge.
//   That "broadcastedTo" peer broadcasts to 8 other users that are that "sub-rooms"
//     broadcasters and the initiating broadcaster.
//  We would then have to "fake" peer connections to implicate we are directly connected
//    however, those peers are merely being bridged to through another peer
//  This raises the problem of one of the bridged peers leaving/disconnecting, a
//    handoff to another peer in that room would need to take place.
//  Because of this, maybe its best for 8 peers and only 5 broadcasters, that way
//   there "should" always be a peer open to be a broadcaster.
//
// If this were to work, the peer connections could scale out exponentially, with
//   only a slight delay with the peer-to-peer relays, and each user is only connected
//   to 8 other peers, hardly a resource hog.
// Only those users videos in the room would most likely be able to be shown, have
//   not tested how many video feeds a user can have on-screen.
// We would ideally be able to scale/tone down the video stream to micro video streams
//   once many were connected, but thats beyond my scope of knowledge.

// My math says 8 users each broadcasting to a user that is also broadcasting to 8 other users
//    8*8=64 for the first level, 64*8=512 for the 2nd level, then 512*8=4096 for the 3rd level... 4000 peers.
//    And thats only 3 relays   (8)  -  1(64)  -  2(512)  -  3(4096)   - 4(32768)
//    At that point, its time to get a real server and start a service.

/*                                * b
        L1                      /   \      L2
       * b                bTo  * ___ * b
     /   \    Initial        /
    * ___ * ___ * b         * b        * b
    b    bTo  /   \       /   \      /   \
             * ___ * ___ * ___ * ___* ___ *
            / b     b   bTo    b     bTo   b
      bTo  *                L1        L2
         /   \
      b * ___ * b
           L1
*/

let peerList = {};
let establishedMasterPeers = [];
let deletingMasterPeer = false;

let callbacks = {
    open: {},
    close: {},
    stream: {}
};

let offersReceived = [];
let offersInTransit = [];
let numOfGeneratedPeers = 0;

let ws;
let wrtc = {
    RTCPeer: {},
    RTCIceCandidate: {},
    RTCSessionDescription: {}
};

const MAX_RETRIES = 3;
const ONE_SECOND = 1000;
const CHECK_SERVER_IN_SECONDS = ONE_SECOND * 30;
const PEER_OFFER_TIMEOUT = ONE_SECOND * 30;
const CHECK_FOR_NEW_PEERS_IN = ONE_SECOND * 150;
const DATA_CHANNEL_TTL_CHECK = ONE_SECOND * 120;
const MASTER_PEER_CLEANUP_INTERVAL = ONE_SECOND * 60;

// TODO: These variables should not be permanent, mainly for testing
const CHECK_FOR_NEW_PEERS = true;

try {
    //navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || 
        //navigator.mediaDevices.getUserMedia;
    if(navigator.mediaDevices.getUserMedia && typeof(navigator.mediaDevices.getUserMedia) == "function") {
        console.log("Has user media")
    }
}
catch(e) {
    console.log("Could not find user media");
    // WebSocket = require("ws");
    // WebSocket = require("websocket").w3cwebsocket;
}

// Multiple Peers Constructer
function MasterPeer(opts){
    this.opts = opts || {}

    wrtc = this.opts && this.opts.wrtc
        ? this.opts.wrtc
        : wrtc;
    wrtc.RTCPeer = this.opts && this.opts.wrtc
        ? this.opts.wrtc.RTCPeerConnection
        : window.RTCPeerConnection || window.webkitRTCPeerConnection;
    wrtc.RTCIceCandidate = this.opts && this.opts.wrtc
        ? this.opts.wrtc.RTCIceCandidate
        : RTCIceCandidate;
    wrtc.RTCSessionDescription = this.opts && this.opts.wrtc
        ? this.opts.wrtc.RTCSessionDescription
        : RTCSessionDescription;

    this.opts.wsUrl = this.opts && this.opts.wsUrl
        ? this.opts.wsUrl
        : "ws://localhost:8888"; // We'll have this be the "default" if not config'd
    this.opts.mainWsRoom = this.opts && this.opts.mainWsRoom
        ? this.opts.mainWsRoom
        : "chat";

    this.opts.room = this.opts && this.opts.userRoom
        ? `${this.opts.wsUrl}/${this.opts.mainWsRoom}/${this.opts.userRoom}`
        : `${this.opts.wsUrl}/${this.opts.mainWsRoom}/lobby`
    this.opts.masterPeer = this.opts && this.opts.autoName
        ? { name: `Guest ${(Math.random() * 10000).toFixed(0)}` }
        : { name: this.opts.userName};
    this.opts.ice = this.opts && this.opts.ice
        ? { "iceServers": this.opts.ice }
        : { "iceServers": [ {"urls": `stun:www.stunprotocol.org`} ] };
    this.opts.remoteVideos = this.opts && this.opts.remoteVideos
        ? this.opts.remoteVideos
        : "";
    this.name = this.opts.masterPeer.name;
    this.room = this.opts.userRoom ? this.opts.userRoom : "lobby";

    this.ws = null;
    this.wsId = null;

    this.stream = null;
    this.URLstream = null;
    this.localVideoDiv = null;

    this.keepAliveCheck = null;
    this.newPeersCheck = null;
    this.retries = 0;

    this.establishSignal();
    this.cleanupInterval = setInterval(this.cleanup.bind(this), MASTER_PEER_CLEANUP_INTERVAL);
}

// ======================= Init ===============
// ======================= Init ===============

MasterPeer.prototype.establishSignal = function () {
    ws = new WebSocket(this.opts.room);
    ws.onopen = this.handleWsOpen.bind(this);
    ws.onmessage = this.handleWsMessage.bind(this);
    ws.onclose = this.handleWsClose.bind(this);
    ws.onerror = this.handleWsError.bind(this);
}
MasterPeer.prototype.getUserName = function (destroy) {
    destroy && callbacks["name"]["invalidname"].forEach((cb) => { cb() } )
    destroy && this.destroy();
    !destroy && ws.send(JSON.stringify({type: "nameCheck", name: this.opts.masterPeer.name}));
}
MasterPeer.prototype.handleUserName = function (parsed) {
    if(parsed.nameOk === true) { this.getUsers(); }
    if(parsed.nameOk === false) { this.getUserName(true); }
}
MasterPeer.prototype.getUsers = function () {
    ws.send(JSON.stringify({type: "master", name: this.opts.masterPeer.name }));
    if(CHECK_FOR_NEW_PEERS) {
        this.newPeersCheck = setInterval(() => {
            ws.send(JSON.stringify({type: "master", name: this.opts.masterPeer.name }));
        }, CHECK_FOR_NEW_PEERS_IN)
    }
}

// ======================= Utility ===============
// ======================= Utility ===============

MasterPeer.prototype.handlePing = function() {
    ws.send(JSON.stringify({type: "pong"}));
}
MasterPeer.prototype.checkIfServerAlive = function () {
    this.keepAliveCheck = null;
    if(this.retries >= MAX_RETRIES) { console.log("Server appears to be down"); }
    if(this.retries < MAX_RETRIES) { ++this.retries && this.establishSignal(); }
}

// ======================= WebSocket Listeners ===============
// ======================= WebSocket Listeners ===============

MasterPeer.prototype.handleWsOpen = function() {
    this.retries = 0;
    this.getUserName(false);
}
MasterPeer.prototype.handleWsMessage = function(evt){
    let parsed = JSON.parse(evt.data) // Maybe check if object first, if not, toss it
    if(parsed.type === "id") { this.wsId = parsed.msg; }
    if(parsed.type === "nameCheck") { this.handleUserName(parsed); }
    if(parsed.type === "master") { this.createPeers(parsed); }
    if(parsed.type === "offer") { this.constructNewPeer(false, parsed); }
    if(parsed.type === "answer") { this.sendAnswerToPeer(parsed); }
    if(parsed.type === "candidate") { this.sendIceCandidateToPeer(parsed); }
    if(parsed.type === "ping") { this.handlePing(parsed); }
}
MasterPeer.prototype.handleWsClose = function (evt) {
    // We want to trigger reconnect on close event, but headless doesn't
    // re-trigger the close event when there's an error like the browser does.
    // So we check if it was already triggered from this.handleWsError
    if(!this.keepAliveCheck) {
        this.keepAliveCheck = setTimeout(this.checkIfServerAlive.bind(this), CHECK_SERVER_IN_SECONDS);
    }
    this.newPeersCheck = null;
}
MasterPeer.prototype.handleWsError = function (err) {
    this.keepAliveCheck = setTimeout(this.checkIfServerAlive.bind(this), CHECK_SERVER_IN_SECONDS);
    this.newPeersCheck = null;
    console.log("WS connection error. Will retry "+(MAX_RETRIES - this.retries)+" more time(s)");
}

// ======================= Peer dispatch ===============
// ======================= Peer dispatch ===============

MasterPeer.prototype.createPeers = function (res) {
    if(res.msg.length === establishedMasterPeers.length) { return null; }
    let sendToMasters = res.msg.filter((master) =>
        establishedMasterPeers.every((established) => established !== master.name)
    )
    for(let i = 0; i < sendToMasters.length; i++) {
        if(CHECK_FOR_NEW_PEERS) {
            const findPrevOffer = (offer) => offer.wsId === sendToMasters[i].wsId;
            if(offersReceived.some(findPrevOffer)) { continue; }
            if(offersInTransit.some(findPrevOffer)) { continue; }
        }
        let peer = this.constructNewPeer(true, {});
        peer.sendOffer(this.wsId, sendToMasters[i].wsId);
    }
}
MasterPeer.prototype.constructNewPeer = function(intiator, res) {
    if(res.renegotiate) { return this.handleRenegotation(res) }
    const findEstablishedPeer = (masterPeer) => masterPeer === res.masterName
    if(establishedMasterPeers.some(findEstablishedPeer)) { return null; }

    if(CHECK_FOR_NEW_PEERS && !intiator){
        let offer;
        let offerInd = offersInTransit.findIndex((offer) => offer.wsId === res.masterId);
        offerInd > -1 && (offer = offersInTransit[offerInd]);
        if(offer && offer.timeSent < res.timeSent) { return null; }  //We sent ours first
        if(offer && offer.timeSent > res.timeSent) { //We sent ours later
            offersReceived.push({wsId: res.masterId});
            offersInTransit.splice(offerInd, 1);
        }
    }
    let UID = ++numOfGeneratedPeers;
    peerList[UID] = new Peer({
        opts: this.opts, stream: this.stream, UID: UID, initiator: intiator
    });
    if(intiator) { return peerList[UID]; }
    // Otherwise we are receiving an offer
    peerList[UID].receivedOffer(res);
}
MasterPeer.prototype.sendAnswerToPeer = function(res) {
    for(let peerUID in peerList) {
        let peer = peerList[peerUID];
        if(!peer || peer.terminating) { continue; }
        if(peer.uniqueId === res.peerId) {
            return peer.receivedAnswer(res);
        }
    }
}
MasterPeer.prototype.sendIceCandidateToPeer = function(res) {
    for(let peerUID in peerList) {
        let peer = peerList[peerUID];
        if(!peer || peer.terminating) { continue; };
        if(peer.uniqueId === res.peerId) {
            return peer.addIceCand(res.msg);
        }
    }
}

// ============================ UserMedia / Stream ===============
// ============================ UserMedia / Stream ===============
// const constraints = { video: {
//      mandatory : {
//          chromeMediaSource: "screen",
//          maxWidth: 1280,
//          maxHeight: 720
//      },
//      optional: []
// }, audio: false }

MasterPeer.prototype.gotStream = function(localVideo, stream) {
    console.log("Got");
    this.stream = stream;
    this.localVideoDiv = localVideo ? localVideo : null;
    this.URLstream = stream //URL.createObjectURL(stream);
    // this.localVideoDiv ? document.getElementById(this.localVideoDiv).src = this.stream : null;
    this.localVideoDiv ? document.getElementById(this.localVideoDiv).srcObject = this.stream : null;
    this.sendMediaPeer();

    // Possibly new way
    // if(this.localVideoDiv) {
    //     document.getElementById(this.localVideoDiv).src = this.stream;
    //     video.onloadedmetadata = function(e) {
    //       // Do something with the video here.
    //       this.sendMediaPeer();
    //    };
    // }
    // else {
    //     this.sendMediaPeer();
    // }
}
MasterPeer.prototype.removeStream = function () {
    for(let peerUID in peerList) {
        let peer = peerList[peerUID];
        if(!peer || peer.terminating) { continue; };
        peer.peerCon.removeStream(this.stream);
        this.localVideoDiv ? document.getElementById(this.localVideoDiv).src = null : null;
        this.sendData({type: "system", name: "stream_closed"})
    }
};
MasterPeer.prototype.userMediaError = function (error) { };
// One possible problem can be both parties "renegotiating" at the same time
// Should not really be an issue for 99.9999% of cases, if it even is a problem
MasterPeer.prototype.sendMediaPeer = function () {
    for(let peerUID in peerList) {
        let peer = peerList[peerUID];
        if(!peer || peer.terminating) { continue; };
        peer.peerCon.addStream(this.stream);
        let remoteWsId = peer.remotePeer.sendToId;
        peer.renegotiating = true;
        peer.sendOffer(this.wsId, remoteWsId, true);
    }
}
MasterPeer.prototype.handleRenegotation = function (res) {
    for(let peerUID in peerList) {
        let peer = peerList[peerUID];
        if(!peer || peer.terminating) { continue; };
        if(res.masterId === peer.remotePeer.sendToId) {
            peer.renegotiating = true;
            this.stream ? peer.peerCon.addStream(this.stream) : null;
            return peer.receivedOffer(res);
        }
    }
}

// ============================ Public API ===============
// ============================ Public API ===============

MasterPeer.prototype.on = function (type, name, callback) {
    !callbacks[type] && (callbacks[type] = {});
    !callbacks[type][name] && (callbacks[type][name] = []);
    callbacks[type][name].push(callback)
};
MasterPeer.prototype.rm = function (type, name) {
    callbacks[type] && callbacks[type][name] && (callbacks[type][name].length = 0);
};
MasterPeer.prototype.getAllPeers = function () {
    return establishedMasterPeers.map((peer) => peer); // Prevent accidental manipulation
};
MasterPeer.prototype.destroy = function () {
    this.close();
    clearInterval(this.cleanupInterval)
    this.cleanupInterval = null;
    ws.close();
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
};
MasterPeer.prototype.sendData = function(msg) {
    for(let peerUID in peerList) {
        let peer = peerList[peerUID];
        if(!peer || peer.terminating || !peer.dataChannel) { continue; }
        let msgToSend = {
            type: msg.type,
            name: msg.name,
            who: this.opts.masterPeer.name,
            msg: msg.msg
        }
        peer.sendData(msgToSend);
    }
};
MasterPeer.prototype.getUserMedia = function (opts) {
    let expectedOpts = ["audio", "video", "localDiv"];
    let hasAllOpts = expectedOpts.every((opt) => opts.hasOwnProperty(opt))
    if(!hasAllOpts) { console.error("Missing options for media, see MasterPeer.getUserMedia"); }
    if(this.stream && !opts.video && !opts.audio) { return this.removeStream();  }
    if(!this.stream && !opts.video && !opts.audio) {
        console.error("Check that at least audio or video is being shared when initially calling MasterPeer.getUserMedia.");
        console.error("Subsequent requests with audio and/or video being false will remove audio and/or video.");
        return;
    }
    const constraints = { video: opts.video, audio: opts.audio }
    navigator.mediaDevices.getUserMedia(constraints)
    .then((mediaStream) => this.gotStream(opts.localDiv, mediaStream))
    .catch(this.userMediaError)
}
MasterPeer.prototype.name = "";
MasterPeer.prototype.room = "";

// ============================ Cleanup ===============
// ============================ Cleanup ===============

MasterPeer.prototype.close = function () {
    this.destroyAllPeers();
    this.clearCallbacks();
};
MasterPeer.prototype.destroyAllPeers = function() {
    for(let peerUID in peerList) {
        let peer = peerList[peerUID];
        if(!peer || peer.terminating) { continue; }
        peer.terminateSelf({selfDestruct: false});
    }
}
MasterPeer.prototype.clearCallbacks = function() {
    for(let type in callbacks) {
        for(let name in callbacks[type]) { callbacks[type][name].length = 0; }
        callbacks[type] = null;
    }
}
MasterPeer.prototype.cleanup = function () {
    for(let peerUID in peerList) {
        if(peerList[peerUID] && peerList[peerUID].destroyed) {
            peerList[peerUID] = null;
        }
    }
}


// =====================================================================
// =====================================================================
// =====================================================================
// =====================================================================
// =====================================================================
// =====================================================================
// =====================================================================
// =====================================================================
// =====================================================================
// =====================================================================
// =====================================================================




// Single Peer Constructer
function Peer(parentOpts){
    this.opts = parentOpts.opts;
    this.initiator = parentOpts.initiator ? true : false
    this.stream = parentOpts.stream;
    this.uniqueId = parentOpts.UID;
    this.opts.remoteVideos

    this.remotePeer = {};
    this.remoteStream = null;
    this.dataChannel = null;
    this.pendingCandidates = [];

    this.selfDestructTimeout = null;
    this.keepAliveTimer = null;
    this.changeRemoteVidTimer = null;

    this.destroyed = false;
    this.terminating = false;
    this.renegotiating = false;
    console.log("ICE:", this.opts.ice);
    this.peerCon = new wrtc.RTCPeer(this.opts.ice);
    this.peerCon.onicecandidate = this.gotIceCandidate.bind(this);
    this.peerCon.oniceconnectionstatechange = this.handleIceConnectionChange.bind(this);
    this.peerCon.onaddstream = this.gotRemoteStream.bind(this);

    this.stream ? this.peerCon.addStream(this.stream) : null;
}

// ============================ Peer Connection ===============
// ============================ Peer Connection ===============

Peer.prototype.gotIceCandidate = function(evt) {
    if(this.terminating || !this.peerCon) { return null; }
    if(evt.candidate) {
        if(!this.remotePeer || !this.remotePeer.sendToId) {
            this.pendingCandidates.push(evt.candidate);
        }
        else {
            let candidate = {
                type: "candidate",
                msg: evt.candidate,
                sendToId: this.remotePeer.sendToId,
                peerId: this.remotePeer.peerId
            }
            this.sendSigData(candidate);
        }
    }
}
Peer.prototype.addIceCand = function(candidate) {
    if(this.terminating || !this.peerCon) { return null; }
    this.peerCon.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
}
Peer.prototype.handleIceConnectionChange = function() {
    if(this.terminating || !this.peerCon) { return null; }
    // iceConState is disconnected when re-sending or re-receiving offer from same peer
    if(this.peerCon.iceConnectionState === 'disconnected' && !this.renegotiating) {
        return this.terminateSelf({selfDestruct: false});
    }
    if(this.peerCon.iceConnectionState === 'closed') {
        return this.terminateSelf({selfDestruct: false});
    }
}
Peer.prototype.onRemoveStream = function () {
    let elem = document.getElementById(`${this.remotePeer.masterName}-VIDEOBOX`)
    elem && elem.parentNode.removeChild(elem);
};
Peer.prototype.gotRemoteStream = function (evt) {
    if(!this.opts.remoteVideos) {
        console.error("Got remote stream, nowhere to put it. "+
        "Pass opt {remoteVideos: 'somedivid'} into MasterPeer constructor");
        return;
    }
    let elem = document.getElementById(`${this.remotePeer.masterName}-VIDEOBOX`)
    elem && elem.parentNode.removeChild(elem);

    this.remoteStream = evt.stream; // URL.createObjectURL(evt.stream);
    let vidDiv = document.createElement("div");
    let vid = document.createElement("video");
    let p = document.createElement("p")
    let button = document.createElement("button");
    let input = document.createElement("input");
    let inputVal = document.createElement("div");

    vidDiv.className = "remoteVideoPeer";
    vid.className = "remoteVideo";

    vidDiv.id = `${this.remotePeer.masterName}-VIDEOBOX`;
    vid.id = `${this.remotePeer.masterName}-VIDEO`;

    input.type = "range";
    input.min = 120;
    input.max = 500;
    input.step = 20;
    input.defaultValue = 240;
    input.id = `${this.remotePeer.masterName}-INPUT`;

    inputVal.id = `${this.remotePeer.masterName}-INPUTVAL`;

    let val = document.createTextNode(input.defaultValue+"px");
    let userName = document.createTextNode(`${this.remotePeer.masterName}`);
    let buttonText = document.createTextNode("Toggle Audio");

    vid.controls = true;
    // vid.src = this.remoteStream;
    vid.srcObject = this.remoteStream;
    vid.poster = "https://images.duckduckgo.com/iu/?u=http%3A%2F%2Fimages.wikia.com%2Ficarly%2Fimages%2F6%2F63%2FSmileyface.jpg&f=1"
    vid.play();
    button.addEventListener("click", () => {
        let mutedState = document.getElementById(vid.id).muted
        document.getElementById(vid.id).muted = !mutedState
    });
    input.addEventListener("input", () => {
        let val = document.getElementById(input.id).value;
        document.getElementById(inputVal.id).innerHTML = val+"px";
    })
    input.addEventListener("mouseup", () => {
        let val = document.getElementById(input.id).value;
        document.getElementById(vid.id).style.width = val+"px";
        document.getElementById(vidDiv.id ).style.width = val+"px";
    })

    p.appendChild(userName);
    button.appendChild(buttonText);
    inputVal.appendChild(val);

    vidDiv.appendChild(p);
    vidDiv.appendChild(input);
    vidDiv.appendChild(inputVal);
    vidDiv.appendChild(vid);
    vidDiv.appendChild(button);

    document.getElementById(this.opts.remoteVideos).appendChild(vidDiv);
    for(let name in callbacks["stream"]) { callbacks["stream"][name].forEach((fn) => fn() ) }
}

// ====================== RTC Offer/Answer ==============
// ====================== RTC Offer/Answer ==============

Peer.prototype.sendOffer = function(masterId, remoteMasterId, renegotiate) {
    if(this.terminating) { return null; }

    // Forgoing dynamic channels for now
    // Possibly create multiple data channels, one for msg, one for data?
    !renegotiate && (this.dataChannel = this.peerCon.createDataChannel("main", { ordered: false, maxRetransmits: 0}));
    !renegotiate && this.onDataChannelCreated(remoteMasterId);
    this.peerCon.createOffer((offer) => {
        this.peerCon.setLocalDescription(offer);
        // Make masterId, masterName, wsId into obj
        let timeSent = new Date();
        let jsonOffer = {
            type: "offer",
            msg: offer,
            sendToId: remoteMasterId,
            masterId: masterId,
            masterName: this.opts.masterPeer.name,
            uniqueId: this.uniqueId,
            timeSent: timeSent,
            renegotiate: renegotiate ? true : false
        }
        this.sendSigData(jsonOffer);
        if(CHECK_FOR_NEW_PEERS){ offersInTransit.push({wsId: remoteMasterId, timeSent: timeSent}); }
        this.selfDestructTimeout = setTimeout(() => {
            if(CHECK_FOR_NEW_PEERS){ this.removeInTransitOffer(remoteMasterId) }
            this.terminateSelf({selfDestruct: true})
        }, PEER_OFFER_TIMEOUT)
    },()=>{}, {offerToReceiveAudio: true, offerToReceiveVideo: true})
}
Peer.prototype.receivedOffer = function(res) {
    if(this.terminating || !res || !res.masterId) { return null; }
    this.remotePeer = {
        sendToId: res.masterId, // Offerers Id
        peerId: res.uniqueId,
        masterName: res.masterName
    }
    this.peerCon.ondatachannel = (evt) => {
        this.dataChannel = evt.channel;
        this.onDataChannelCreated(res.masterId);
    }
    this.peerCon.setRemoteDescription(new wrtc.RTCSessionDescription(res.msg));
    this.peerCon.createAnswer((answer) => {
        this.peerCon.setLocalDescription(answer);
        // Make masterId, masterName, wsId into obj
        let jsonAnswer = {
            type: "answer",
            msg: answer,
            sendToId: res.masterId, // Offerers Id
            masterId: res.sendToId, // Our Id
            peerId: res.uniqueId,
            masterName: this.opts.masterPeer.name,
            uniqueId: this.uniqueId
        }
        this.sendSigData(jsonAnswer);
        this.renegotiating = false;
    },()=>{});
}
Peer.prototype.receivedAnswer = function(res) {
    if(this.terminating) { return null; }
    clearTimeout(this.selfDestructTimeout)
    this.selfDestructTimeout = null;
    this.remotePeer = {
        sendToId: res.masterId, // Answerers Id
        peerId: res.uniqueId,
        masterName: res.masterName
    }

    this.pendingCandidates.forEach((candidate) => {
        let jsonCandidate = {
            type: "candidate",
            msg: candidate,
            sendToId: this.remotePeer.sendToId,
            peerId: this.remotePeer.peerId
        }
        this.sendSigData(jsonCandidate);
    })
    this.pendingCandidates.length = 0;
    this.peerCon.setRemoteDescription(new wrtc.RTCSessionDescription(res.msg));
    this.renegotiating = false;
    if(CHECK_FOR_NEW_PEERS) { this.removeInTransitOffer(res.masterId); }

}

// ======================== Channel ================
// ======================== Channel ================

Peer.prototype.onDataChannelCreated = function(remoteMasterId) {
    this.dataChannel.onopen = (evt) => {
        establishedMasterPeers.push(this.remotePeer.masterName);
        if(CHECK_FOR_NEW_PEERS) { this.removeReceivedOffer(remoteMasterId); }
        this.keepAliveTimer = setInterval(() => { this.sendData({type: "system", name: "keep_alive"}) }, DATA_CHANNEL_TTL_CHECK)
        setTimeout(() => {
            for(let name in callbacks["open"]) { callbacks["open"][name].forEach((fn) => fn() ) }
        }, 500);
    }
    this.dataChannel.onclose = (evt) => {
        if(!this.terminating) { this.terminateSelf({selfDestruct: false}) }
    }
    this.dataChannel.onerror = (err) => {
        if(!this.terminating) { this.terminateSelf({selfDestruct: false}) }
    }
    this.dataChannel.onmessage = (evt) => {
        if(this.terminating) { return null; }
        let msg = JSON.parse(evt.data); // Check for object, toss if bad
        this.handleDataChannelMsg(msg);
    }
}
Peer.prototype.handleDataChannelMsg = function (msg) {
    if(msg.type === "system" && msg.name === "keep_alive") { return; }
    if(msg.type === "system" && msg.name === "stream_closed") { return this.onRemoveStream(); }
    if(!callbacks.hasOwnProperty(msg.type)) { return; }
    if(!callbacks[msg.type].hasOwnProperty(msg.name)) { return; }
    callbacks[msg.type][msg.name].forEach((fn) => fn(msg) )
};
Peer.prototype.sendData = function (msg) {
    if(this.terminating || !this.dataChannel) { return null; }
    if(this.dataChannel.readyState === "connecting") {
        //  Delay the send, this is simpler for the time being
        setTimeout(() => {
            if(this.terminating || !this.dataChannel) { return null; }
            if(this.dataChannel.readyState !== "open") { return null; }
            this.dataChannel.send(JSON.stringify(msg))
        }, 1000)
    }
    if(this.dataChannel.readyState === "open") {
        this.dataChannel.send(JSON.stringify(msg))
    }
}
Peer.prototype.sendSigData = function (msg) {
    if(this.terminating) { return null; }
    ws.send(JSON.stringify(msg)); // Uses MasterPeers/Global websocket
}
Peer.prototype.removeInTransitOffer = function (remoteMasterId) {
    const findMasterIndex = (offer) => offer.wsId === remoteMasterId
    let ind = offersInTransit.findIndex(findMasterIndex)
    ind > -1 && offersInTransit.splice(ind, 1)
};
Peer.prototype.removeReceivedOffer = function (remoteMasterId) {
    const findMasterIndex = (offer) => offer.wsId === remoteMasterId
    let ind = offersReceived.findIndex(findMasterIndex)
    ind > -1 && offersReceived.splice(ind, 1)
};


// ================ Closing/Cleanup ===============
// ================ Closing/Cleanup ===============

Peer.prototype.terminatePeerCon = function () {
    if(this.destroyed || !this.peerCon) { return null; }
    this.stream ? this.peerCon.removeStream(this.stream) : null;
    try { this.peerCon.close(); }
    catch(e) { }
    this.peerCon.oniceconnectionstatechange = null;
    this.peerCon.onicecandidate = null;
    this.peerCon.ondatachannel = null;
    this.peerCon.onaddstream = null;
    this.peerCon = null;

}
Peer.prototype.terminateDataChannel = function () {
    if(this.destroyed || !this.dataChannel) { return null; }
    clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = null;
    try { this.dataChannel.close(); }
    catch(e) { }
    this.dataChannel.onopen = null;
    this.dataChannel.onmessage = null;
    this.dataChannel.onclose = null;
    this.dataChannel = null;
}
Peer.prototype.terminateSelf = function(opts) {
    if(this.destroyed || this.terminating) { return null; }
    clearTimeout(this.selfDestructTimeout)
    this.selfDestructTimeout = null;
    this.terminating = true;

    deleteMaster(JSON.stringify(this.remotePeer));
    this.terminateDataChannel();
    this.terminatePeerCon();
    this.destroyed = true;

    if(!opts.selfDestruct) {
        for(let name in callbacks["close"]) {
            callbacks["close"][name].forEach((fn) => fn(this.remotePeer.masterName) )
        }
    }
}
function deleteMaster (remotePeer) {
    let parsedMaster = JSON.parse(remotePeer);
    if(deletingMasterPeer) { return setTimeout(() => { deleteMaster(JSON.stringify(parsedMaster)) }, 500) }
    deletingMasterPeer = true;
    const findMasterIndex = (masterPeer) => masterPeer === parsedMaster.masterName;
    let masterToDeleteIndex = establishedMasterPeers.findIndex(findMasterIndex);
    masterToDeleteIndex > -1 && establishedMasterPeers.splice(masterToDeleteIndex, 1);
    deletingMasterPeer = false;
}
