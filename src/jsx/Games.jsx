"use strict";

const React = require('react');
const DOM = require('react-dom');
const { api } = require("os-npm-util")

const unity = require("../js/unity.js")

const Header = require('./Header.jsx');

require("../style/Games.less")

const Unity = React.createClass({

    getInitialState: function() {
        return {
            baseAssetFolder: this.props.baseAssetFolder,
            title: "",
            gamelist: [],
            gameactive: false
        };
    },

    componentWillUnmount: function() {
        // Do cleanup
    },

    componentWillMount: function() {
        api.get(`gamelist`, (res) => {
            if(res.status) {
                this.setState({ gamelist: res.body })
            }
            else {
                console.log(res);
            }
        })
    },

    componentDidMount: function() {
    },

    loadGame: function(foldername, projectname) {
        let fullprojectpath = `${this.state.baseAssetFolder}/${foldername}`
        let canvasContainer = document.querySelector("#unity-container");

        let oldcanvas = document.querySelector("#unity-canvas")
        if(oldcanvas) { oldcanvas.remove() }

        let canvas = document.createElement("canvas")
        canvas.id = "unity-canvas"
        canvasContainer.append(canvas)

        let link1 = document.createElement("link");
        link1.rel = "stylesheet";
        link1.href = `${fullprojectpath}/TemplateData/style.css`;

        let link2 = document.createElement("link");
        link2.rel = "shortcut icon";
        link2.href = `${fullprojectpath}/TemplateData/favicon.ico`;

        document.title = projectname;
        document.head.appendChild(link1)
        document.head.appendChild(link2)

        this.setState({
            title: projectname,
            gameactive: true
        })
        unity.load(foldername, fullprojectpath, projectname)
    },

    render: function() {

        let gamebuttons = this.state.gamelist.map((game, i) => {
            return (<button key={i} className={"games-btn"}
                            onClick={() => this.loadGame(game.folder, game.projectname)}
                            disabled={this.state.gameactive}>
                        {game.projectname}
                    </button>)
        })

        return (
            <div id={"gamespage"}>
                <Header theme={"dark"}/>
                <div id={"games-container"}>
                    <div id={"games-sidebar"}>
                        <span>Sample Selection</span>
                        {gamebuttons}
                        <button id={"unity-quit"}
                                className={"games-btn"}
                                onClick={() => this.setState({gameactive: false, title: ""})}
                                disabled={!this.state.gameactive}>
                            Quit
                        </button>
                    </div>
                    <div id={"unity-container"} className={"unity-desktop"}>
                        <canvas id={"unity-canvas"}></canvas>
                        <div id={"unity-loading-bar"}>
                            <div id={"unity-logo"}></div>
                            <div id={"unity-progress-bar-empty"}>
                                <div id={"unity-progress-bar-full"}></div>
                            </div>
                        </div>
                        <div id={"unity-footer"}>
                            <div id={"unity-webgl-logo"}></div>
                            <div id={"unity-fullscreen-button"}></div>
                            <div id={"unity-build-title"}>{this.state.title}</div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

});

module.exports = Unity;
