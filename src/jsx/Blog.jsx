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
            this.setState({posts: data}, () => this.props.updateSnippetScripts())
        })
    },

    deletePost: function (e) {
        let id = e.props.id;
        let key = localStorage.getItem("key")
        $.post("/ajaxDelete", JSON.stringify({id: id, storageKey: key}))
        .done(() => { this.getPosts(); })
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
