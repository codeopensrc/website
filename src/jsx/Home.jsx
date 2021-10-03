'use strict';

const Header = require('./Header.jsx');
const Blog = require('./Blog.jsx');
const Footer = require('./Footer.jsx');
const React = require('react');

const replaceCode = require("../js/replaceCode.js");

const Home = React.createClass({
	getIntitialState: function () {
		return {}
	},

	componentDidMount: function() {
        replaceCode();
	},

	render: function() {

    return (
        <div>
			<Header />
			<Blog updateSnippetScripts={this.props.updateSnippetScripts}/>
			<Footer />
		</div>
    );
  }

})

module.exports = Home;
