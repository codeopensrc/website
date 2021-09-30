"use strict";

import React from 'react';
import DOM from 'react-dom';
import marked from 'marked';
import { api } from "os-npm-util";

const Header = require('./Header.jsx');

require("../style/Markdown.less")

class Markdown extends React.Component {

    static defaultProps = { };

    constructor(props) {
        super(props)
        this.state = {
            markdown: "",
            mdfiles: []
        }
        this.renderMarkdownDir = this.renderMarkdownDir.bind(this);
        this.renderMarkdown = this.renderMarkdown.bind(this);
        this.getMarkdown = this.getMarkdown.bind(this);
        this.buffToString = this.buffToString.bind(this);
    }

    componentDidMount() {
        let url = location.pathname
        this.renderMarkdownDir();
        this.renderMarkdown(url)
    }

    componentWillReceiveProps(nextProps) {
    }

    renderMarkdownDir() {
        api.get(`/mddir`, (res) => {
            if(res.status) {
                this.setState({mdfiles: res.body});
            }
            else {
                console.log("Err fetching readmeDir");
            }
        })
    }

    renderMarkdown(url) {
        url === "/" ? url = "/Home" : ""
        url = `/md${url}`.replace(".md", "");
        this.getMarkdown(url, (data) => {
            this.setState({
                markdown: data,
            }, () => {
                let formattedHash = location.hash.replace(/%20/g, "-").replace("#", "").toLowerCase();
                formattedHash ? document.getElementById(formattedHash).scrollIntoView() : ""
            })
        })
    }

    getMarkdown(url, callback) {
        api.get(url, (res) => {
            if(res.status) {
                let buff = new Buffer(res.data.data)
                let str = this.buffToString(buff)
                let markedDownData = marked.parse(str)
                callback(markedDownData)
            }
            else {
                console.log("Err fetching markdown");
            }
        })
    }

    // Handles large strings - More of a reference here and TextDecoder doesnt work in edge apparent
    buffToString(buffer) {
        var bufView = new Uint16Array(buffer);
        var length = bufView.length;
        var result = '';
        var addition = Math.pow(2,16)-1;
        for(var i = 0; i < length; i += addition){
            if(i + addition > length){
                addition = length - i;
            }
            result += String.fromCharCode.apply(null, bufView.subarray(i,i+addition));
        }
        return result;
    }

    render() {

        let mdfiles = this.state.mdfiles.map((file, i) => {
            return (
                <div key={i} className={"filename"}>
                    <a href={`/${file}`}>{file}</a>
                </div>
            )
        })

        let TOC = this.state.markdown ? this.state.markdown.matchAll(/h1 id="(.+)">(.+)</g) : [];
        let links = Array.from(TOC, (header, i) => {
            return (
                <div key={i} className={"header-toc"}>
                    <a href={`#${header[1]}`}>{header[2]}</a>
                </div>
            )
        })

        return (
            <div id="component-markdown">
                <Header />

                <div id="markdown-container">
                    <div id="filenav" className={"sidebars"}>
                        <span>Topics:</span>
                        {mdfiles}
                    </div>
                    <div id="markdown" dangerouslySetInnerHTML={{__html: this.state.markdown}} />
                    <div id="toc" className={"sidebars"}>
                        <span>Table of Contents</span>
                        {links}
                    </div>
                </div>

            </div>
        );
    }

}

module.exports = Markdown

