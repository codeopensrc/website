'use strict';

const Form = require('./Form.jsx');
const ShortPost = require('./ShortPost.jsx');
const React = require('react');

require("../style/Blog.less")

const Blog = React.createClass({

    getInitialState: function () {
        return {
            authKey: "",
            posts: [],
            edit: {}
        }
    },

    componentWillMount: function() {
        this.getPosts();
        let key = localStorage.getItem("key");
        (key === '' || key === null) && localStorage.setItem("key", window.location.search.replace(/\?/gm, ''))
        this.getKey(key);
    },

    componentDidMount: function() { },

    getKey: function(key) {
        $.post("/ajaxAuth", JSON.stringify({storageKey: key}), (data) => {
            this.setState({ authKey: data.storageKey })
        }, "json")
    },

    editPost: function(e) {
        let id = $(e.target).parent().attr('id');
        let key = localStorage.getItem("key")
        $.post("/ajaxGetSingle", JSON.stringify({storageKey: key, id: id}), (data) => {
            let edit = {
                title: data.title,
                message: data.message,
                date: data.date,
                id: data._id
            }
            this.setState({edit});
            $(window).scrollTop(0);
        }, "json")
    },

    sortPostsByDate: function (ascOrDesc, postA, postB) {
        let direction = ascOrDesc === "desc" ? -1 : 1;
        return function(postA, postB) {
            let post1 = new Date(postA.date);
            let post2 = new Date(postB.date);
            if(post1 > post2) { return (1 * direction); }
            if(post1 < post2) { return (-1 * direction); }
            return 0;
        }(postA, postB)
    },

    getPosts: function () {
        $.getJSON("/ajaxGet", (data) => {
            data.sort(this.sortPostsByDate.bind(this, "desc"))
            this.setState({posts: data}, () => this.updateSnippetScripts())
        })
    },

    deletePost: function (e) {
        let id = e.props.id;
        let key = localStorage.getItem("key")
        $.post("/ajaxDelete", JSON.stringify({id: id, storageKey: key}))
        .done(() => { this.getPosts(); })
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

    render: function() {
        document.title = "Blog";

        let posts = this.state.posts.map((post, i) => {
            return (<ShortPost key={i} title={post.title} message={post.message} url={post.url}
                authKey={this.state.authKey} date={post.date} id={post._id}
                editPost={this.editPost} deletePost={this.deletePost}/>
            )
        })

        let input = <Form post={this.state.edit}
            update={this.getPosts} clearEdit={() => {this.setState({edit: null})}}/>

        this.state.authKey !== "accepted" && (input = null);

        return (
            <div id="blog">
                {input}
                {posts}
            </div>
        );
    }

});

module.exports = Blog;
