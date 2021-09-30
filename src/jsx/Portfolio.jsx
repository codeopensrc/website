"use strict";

const Header = require('./Header.jsx');
const Footer = require('./Footer.jsx');
const Project = require('./Project.jsx');
const PortfolioTools = require('./PortfolioTools.jsx');

const React = require('react');

require("../style/Portfolio.less")

const Portfolio = React.createClass({
    getInitialState: function() {
        return {
            projects: [
                {imgsrc: "", thumbnail: "", name: "techx.us", link: "https://portfolio.cjones.tk/techx.us", giturl: "", description: ""},
                {imgsrc: "", thumbnail: "", name: "techx.cu.cc", link: "https://portfolio.cjones.tk/techx.cu.cc", giturl: "", description: ""},
                {imgsrc: "", thumbnail: "", name: "darkwater.cu.cc", link: "https://portfolio.cjones.tk/darkwater.cu.cc", giturl: "", description: ""},
                {imgsrc: "", thumbnail: "", name: "ruefilms.cu.cc", link: "https://portfolio.cjones.tk/ruefilms.cu.cc", giturl: "", description: ""}
            ],
            viewing: false,
            currentProject: 0
        };
    },

    componentDidMount: function() {

    },

    render: function() {

        // Main page should list tools currently using/able to use
        // Nav bar... maybe categorize into Websites, Apps, Repos & Tools?
        // Then show thumbnails for each project under that category
        // Seperate out each category as its own React component do differentiate
        // ie, slide show for Website, Download / gifs of Apps, example usage for Tools

        // Random idea, transition between categories -
        // white page with transparent "ball" growing and shrinking

        let CurrentPage = PortfolioTools;
        this.state.viewing && (currentPage = Project);

        let thumbnails = this.state.projects.map((project, i) => {
            return <div key={i} className="nav-thumbnail">{project.name}</div>
        })

        return (
            <div>
                <Header />
                <div id="portfolio">
                    <h1>Portfolio</h1>
                    <div id="portfolio-nav">
                        {thumbnails}
                    </div>
                    <CurrentPage />
                    <Project imgsrc=""
                        name=""
                        link=""
                        giturl=""
                        description=""
                    />
                </div>
                <Footer />
            </div>
        );
    }

});

module.exports = Portfolio;
