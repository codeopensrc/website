"use strict";

const React = require('react');
const PropTypes = React.PropTypes;

const PortfolioTools = React.createClass({
    getInitialState: function() {
        return {
            tools: [
                {imgsrc: "", name: "", link: ""}
            ],
        };
    },

    componentDidMount: function() {
        console.log("Mounted");
    },

    render: function() {
        return (
            <div>
                Tools
            </div>
        );
    }

});

module.exports = PortfolioTools;
