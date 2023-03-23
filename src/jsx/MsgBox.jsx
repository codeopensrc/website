"use strict";

import React from 'react';
import MasterPeer from "../js/Peers.js";

import "../style/MsgBox.less";

// TODO: Add list of currently open rooms
// TODO: Add possible password protection if first user wishes

class MsgBox extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            text: "",
            connected: false,
            peers: [],
            name: "",
            linesOfText: 0,
            muteAll: true,
            room: "",
            nameTaken: false,
            joining: false
        }
    }

    componentDidMount() {
        this.refs["sendButton"].disabled = true;
        this.refs["start"].disabled = true;
        // setTimeout(() => {
        //     window.open("http://localhost:8001/chat/lobby")
        //     window.close()
        // }, 15000)
    }

    componentWillUnmount() {
        this.MasterPeer.destroy()
    }

    constructRoom() {
        // Basic check for domain name
        let fqdn = `${location.hostname.match(/[\w\d]+\.[\w\d]+$/)}`
        this.refs.joinRoom.disabled = true;
        this.MasterPeer = new MasterPeer({
            wsUrl: WS_HOST,
            mainWsRoom: "chat",
            userRoom: this.refs.room.value,
            userName: this.refs.userName.value,
            ice: [ {"urls": `stun:stun.${fqdn}`} ],
            autoName: false,
            remoteVideos: "videoChatBox"
        });
        this.refs["start"].disabled = false;

        this.setJoining = setTimeout(() => { this.MasterPeer && this.setState({joining: true}) }, 1000);

        window.onbeforeunload = () => { this.MasterPeer.destroy() }

        this.MasterPeer.on("name", "invalidname", () => {
            this.refs["start"].disabled = true;
            this.MasterPeer.destroy();
            this.MasterPeer = null;
            this.setState({joining: false, nameTaken: true}, () => {
                setTimeout(() => { this.refs.joinRoom.disabled = false }, 3000);
            })
        })

        this.MasterPeer.on("open", "connection", () => {
            this.refs["sendButton"].disabled = false;
            clearTimeout(this.setJoining);
            let peers = this.MasterPeer.getAllPeers();
            this.setState({
                peers: peers,
                room: this.MasterPeer.room,
                name: this.MasterPeer.name,
                connected: true,
                nameTaken: false,
                joining: false
            })
        })
        this.MasterPeer.on("close", "connection", (evt) => {
            let elem = document.getElementById(evt+"-VIDEOBOX")
            elem && elem.parentNode.removeChild(elem);
            let peers = this.MasterPeer.getAllPeers();
            this.setState({ peers: peers }, () => {
                if(this.state.peers.length < 1) {
                    this.refs["sendButton"].disabled = true;
                    this.setState({connected: false})
                }
            })
        })
        this.MasterPeer.on("stream", "toggled", () => { this.muteLatestPeer(); });
        this.MasterPeer.on("msg", "userMsg", (data) => { this.appendMsg(data.who, data.msg); });
        this.MasterPeer.on("evt", "isTyping", (evt) => {
            this.setState({
                peers: this.state.peers.map((peer) =>  peer === evt.who ? peer+" is typing" : peer )
            })
        })
        this.MasterPeer.on("evt", "notTyping", (evt) => {
            this.setState({
                peers: this.state.peers.map((peer) =>  {
                    let strippedPeer = peer.replace(" is typing", "");
                    return strippedPeer === evt.who ? strippedPeer : peer
                })
            })
        })
    }

    handleChange(e) {
        if(e.target.value !== "") { this.MasterPeer.sendData({type: "evt", name: "isTyping"})}
        if(e.target.value === "") { this.MasterPeer.sendData({type: "evt", name: "notTyping"})}
        this.setState({ text: e.target.value })
    }

    handleSend() {
        let msg = this.state.text;
        if(msg === "") { return; }
        this.MasterPeer.sendData({type: "msg", name: "userMsg", msg: msg});
        this.appendMsg(this.MasterPeer.name, msg)
        this.setState({ text: "" })
        this.MasterPeer.sendData({type: "evt", name: "notTyping"})
    }

    appendMsg(who, msg) {
        let backgroundColor = (this.state.linesOfText % 2 === 0) ? "DarkBG" : "LightBG"
        let date = new Date();
        let formatHours = (input) => input > 12 || input === 0 ? Math.abs(input - 12) : input;
        let formatZero = (input) => input < 10 ? "0"+input : input;
        let time = `${formatZero(formatHours(date.getHours()))}:${formatZero(date.getMinutes())}:${formatZero(date.getSeconds())}`;
        document.getElementById("chat").innerHTML +=
            `<div class="${backgroundColor} chatText">${time} - <strong>${who}</strong>: ${msg} </div>`;
        let currentScroll = document.getElementById("chat").scrollTop;
        document.getElementById("chat").scrollTop = currentScroll+100;
        this.setState({ linesOfText: (this.state.linesOfText+1) })
    }

    keyPress(e) {
        if(!this.state.connected) { return; }
        if(e.key === "Enter") { this.handleSend(); }
    }

    getLocalUserMedia() {
        let disabled = this.refs["start"].disabled;
        let shareAudio = !this.refs.audio.checked;
        let shareVideo = this.refs.video.checked;
        if(!disabled && !shareAudio && !shareVideo) {
            return alert("At least one of Audio or Video must be shared when starting A/V Stream")
        }
        this.MasterPeer.getUserMedia({localDiv: "localStream", audio: shareAudio, video: shareVideo});
        this.refs["start"].disabled = true;
    }

    toggleMuteAll() {
        this.setState({muteAll: !this.state.muteAll}, () => {
            this.applyCurrentMute();
        })
    }

    applyCurrentMute() {
        let videos = [];
        let remotePeers = Array.from(document.getElementById("videoChatBox").childNodes);
        remotePeers.forEach((videoDiv) => {
            Array.from(videoDiv.childNodes).forEach((el) =>
                el.className === "remoteVideo" && videos.push(el));
            videos.forEach((video) => { video.muted = this.state.muteAll; })
        })
        videos.length = 0;
    }

    muteLatestPeer() {
        let remotePeers = Array.from(document.getElementById("videoChatBox").childNodes);
        let latestPeer = remotePeers[remotePeers.length-1];
        Array.from(latestPeer.childNodes).some((el) =>
            el.className === "remoteVideo" && (el.muted = this.state.muteAll) );
    }

    handleShareChange() {
        if(this.refs["start"].disabled) { this.getLocalUserMedia(); }
    }

    render() {

        let welcomeMsg = (
            <div style={{ border: "1px solid black", textAlign: "center",
            height: "80px", fontSize: "18px"}}>
                Enter a room and username to join. <br/>
                Room: <input ref="room" defaultValue="lobby" placeholder="Room" type="text" />
                User: <input ref="userName" defaultValue={`Guest ${(Math.random() * 10000).toFixed(0)}`} type="text" />
                <button ref="joinRoom" onClick={this.constructRoom.bind(this)}>Join Room</button>
                <div style={{marginLeft: 5, color: "red"}}>{this.state.nameTaken? <strong>Name Taken</strong>:null}</div>
            </div>
         )

        this.state.joining && (welcomeMsg = <h1>Please wait while I get you connected to other peers. <br />
             If you aren't connected within 10 seconds, either there's nobody in the chatroom,
             or I broke something.</h1>)
        this.state.name && (welcomeMsg = <h1>Welcome to the chatroom "{this.state.room}" {this.state.name}!</h1>);

        let chatRoomPeers = this.state.peers.map((peer, ind) => {
            let isTyping = peer.indexOf(" is typing") >-1 ? <em style={{fontSize: 12, color: "#bf0f0f"}}> is typing</em> : null;
            peer = peer.replace(" is typing", "")
            return <h2 key={ind}>{peer}{isTyping}</h2>
        })

        return (
            <div id="ChatPage" >
                {welcomeMsg}
                <div id="chatroom">
                    <h3>People in Chat: {this.state.peers.length}</h3>
                    {chatRoomPeers}
                </div>
                <div id="chatBox">
                    <div className="msgBar">
                        <button className="chatButton" ref="sendButton" onClick={this.handleSend.bind(this)}>Send</button>
                        <input className="msgInput" type="text" value={this.state.text}
                            onChange={this.handleChange.bind(this)} onKeyPress={this.keyPress.bind(this)}/>
                    </div>
                    <div id="chat"></div>
                </div>
                <div id="videoChatBox">
                    <h2>NOTE: A/V Stream untested for computers without Audio and Video inputs. <br /> <br />
                        NOTE: By default, all incoming audio is muted. <br />
                        Press "Toggle Audio" to enable audio per user (if user is streaming). <br />
                        Press "Unmute All Peers" to enable all current and future incoming audio. <br />
                        Use a headset or headphones when enabling your mic. <br />
                        Otherwise <em>extremely</em> annoying feedback will ensue when unmuting.<br />
                    </h2>
                    <div id="localVideoDiv">
                        <p>You</p>
                        <video autoPlay muted id="localStream"></video>
                        <p><input ref="audio" onChange={this.handleShareChange.bind(this)} type="checkbox" />Mute Mic</p>
                        <p><input ref="video" defaultChecked onChange={this.handleShareChange.bind(this)} type="checkbox" />Share Video</p>
                        <button ref="start" onClick={this.getLocalUserMedia.bind(this)}>Start A/V Stream</button>
                        <button ref="muteAll" onClick={this.toggleMuteAll.bind(this)}>{this.state.muteAll?"Unmute":"Mute"} All Peers</button>
                    </div>
                </div>
                <div id="bottom">
                    <h2>Note: This is a pure Peer-to-Peer chat, no messages ever get relayed through a server!</h2>
                    <h2>Only the initial connection and a "keep alive" message every minute to ensure youre still
                        there is the only communication between you and the server.</h2>
                    <h1>Coming Soon:</h1>
                    <br />
                    <h2>Screen sharing (no remote desktop sorry)</h2>

                    <br /><br />
                    <h1>Future features:</h1>
                    <br />
                    <h2>File sharing</h2>
                    <h2>Drag n Drop mp3s for music streaming to peers</h2>

                </div>
            </div>

        )
    }
};

export { MsgBox as default };
