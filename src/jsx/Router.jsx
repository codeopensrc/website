'use strict';

const FullPost = require('./FullPost.jsx');
const Portfolio = require('./Portfolio.jsx');
const MsgBox = require('./MsgBox.jsx');
const Home = require('./Home.jsx');
const Markdown = require('./Markdown.jsx');
const Games = require('./Games.jsx');
const React = require('react');
const ReactDOM = require('react-dom');


require("../style/style.less");


const Route = React.createClass({

    componentDidMount: function() {

    },

    generateIframeTag: function(repoid, snipid, src) {
        const elementId = `${repoid}-${snipid}`;
        const styles = `<style>
        *{ font-size:12px; margin:0; }
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
    },

    updateSnippetScripts: function() {
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
    },

  render: function () {

    let Component = null;
    let path = location.pathname.split('/')[1];
    let host = location.hostname;

    switch(path) {
      case "posts": Component = <FullPost updateSnippetScripts={this.updateSnippetScripts}/>;
      break;
      case "portfolio": Component = <Portfolio />;
      break;
      case "chat": Component = <MsgBox />;
      break;
      case "games": Component = <Games baseAssetFolder={"unity"}/>
      break;
      case "blog": Component = <Home updateSnippetScripts={this.updateSnippetScripts}/>;
      break;
      default: Component = <Markdown />;
    }

    if(location.hostname.indexOf("welift") > -1) {
        Component = <MsgBox />;
    }

    return (
        <div>
            {Component}
        </div>
    );
  }

});

ReactDOM.render(<Route />, document.getElementById('index'));
