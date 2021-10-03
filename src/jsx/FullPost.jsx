'use strict';

const Footer = require('./Footer.jsx');
const Header = require('./Header.jsx');

const React = require('react');

const replaceCode = require("../js/replaceCode.js");

require("../style/FullPost.less")

const Fullpage = React.createClass({

  getInitialState: function() {
    return {
      title: '',
      message: '',
      date: '',
      id : '',
      url: ''
    };
  },

  componentDidMount: function() {
    this.getSinglePost();
    replaceCode();
  },

  getSinglePost: function() {
    let path = location.pathname;

    $.post("/ajaxGetFullPost", JSON.stringify({url: path}), (data) => {
        this.setState({
            title: data.title,
            message: data.message,
            date: data.date,
            id: data._id,
            url: data.url
        }, () => {
            $(window).scrollTop(0);
            this.props.updateSnippetScripts()
        });
    }, "json");

  },


  render: function() {

    document.title = "Post";

    let messageFormatted = this.state.message.replace(/\n/g, "<br>");

    return (

      <div>
        <Header />
        <div id="fullPost">
          <div key={this.props.id} id={this.props.id} className="post">
            <div className="postTitle">
              <a href={this.state.url} target="_blank">
                {this.state.title}
              </a>
            </div>
            <div className="postDate">
              {this.state.date}
            </div>
            <div className="postBody"
                dangerouslySetInnerHTML={{__html: messageFormatted}}>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

});

module.exports = Fullpage;
