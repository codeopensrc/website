'use strict';

const React = require('react');

module.exports = React.createClass({
    getInitialState: function () {
        return {};
    },

    render: function () {
        // <a className="navBtn" href='/chat'>WebRTC Chat</a>

        return (
            <div id="navBar">
                <a className="navBtn" href='/'>Home</a>
                <a className="navBtn" href='/games'>Games</a>
                <a className="navBtn" href='/blog'>Blog</a>
            </div>
        );
    }


});
