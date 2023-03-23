'use strict';

import React from 'react';
import { Link } from 'react-router-dom';

const NavBar = function(props) {
    return (
        <div id="navBar">
            <Link to={"/"} className={"navBtn"}>Home</Link>
            <Link to={"/games"} className={"navBtn"}>Games</Link>
            {/* <Link to={"/chat"} className={"navBtn"}>Chat</Link> */}
            {/* <Link to={"/blog"} className={"navBtn"}>Blog</Link> */}
        </div>
    );
};

export { NavBar as default };
