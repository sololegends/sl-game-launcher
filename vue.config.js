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
      extends: null,
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
          maintainer: "Sololegends",
          category: "Game",
          target: [
            "deb",
            "rpm",
            "pacman"
          ]
        },
        publish: {
          provider: "generic",
          url: "https://updates.sololegends.com/electron/SL Game Launcher/win",
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
