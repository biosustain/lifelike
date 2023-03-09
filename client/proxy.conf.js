const process = require("process");

const ENVIRONMENT_CONFIG = process.env.ENVIRONMENT_CONFIG || "development";
const APPSERVER_UPSTREAM = process.env.APPSERVER_UPSTREAM || "http://appserver:5000";

const PROXY_CONFIG = [
  {
    context: ["/api"],
    target: APPSERVER_UPSTREAM,
    secure: false,
    pathRewrite: {
      "^/api": "",
    },
    changeOrigin: true,
    logLevel: "debug",
  },
  {
    context: ["/environment.css"],
    target: "http://localhost:4200",
    pathRewrite: {
      "^/environment.css$": `/environments/${ENVIRONMENT_CONFIG}.css`,
    },
  },
  {
    context: ["/env.js"],
    target: "http://localhost:4200",
    pathRewrite: {
      "^/env.js$": `/environments/${ENVIRONMENT_CONFIG}.js`,
    },
  },
];
module.exports = PROXY_CONFIG;
