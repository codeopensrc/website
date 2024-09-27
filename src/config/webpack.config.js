"use strict";

const path = require("path")
const webpack = require('webpack');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const LIVE_RELOADER_PORT = process.env.LIVE_RELOADER_PORT || 5055

let plugins = [ new HtmlWebpackPlugin({
        template: "./src/html/template.html",
        filename: "index.html",
        hash: true
    }),
    //For native node modules in the browser
    new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
    }),
]

let webpack_mode = process.argv.indexOf("--optimization-minimize") > -1 ? "production" : "development"

module.exports = [{
    mode: `${webpack_mode}`,
    //target: ["node14"],
    plugins: plugins,
    watchOptions: {
        poll: 500,
        aggregateTimeout: 400,
    },
    entry: {
        app: [ "./src/config/globals.js", "./src/config/polyfills.js", "./src/jsx/Entry.jsx"]
    },
    output: {
        path: path.resolve(__dirname, "../../pub"),
        publicPath: "",
        filename: "[name].bundle.js",
        //assetModuleFilename: "assets/[name][ext][query]"
    },
    module: {
        //unsafeCache: true,
        rules: [
            {test: /\.(svg|png|jpe?g|ico)/, type: "asset", generator: {filename: "assets/images/[name][ext][query]"}},
            {test: /\.(svg|png|jpe?g|ico)/, type: "asset", generator: {filename: "style/images/[name][ext][query]"}},
            {test: /\.less/, use: ["style-loader", "css-loader", "less-loader"] },
            {test: /\.json/, use: ["json-loader"] },
            {test: /\.jsx/, use: {loader: "babel-loader",  options: {presets: ["@babel/preset-react"], plugins: ["react-hot-loader/babel"] }}},
            {test: /\.js/, use: {loader: "babel-loader", options: {presets: ["@babel/preset-react"] }}},
        ]
    },
    // Runs hot reloading server when using `webpack serve`
    devServer: {
        allowedHosts: "all",
        host: "0.0.0.0",
        port: LIVE_RELOADER_PORT,
        hot: true,
        historyApiFallback: true,
        setupExitSignals: true,
        proxy: [{
            context: ["/api"],
            target: `http://localhost` 
        }],
        static: [
            { directory: path.resolve(__dirname, '../../server/static') },
            { directory: path.resolve(__dirname, '../../pub') }
        ],
        client: { webSocketURL: `auto://0.0.0.0:0/ws` },
        // Uncomment to reload page on changes to server/
        //watchFiles: {
        //    paths: ["server"],
        //    options: { ignored: ["server/bin", "server/output", "server/static", "server/.*"] }
        //}
    },
    //For native node modules in the browser
    resolve: {
        fallback: {
            "buffer": require.resolve("buffer/")
        }
    },
}]
