/* global require, module, __dirname */
const path = require("path"); // eslint-disable-line @typescript-eslint/no-var-requires

module.exports = {
  entry: "./src/main.ts",
  module: {
    rules: [
    ]
  },
  resolve: {
    extensions: [ ".ts", ".js",  ".vue", ".json" ],
    alias: {
      "vue$": "vue/dist/vue.esm.js",
      "@components": path.resolve(__dirname, "src/components/"),
      "@plugins": path.resolve(__dirname, "src/components/plugins/"),
      "@cards": path.resolve(__dirname, "src/components/cards/"),
      "@modals": path.resolve(__dirname, "src/components/modals/"),
      "@general": path.resolve(__dirname, "src/components/general/"),
      "@dialogs": path.resolve(__dirname, "src/components/dialogs/"),
      "@page-elements": path.resolve(__dirname, "src/components/page-elements/"),
      "@helpers": path.resolve(__dirname, "src/components/helpers/"),
      "@proxy": path.resolve(__dirname, "src/components/proxy-components/"),
      "@inserts": path.resolve(__dirname, "src/components/inserts/"),
      "@assets": path.resolve(__dirname, "src/assets/"),
      "@views": path.resolve(__dirname, "src/views/"),
      "@json": path.resolve(__dirname, "src/json/"),
      "@js": path.resolve(__dirname, "src/js/"),
      "@mixins": path.resolve(__dirname, "src/mixins/"),
      // DND stuffs
      "@dnd": path.resolve(__dirname, "src/components/inserts/dnd/"),
      // JS Modules
      "@filters": path.resolve(__dirname, "src/js/filters.ts"),
      "@cookies": path.resolve(__dirname, "src/js/cookies.ts"),
      "@charts": path.resolve(__dirname, "src/js/charts.js"),
      "@user": path.resolve(__dirname, "src/js/user.ts"),
      "@chartjs": path.resolve(__dirname, "src/components/charts/"),
      "@vuetify": path.resolve(__dirname, "./node_modules/vuetify/")
    }
  },
  plugins: [
  ],
  optimization: {
    runtimeChunk: true,
    splitChunks: {
      chunks: "all",
      minSize: 10000,
      minChunks: 2,
      maxAsyncRequests: 20,
      maxInitialRequests: 10,
      enforceSizeThreshold: 50000,
      cacheGroups: {
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  }
};