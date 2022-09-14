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
      nodeIntegration: true,
      builderOptions: {
        appId: "com.sololegends.launcher",
        productName: "SL Game Launcher",
        win: {
          publisherName: "Sololegends",
          icon: "icon.ico",
          verifyUpdateCodeSignature: false
        },
        nsis: {
          installerIcon: "icon.ico",
          uninstallerIcon: "icon.ico"
        },
        linux: {
          icon: "icon.png",
          category: "Game"
        },
        publish: {
          provider: "generic",
          url: "https://test.sololegends.com/tools/public/updates/gamelauncher/",
          channel: "latest"
        }
      }
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
