'use strict';

const React = require('react');

const Input = React.createClass({

  getInitialState: function() {
    let time = new Date().toLocaleTimeString();
    let date = new Date().toLocaleDateString();
    let storObj = JSON.parse(localStorage.getItem('storage')) || '';
    let message = storObj.message || '';
    let title = storObj.title || '';
    let postdate = storObj.date || date+" "+time;
    let id = storObj.id || "";
    let post = {title: title, message: message, date: postdate, id: id}
    return {
      validation: false,
      button: id ? "editPost" : "submitPost",
      post: post
    };
  },

  componentWillReceiveProps: function (nextProps) {
    if(!nextProps.post || !nextProps.post.id) { return; }
    let post = {
        title: nextProps.post.title,
        message: nextProps.post.message,
        date: nextProps.post.date,
        id: nextProps.post.id
    }
    this.setState({
        post: post,
        button: "editPost"
    })
  },

  checkHandler: function (e) {
    e.preventDefault();
    let id = $(e.target).attr("id");
    id === "submitPost" && this.handleSubmit(e)
    id === "editPost" && this.handleEdit(e);
  },


    validate: function () {
        if(this.state.post.title === '' || this.state.post.message === '') {
            this.setState({ validation: true })
            return false;
        }
        localStorage.removeItem("storage");
        return true;
    },

  handleEdit: function (e) {
    e.preventDefault();
    if(!this.validate()) { return };
    let key = localStorage.getItem("key")
    $.post("/ajaxEdit", JSON.stringify({post: this.state.post, storageKey: key}))
    .done(() =>{
        this.setState({
            validation: false,
            button: "submitPost",
            post: {message: "", title: "", id: ""}
        }, () => {
            this.props.clearEdit();
            this.props.update();
        })
    })
  },

  handleSubmit: function (e) {
    e.preventDefault();
    if(!this.validate()) { return };
    let post = this.state.post;
    let time = new Date().toLocaleTimeString();
    let date = new Date().toLocaleDateString();
    post.date = date+" "+time;
    let key = localStorage.getItem("key")
    $.post("/ajaxNew",JSON.stringify({post: post, storageKey: key}))
    .done(() => {
        let time = new Date().toLocaleTimeString();
        let date = new Date().toLocaleDateString();
        let postdate = date+" "+time;
        this.setState({
            post: {message: "", title: "", id: "", date: postdate},
            validation: false
        }, () => {
            this.props.update();
        })
    })
  },

  handleChange: function () {
    let post = {
      title: document.querySelector('.postTitleInput').value,
      message: document.querySelector('.postBodyInput').value,
      date: this.state.post.date,
      id: this.state.post.id
    }
    let storage = { "title": post.title, "message": post.message,
        id: this.state.post.id, date: this.state.post.date};
    localStorage.setItem("storage", JSON.stringify(storage));
    this.setState({post});
  },

  clearPost: function () {
    localStorage.removeItem("storage");
    this.setState({
        post: {title: "", message: "", id: ""},
        button: "submitPost"
    });
  },


  render: function() {
    let validator = <div className="validate">Please fill in all fields</div>
    !this.state.validation && (validator = null);

    return (
      <div>
        <div className="post" id={this.state.post.id}>
          {validator}
          <div className="postTitle">
            <input className="postTitleInput" placeholder="Title" type="text"
              onChange={this.handleChange} value={this.state.post.title}/>
          </div>
          <div className="postDate">
            {this.state.post.date}
          </div>
          <div className="postBody">
            <textarea className="postBodyInput" placeholder="Message.."
              onChange={this.handleChange} value={this.state.post.message}/>
          </div>
          <button id={this.state.button} onClick={this.checkHandler}>Submit post</button>
          <button id="clear" onClick={this.clearPost}>Clear</button>
        </div>
      </div>

    );
  }

});

module.exports = Input;
