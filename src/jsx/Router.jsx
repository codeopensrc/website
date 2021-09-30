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

  render: function () {

    let Component = null;
    let path = location.pathname.split('/')[1];
    let host = location.hostname;

    switch(path) {
      case "posts": Component = <FullPost />;
      break;
      case "portfolio": Component = <Portfolio />;
      break;
      case "chat": Component = <MsgBox />;
      break;
      case "games": Component = <Games baseAssetFolder={"unity"}/>
      break;
      case "blog": Component = <Home />;
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
