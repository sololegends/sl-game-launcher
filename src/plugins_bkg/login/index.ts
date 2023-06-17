import { BrowserWindow, ipcMain } from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import { init as initBackplane} from "../backplane";


export default function init(){
  // Nothing here
}

export async function createLoginWindow(){
  // Create the browser window.
  const login = new BrowserWindow({
    width: 500,
    height: 400,
    frame: true,
    resizable: false,
    fullscreenable: false,
    backgroundColor: "#424242",
    titleBarStyle: "hidden",
    titleBarOverlay: false,
    transparent: true,
    alwaysOnTop: false,
    roundedCorners: true,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: (process.env
        .ELECTRON_NODE_INTEGRATION as unknown) as boolean,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION
    }
  });

  // Init the handlers
  init();
  initBackplane(ipcMain, login);

  if (process.env.WEBPACK_DEV_SERVER_URL){
    // Load the url of the dev server if in development mode
    console.log("loading: ", process.env.WEBPACK_DEV_SERVER_URL + "#/login");
    await login.loadURL(process.env.WEBPACK_DEV_SERVER_URL + "#/login");
  } else {
    createProtocol("app");
    // Load the index.html when not in development
    await login.loadURL("app://./index.html#/login");
  }
  login.center();
  return login;
}