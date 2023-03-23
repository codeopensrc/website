"use strict";

import React, { useEffect, useState, useCallback } from 'react';
import { api } from "os-npm-util/client";

import unity from "../js/unity.js";

import Header from "./Header.jsx"

import "../style/Games.less"

const Unity = function(props) {
    const { baseAssetFolder } = props
    const [title, setTitle] = useState("")
    const [gamelist, setGamelist] = useState([])
    const [gameactive, setGameactive] = useState(false)

    useEffect(() => {
        api.get(`gamelist`, (res) => {
            if(res.status) {
                setGamelist(res.body)
            }
            else {
                console.log(res);
            }
        })
        return api.abortAllRequests
    }, [])

    const loadGame = (foldername, projectname) => {
        let fullprojectpath = `${baseAssetFolder}/${foldername}`
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

        setTitle(projectname)
        setGameactive(true)
        unity.load(foldername, fullprojectpath, projectname)
    }

    let gamebuttons = gamelist.map((game, i) => {
        return (<button key={i} className={"games-btn"}
                        onClick={() => loadGame(game.folder, game.projectname)}
                        disabled={gameactive}>
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
                            onClick={() => {
                                setTitle("")
                                setGameactive(false)
                            }}
                            disabled={!gameactive}>
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
                        <div id={"unity-build-title"}>{title}</div>
                    </div>
                </div>
            </div>
        </div>
    )
};

export { Unity as default };
