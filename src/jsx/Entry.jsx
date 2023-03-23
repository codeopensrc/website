'use strict';

import { hot } from 'react-hot-loader/root';
//const FullPost = require('./FullPost.jsx');
//const Portfolio = require('./Portfolio.jsx');
import MsgBox from "./MsgBox.jsx"
//const Home = require('./Home.jsx');
import Markdown from "./Markdown.jsx"
import Games from "./Games.jsx"
import React, { useEffect, useState, useCallback } from 'react';
import DOM from 'react-dom';
import {
    BrowserRouter as Router,
    Route,
    Switch,
    Link
} from 'react-router-dom';


import "../style/style.less"


const Entry = function() {
    //const { } = props
    //const [var, fn] = useState()

    //useEffect(() => {})

    const generateIframeTag = (repoid, snipid, src) => {
        const elementId = `${repoid}-${snipid}`;
        const styles = `<style>
        *{ margin:0; }
        .gitlab-embed-snippets{ margin:0 !important; }
        .file-content.code{ overflow-x:unset !important; }
        </style>`;
        const snipScript = `<script type="text/javascript" src="${src}"></script>`;
        const resizeScript = `onload="parent.document.getElementById('${elementId}').style.height=document.body.scrollHeight + 'px'"`;
        const iframeHead = `<head><base target="_parent">${styles}</head>`;
        const iframeBody = `<body ${resizeScript}>${snipScript}</body>`;
        let iframe = document.createElement("iframe");
        iframe.srcdoc = `<html>${iframeHead}${iframeBody}</html>`;
        iframe.id = elementId;
        iframe.className = "snippet"
        iframe.frameBorder = 0;
        return iframe
    }

    const updateSnippetScripts = () => {
        let scripts = document.getElementsByTagName("script")
        for (let i = 0; i < scripts.length; i++) {
            let script = scripts[i];
            let src = script.src

            let snippetRegex = /snippets\/(\d+)\.js/
            let snippetId = src.match(snippetRegex) ? src.match(snippetRegex)[1] : ""

            let projectRegex = /\.com\/(.*)\/-\/snippets/
            let projectRepo = src.match(projectRegex) ? src.match(projectRegex)[1] : ""

            if(!snippetId) { continue; }

            let iframe = this.generateIframeTag(projectRepo || i, snippetId, src)
            script.insertAdjacentElement('afterend', iframe);
        }
    }


    //case "blog": Component = <Home updateSnippetScripts={this.updateSnippetScripts}/>;
    //break;
    //case "posts": Component = <FullPost updateSnippetScripts={this.updateSnippetScripts}/>;
    //break;
    //case "portfolio": Component = <Portfolio />;
    //break;

    return (
        <Router>
            <div id={"component-entry"}>
                <Switch>
                    <Route exact path={"/"} render={() => 
                        <Markdown />
                    }/>
                    <Route path={"/games"} render={() =>
                        <Games baseAssetFolder={"unity"}/>
                    }/> 
                    <Route path={"/chat"} render={() => 
                        <MsgBox />
                    }/>
                </Switch>
            </div>
        </Router>
    );

};

export default hot(Entry);

DOM.render(<Entry />, document.getElementById("main"))
