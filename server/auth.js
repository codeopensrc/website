"use strict";

const url = require("url")
const { auth } = require("os-npm-util/server");

const AUTH_URL = process.env.AUTH_URL || ""
const AUTH_PROTO = AUTH_URL ? url.parse(AUTH_URL).protocol : ""
const AUTH_PORT = AUTH_PROTO === "https:" ? "443" : "80"
const AUTH_DOMAIN = AUTH_URL && AUTH_URL.match(/([\w]+)\.[\w]+$/)
    ? AUTH_URL.match(/([\w]+)\.[\w]+$/)[0]
    : ""

auth.URL = AUTH_URL ? `${AUTH_PROTO}//auth.${AUTH_DOMAIN}:${AUTH_PORT}` : "";
auth.USE_AUTH = AUTH_URL !== "";

module.exports = auth
