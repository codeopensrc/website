"use strict";

import React, { useEffect, useState, useCallback } from 'react';
import marked from 'marked';
import { api } from "os-npm-util/client";

import Header from "./Header.jsx"

import "../style/Markdown.less"

const Markdown = function(props) {
    //const { } = props
    const [markdown, setMarkdown] = useState("")
    const [mdfiles, setMdfiles] = useState([])

    useEffect(() => {
        let url = location.pathname
        //renderMarkdownDir();
        renderMarkdown(url)
        return api.abortAllRequests
    }, [])


    const renderMarkdownDir = () => {
        api.get(`/mddir`, (res) => {
            if(res.status) {
                setMdfiles(res.body)
            }
            else {
                console.log("Err fetching readmeDir");
            }
        })
    }

    const renderMarkdown = (url) => {
        url === "/" ? url = "/Home" : ""
        url = `/md${url}`.replace(".md", "");
        getMarkdown(url, (data) => {
            setMarkdown(data)
            let formattedHash = location.hash.replace(/%20/g, "-").replace("#", "").toLowerCase();
            formattedHash ? document.getElementById(formattedHash).scrollIntoView() : ""
        })
    }

    const getMarkdown = (url, callback) => {
        api.get(url, (res) => {
            if(res.status) {
                let buff = new Buffer(res.data.data)
                let str = buffToString(buff)
                let markedDownData = marked.parse(str)
                callback(markedDownData)
            }
            else {
                console.log("Err fetching markdown");
            }
        })
    }

    // Handles large strings - More of a reference here and TextDecoder doesnt work in edge apparent
    const buffToString = (buffer) => {
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

    let renderMdfiles = mdfiles.map((file, i) => {
        return (
            <div key={i} className={"filename"}>
                <a href={`/${file}`}>{file}</a>
            </div>
        )
    })

    let TOC = markdown ? markdown.matchAll(/h1 id="(.+)">(.+)</g) : [];
    let links = Array.from(TOC, (header, i) => {
        return (
            <div key={i} className={"header-toc"}>
                <a href={`#${header[1]}`}>{header[2]}</a>
            </div>
        )
    })

    //<div id="filenav" className={"sidebars"}>
    //    <span>Topics:</span>
    //    {renderMdfiles}
    //</div>

    return (
        <div id="component-markdown">
            <Header />

            <div id="markdown-container">
                <div id="markdown" dangerouslySetInnerHTML={{__html: markdown}} />
                <div id="toc" className={"sidebars"}>
                    <span>Table of Contents</span>
                    {links}
                </div>
            </div>
        </div>
    );
}

export { Markdown as default };
