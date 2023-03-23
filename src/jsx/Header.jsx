'use strict';

import React, { useEffect, useState, useCallback } from 'react';

import NavBar from "./NavBar.jsx"
//const TodoList = require("./TodoList.jsx")

import "../style/Header.less"

const Header = function(props) {
    const { theme = "" } = props
    const [activity, setActivity] = useState([])

    useEffect(() => {
        getActivity()
        return () => activity.length === 0 && controller.abort(); 
    }, [])

    const controller = new AbortController();
    const signal = controller.signal;
    const catchAbort = (e) => {
        if (e.name === 'AbortError') { console.log(`Header aborted fetch`) }
    }

    const getActivity = useCallback(() => {
        let baseUrl = "https://gitlab.codeopensrc.com"
        let baseApiUrl = `${baseUrl}/api/v4`
        let activityLinks = [];
        fetch(`${baseApiUrl}/users/kc/events?action=pushed&per_page=40`, {signal})
        .then((res) => res.json()).then((actions) => {
  
            let pushes = actions.filter((action) => {
                return action.push_data && action.push_data.ref_type !== "tag" && action.action_name !== "deleted"
                  && (action.push_data.ref === "master" || action.push_data.ref === "main" || action.push_data.ref === "stable")
            })
            pushes.splice(12)
  
            fetch(`${baseApiUrl}/projects?order_by=last_activity_at`, {signal})
            .then((res) => res.json()).then((projects) => {
  
                let commitDate = "";
                pushes.forEach((action, ind) => {
  
                    let projectId = action.project_id;
                    let commit = action.push_data.commit_to;
  
                    let project = projects.filter((project) => project.id === projectId)
                    let projectNamespace = project[0].path_with_namespace
                    let projectUrl  = `${baseUrl}/${projectNamespace}`
                    let commitUrl = `${projectUrl}/-/commit/${commit}`;
  
                    let date = new Date(action.created_at);
                    let dateStr = `${date.getMonth()+1}-${date.getDate()}-${date.getFullYear()}`
                    let separator = null;
                    if(dateStr !== commitDate) {
                        commitDate = dateStr;
                        separator = <span className={"sep"} key={`${ind}-sep`}>{dateStr}</span>
                    }
  
                    let row = (<div className={`activityRow`} key={ind}>
                        <span className={"commit"}>
                            <a href={commitUrl} target="_blank">{commit.slice(0, 5)}</a>
                        </span> -
                        <span className={"namespace"}>
                            <a href={projectUrl} target="_blank">{projectNamespace}</a>
                        </span>
                    </div>)
  
                    if(separator) { activityLinks.push(separator); }
                    activityLinks.push(row)
                })
                setActivity(activityLinks);
            })
            .catch(catchAbort)
        }).catch(catchAbort)
    }, [])




        // <TodoList />
        // <div id="extraContainer">
        //     <iframe allowTransparency frameBorder='0' height='454' scrolling='no' src='https://www.strava.com/clubs/583986/latest-rides/bb1400370c725672385d2d8d0cba54b3fc9a4283?show_rides=true' width='300'></iframe>
        // </div>
//            <div id="logo">
//                    <h3>
//                        <span className={"headertxt"}>code</span>: <span className={"headertxt"} >opensrc</span>
//                    </h3>
//                </div>


    let linkStyle = window.innerWidth < 1000 ? { top: '-.2em'} : {};
    let githublogo = "/images/GitHub.png"
    theme === "dark" ? githublogo = "/images/github-light-tiny.png" : ""
    let gistlogo = "/images/github-gist-logo.png"
    theme === "dark" ? gistlogo = "/images/github-gist-logo-light.png" : ""

    return (
        <div id="header">

            <NavBar />

            <div id="welcome">
                <span className={"name"}>Casey Jones</span>
                <span>Software Dev</span>
                <a href="https://gitlab.codeopensrc.com/explore?sort=latest_activity_desc" target="_blank">
                    <img className={"gitlabIcon mysocialicons"} src="/images/gitlab-icon-rgb-tiny.png" alt="Gitlab"/>
                </a>
                <a href="https://github.com/codeopensrc?tab=repositories" target="_blank">
                    <img className={"githubIcon mysocialicons"} src={githublogo} alt="Github"/>
                </a>
                <a href="https://gist.github.com/codeopensrc" target="_blank">
                    <img className={"gistIcon mysocialicons"} src={gistlogo} alt="Gist"/>
                </a>
                <div className={"dashboard"}>
                    <a href={"https://gitlab.codeopensrc.com/-/grafana/dashboard/snapshot/k6hamID49jbce4VCFvXE1oWtWQxctITf?orgId=0"} target="_blank">
                    Sample Dashboard
                    <img src="/images/grafana.png" height="30" />
                    </a>
                </div>
            </div>
           <div id="latestActivity">
                <h3>Latest Public Activity</h3>
                {activity}
               <h4><a href={"https://gitlab.codeopensrc.com/users/kc/activity"} target="_blank">More</a></h4>
            </div>
        </div>

    );
};

export { Header as default };
