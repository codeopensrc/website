'use strict';

const React = require('react');

require("../style/WebRTC.less");

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mediaDevices.getUserMedia;

const constraints = { video: true };
const RTCPeer = window.webkitRTCPeerConnection || window.RTCPeerConnection;
const ice = {
    "iceServers": [
        {"url": `stun:stun.cjones.tk`}
    ]
}

const WebRTC = React.createClass({

    getInitialState: function () {
        return {
            localSrc: "",
            remoteSrc: ""
        }
    },

    componentDidMount: function() {
        this.refs['start'].disabled = false;
        this.refs['call'].disabled = true;
        this.refs['hangup'].disabled = true;
        this.refs['senddata'].disabled = true;

        this.dataChannel = "", //This will be an array once multiple peers supported

        this.localPC = new RTCPeer(ice) //This will be an array once multiple peers supporte
        this.localPC.onicecandidate = this.sendIceCandidate;
        this.localPC.onaddstream = this.gotRemoteStream;

        let room = location.pathname.split(/\//g).splice(2).join("/");
        if(!room) { room = "lobby" }
        this.sigChannel = new WebSocket(`${window.WS_PROTOCOL}://${location.hostname}:${window.WS_PORT}/ws/${room}`),
        this.sigChannel.onmessage = this.gotSignalMessage;
    },


    start: function () {
        this.refs['start'].disabled = true;
        navigator.getUserMedia(constraints, this.gotStream, this.error)
    },

    gotStream: function (stream) {
        this.setState({
            localSrc: URL.createObjectURL(stream)
        }, () => {
            this.localPC.addStream(stream)
            this.refs['call'].disabled = false;
        })
    },

    error: function(err) {
        console.log("Nav.getUserMedia err: ", err);
    },

    sendOffer: function() {
        this.refs['call'].disabled = true;
        this.refs['hangup'].disabled = false;
        this.refs['senddata'].disabled = false;
        this.dataChannel = this.localPC.createDataChannel("test", { ordered: false, maxRetransmits: 0});
        this.onDataChannelCreated(this.dataChannel)

        this.localPC.createOffer((offer) => {
            this.localPC.setLocalDescription(offer)
            this.sigChannel.send(JSON.stringify({type: "offer", msg: offer}));
        },()=>{})
    },

    receivedOffer: function(offer) {
        this.refs['call'].disabled = true;
        this.refs['hangup'].disabled = false;
        this.refs['senddata'].disabled = false;
        this.localPC.ondatachannel = (evt) => {
            this.dataChannel = evt.channel
            this.onDataChannelCreated(this.dataChannel)
        }
        this.localPC.setRemoteDescription(offer);
        this.localPC.createAnswer((answer) => {
            this.localPC.setLocalDescription(answer)
            this.sigChannel.send(JSON.stringify({type: "answer", msg: answer}));
        },()=>{});
    },

    receivedAnswer: function(offer) {
        this.localPC.setRemoteDescription(offer)
    },

    sendIceCandidate: function(evt) {
        if(evt.candidate) {
            this.sigChannel.send(JSON.stringify({type: "candidate", msg: evt.candidate}))
        }
    },

    gotSignalMessage: function(evt) {
        let parsed = JSON.parse(evt.data)
        if(parsed.type === "offer") { this.receivedOffer(parsed.msg) }
        if(parsed.type === "answer") { this.receivedAnswer(parsed.msg) }
        if(parsed.type === "candidate") { this.localPC.addIceCandidate(parsed.msg)  }
    },

    gotRemoteStream: function(evt) {
        this.setState({
            remoteSrc: URL.createObjectURL(evt.stream)
        })
    },

    hangup: function() {
        this.localPC.close();
        this.localPC = null
        this.refs['hangup'].disabled = true;
        this.refs['call'].disabled = false;
    },

    onDataChannelCreated: function(channel) {
        console.log("onDataChannelCreated");
        channel.onopen = () => {
            console.log("Data Channel created!");
        }
        channel.onmessage = this.receivedData()
    },

    receivedData: function() {
        console.log("receivedData");
        let buf;
        let count;
        return (evt) => {
            // if(typeof evt.data === "string") {
            //     buf = window.buf = new Uint8ClampedArray(parseInt(evt.data))
            //     count = 0;
            //     // return;
            // }
            //
            // let data = new Uint8ClampedArray(evt.data);
            // buf.set(data, count)
            //
            // count += data.byteLength;
            // console.log("Count:", count);
            // console.log("Buf:", buf.byteLength);
            // if(count === buf.byteLength) {
                this.gotAllData(evt.data);
            // }
        }
    },

    gotAllData: function(data) {
        this.refs["remotedata"].innerHTML += data+"<br />";
    },

    sendData: function() {
        let CHUNK_LEN = 64000;
        let data = "Hello world!";
        // var bytes = [];
        // for (var i = 0; i < data.length; ++i) {
        //     bytes.push(data.charCodeAt(i));
        // }
        let len = (new TextEncoder('utf-8').encode(data)).length;
        // let bitEnd = len / CHUNK_LEN | 0;

        // dataChannel.send(len);

        this.dataChannel.send(data)

        // for(let ind = 0; ind < bitEnd; ind++) {
        //     let start = ind * CHUNK_LEN;
        //     let end = (ind+1) * CHUNK_LEN;
        //     dataChannel.send(bytes)
        // }

    },

	render: function() {
		return (
			<div id="webrtc">
                <h1>Local</h1>
                <div id="remotebox">
                    <h2>Remote vid</h2>
                    <video ref="remote" src={ this.state.remoteSrc } autoPlay width="300" height="300"></video>
                </div>
                <div id="localbox">
                    <h2>Local vid</h2>
                    <video ref="local" src={ this.state.localSrc } autoPlay width="100" height="100"></video>
                    <button ref="start" onClick={this.start} >Start</button>
                    <button ref="call" onClick={this.sendOffer} >Call</button>
                    <button ref="hangup" onClick={this.hangup} >Hang up</button>
                    <button ref="senddata" onClick={this.sendData} >Send some data</button>
                </div>
                <div ref="remotedata" id="remoteData"></div>
            </div>
		);
	}

});

module.exports = WebRTC;
