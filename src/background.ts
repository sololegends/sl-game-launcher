"use strict";
import { app, BrowserWindow, ipcMain, protocol } from "electron";
import initConfig, { APP_URL_HANDLER, getConfig } from "./plugins_bkg/config";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import { createSplashWindow } from "./plugins_bkg/auto_update";
import { ensureDir } from "./plugins_bkg/tools/files";
import exeInfo from "win-version-info";
import load from "./plugins_bkg";
import logging from "./plugins_bkg/logging";
const isDevelopment = process.env.NODE_ENV !== "production";

app.setAsDefaultProtocolClient(APP_URL_HANDLER);
const argsv = process.argv.slice(1);

let _win = undefined as undefined | BrowserWindow;
const got_lock = app.requestSingleInstanceLock(argsv);
// Parse out the command line args
export type AppOptions = {
  fullscreen: boolean
  maximize: boolean
  alt_feed: string
  data_folder: string
  skip_update: boolean
  version: boolean

  // Single Processes
  read_exe: string

  // Catch all
  [key: string]: string | boolean | number
}

export const cli_options = {
  fullscreen: false,
  maximize: false,
  data_folder: "gog-viewer",
  skip_update: false
} as AppOptions;

if(argsv.length > 0){
  for(const part of argsv){
    const key_val = part.split("=");
    if(key_val.length === 1){
      cli_options[key_val[0].replace("-", "_")] = true;
      continue;
    }
    cli_options[key_val[0].replace("-", "_")] = key_val[1];
  }
}
if(cli_options.read_exe){
  console.log(exeInfo(cli_options.read_exe));
  app.quit();
}
if(cli_options.version){
  console.log("Version: v" + app.getVersion());
  app.quit();
}
console.log("cli_options", cli_options);
const is_fullscreen = cli_options.fullscreen;
const is_maximize = cli_options.maximize;
export const app_data_dir = app.getPath("appData") + "\\sololegends\\" + cli_options.data_folder + "\\";

if (!got_lock){
  app.quit();
} else {
  app.whenReady().then(() => {
    if(is_fullscreen){
      _win?.maximize();
      _win?.setFullScreen(true);
    }else if(is_maximize){
      _win?.maximize();
    }
    app.on("second-instance", (event, commandLine, workingDirectory, args) => {
      let url_data = undefined;
      for(const ele of args as string[]){
        if(ele.startsWith(APP_URL_HANDLER)){
          url_data = ele.substring(APP_URL_HANDLER.length + 3);
          url_data = url_data.substring(0, url_data.lastIndexOf("/"));
        }
      }
      // Someone tried to run a second instance, we should focus our window.
      if (_win){
        if(url_data){
          _win.webContents.send("launch-game-from-url", url_data);
        }
        if (_win.isMinimized()){ _win.restore(); }
        _win.focus();
      }
    });
  });
}

export function isDev(){
  return app.isPackaged !== true;
}

// Ensure the data dir is intact
ensureDir(app_data_dir);

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true } }
]);

async function createWindow(){
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    frame: false,
    backgroundColor: "#424242",
    titleBarStyle: "hidden",
    titleBarOverlay: false,
    fullscreen: is_fullscreen,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: (process.env
        .ELECTRON_NODE_INTEGRATION as unknown) as boolean,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION
    }
  });
  _win = win;

  ipcMain.on("gog-path-change", (e, value) => {
    win?.webContents.send("gog-path-change", value);
  });

  win.on("maximize", () => {
    win?.webContents.send("win-maximize");
  });
  win.on("blur", () => {
    win?.webContents.send("win-restore");
  });

  win.on("focus", () => {
    win?.webContents.send("win-focus");
  });
  win.on("blur", () => {
    win?.webContents.send("win-blur");
  });
  ipcMain.on("minimize", () => {
    win?.minimize();
    win?.webContents.send("win-minimize");
  });

  ipcMain.on("maximize", () => {
    win?.maximize();
    win?.webContents.send("win-maximize");
  });

  ipcMain.on("win-restore", () => {
    win?.restore();
    win?.webContents.send("win-restore");
  });

  // Load all the modules
  load(ipcMain, win);

  if (process.env.WEBPACK_DEV_SERVER_URL){
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL + "#/games");
    if (!process.env.IS_TEST){ win.webContents.openDevTools(); }
  } else {
    createProtocol("app");
    // Load the index.html when not in development
    await win.loadURL("app://./index.html#/games");
  }
  return win;
}

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // To stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin"){
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // Dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0){ createWindow(); }
});

// This method will be called when Electron has finished
// Initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async() => {
  if (isDevelopment && !process.env.IS_TEST){
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS);
    } catch (e: unknown){
      console.error("Vue Devtools failed to install:", e);
    }
  }
  // Load the config module
  logging();
  await initConfig(ipcMain, app_data_dir);
  if(isDevelopment || cli_options.skip_update || getConfig("offline")){
    createWindow();
    return;
  }
  // If not dev run the updater now
  const splash = createSplashWindow();
  console.log("Awaiting go to main menu...");
  ipcMain.on("goto-main-window", async() => {
    (await splash).close();
    createWindow();
  });
});

// Register ipc
ipcMain.on("quit", () => {
  console.log("Quitting...");
  app.quit();
  app.exit();
});
ipcMain.on("relaunch", () => {
  console.log("relaunching...");
  app.relaunch();
  app.quit();
  app.exit();
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment){
  if (process.platform === "win32"){
    process.on("message", (data) => {
      if (data === "graceful-exit"){
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}
