/* global process, require, module */
const webpack_config = require("./webpack.config.js");

module.exports = {
  publicPath: "/",
  configureWebpack: webpack_config,
  transpileDependencies: [
    "vuetify"
  ],
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true
    }
  },
  devServer: {
    hot: process.env.NODE_ENV !== "production"
  },
  pwa: {
    name: "SL GOG Viewer",
    themeColor: "#1F5487",
    msTileColor: "#171E26"
  }
};
