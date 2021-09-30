'use strict';

//Old, keeping for some reference if ever doing webtorrent again
return;

let Server = require('bittorrent-tracker').Server;
let config = require('../local/serverConfig.js');

var tracker = new Server({
    udp: true, // enable udp server? [default=true]
    http: true, // enable http server? [default=true]
    ws: true, // enable websocket server? [default=true]
    stats: false, // enable web-based statistics? [default=true]
})

// Internal http, udp, and websocket servers exposed as public properties.
//tracker.http
//tracker.udp
tracker.ws

tracker.on('error', function (err) {
    // fatal server error!
    console.log("WHOA, some err happened:", err.message)
})

tracker.on('warning', function (err) {
    // client sent bad data. probably not a problem, just a buggy client.
    console.log("Some Warning Message:", err.message)
})

tracker.on('listening', function () {
    // fired when all requested servers are listening
    //console.log('listening on http port:' + tracker.http.address().port);
    //console.log('listening on udp port:' + tracker.udp.address().port);
    console.log('listening on ws port:' + tracker.ws.address().port);
//    process.send('ready');
})

// start tracker server listening! Use 0 to listen on a random free port.
tracker.listen(config.trackerPort)

// listen for individual tracker messages from peers:
tracker.on('start', function (addr) {
    console.log('Got start message from ' + addr)
})

tracker.on('complete', function (addr) {
	console.log("complete from " + addr);
	console.log("hashes: ", Object.keys(tracker.torrents))
})
tracker.on('update', function (addr) {
	console.log("update from " + addr)
	 console.log("hashes: ", Object.keys(tracker.torrents))
})
tracker.on('stop', function (addr) {
	console.log("stop from " + addr)
	 console.log("hashes: ", Object.keys(tracker.torrents))
})

/*
// get info hashes for all torrents in the tracker server
Object.keys(tracker.torrents)


// get the number of seeders for a particular torrent
tracker.torrents[infoHash].complete

// get the number of leechers for a particular torrent
tracker.torrents[infoHash].incomplete

// get the peers who are in a particular torrent swarm
tracker.torrents[infoHash].peers
*/
