
import { autoUpdater, ProgressInfo, UpdateCheckResult, UpdateDownloadedEvent, UpdateInfo } from "electron-updater";
import { BrowserWindow, ipcMain, IpcMain } from "electron";
import { cli_options } from "../background";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";

export default function init(ipcMain: IpcMain, splash: BrowserWindow){

  // Load
  if(cli_options.alt_feed){
    autoUpdater.setFeedURL({
      provider: "generic",
      url: "https://test.sololegends.com/tools/public/updates/gamelauncher/"
    });
  }

  autoUpdater.autoDownload = false;
  autoUpdater.disableWebInstaller = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for update...");
  });
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    console.log("Update available: " + info);
    splash.webContents.send("update-available", info);
  });
  autoUpdater.on("update-not-available", () => {
    console.log("Update not available");
    splash.webContents.send("update-not-available");
  });
  autoUpdater.on("error", (err) => {
    console.log("Update err: " + err);
    splash.webContents.send("notify", {
      title: "Error in auto-updater",
      text: err.message,
      type: "error"
    }, "bell_alerts");
  });
  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    console.log("Update progress: " + progress);
    splash.webContents.send("download-progress", progress);
  });
  autoUpdater.on("update-downloaded", (info: UpdateDownloadedEvent) => {
    console.log("Update downloaded: " + info);
    splash.webContents.send("update-downloaded", info);
  });

  ipcMain.handle("check-for-update", (): Promise<UpdateCheckResult | null> => {
    console.log("Check for update triggered...");
    return autoUpdater.checkForUpdates();
  });
  ipcMain.handle("download-update", (): Promise<UpdateCheckResult | null> => {
    console.log("Update download triggered...");
    return autoUpdater.downloadUpdate();
  });
  ipcMain.on("install-update", () => {
    console.log("Install triggered...");
    autoUpdater.quitAndInstall();
  });
}

export async function createSplashWindow(){
  // Create the browser window.
  const splash = new BrowserWindow({
    width: 350,
    height: 100,
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
  init(ipcMain, splash);

  if (process.env.WEBPACK_DEV_SERVER_URL){
    // Load the url of the dev server if in development mode
    console.log("loading: ", process.env.WEBPACK_DEV_SERVER_URL + "#/splash");
    await splash.loadURL(process.env.WEBPACK_DEV_SERVER_URL + "#/splash");
  } else {
    createProtocol("app");
    // Load the index.html when not in development
    await splash.loadURL("app://./index.html#/splash");
  }
  splash.center();
  return splash;
}