"use strict";
import { app, BrowserWindow, ipcMain, protocol, session } from "electron";
import initConfig, { APP_URL_HANDLER, getConfig, setAppDataDir, setConfig } from "./plugins_bkg/config";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
import load, { loadCache, notify } from "./plugins_bkg";
import { parsePE, ParsePEResponse} from "pe-exe-parser";
import { PostScriptResult, processScript } from "./plugins_bkg/script";
import CLI from "./plugins_bkg/tools/cli";
import { createLoginWindow } from "./plugins_bkg/login";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import { createSplashWindow } from "./plugins_bkg/auto_update";
import { getLocalGameData } from "./plugins_bkg/game_loader_fns";
import { GOG } from "./types/gog/game_info";
import logging from "./plugins_bkg/logging";
import { scanAndInstallRedist } from "./plugins_bkg/as_admin/redist/redist";
const isDevelopment = process.env.NODE_ENV !== "production";

app.setAsDefaultProtocolClient(APP_URL_HANDLER);
const argsv = process.argv.slice(1);

let _win = undefined as undefined | BrowserWindow;
const got_lock = app.requestSingleInstanceLock(argsv);
let NO_RUN = false;
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
  run_game_setup: string
  undo: boolean
  script_only: boolean
  game_id_override: string

  // Locking
  sys_locked_allow: boolean

  // Catch all
  [key: string]: string | boolean | number
}

export const cli_options_defaults = {
  fullscreen: false,
  maximize: false,
  data_folder: "gog-viewer",
  skip_update: false,
  sys_locked_allow: false
} as AppOptions;

// Handle cli arguments
export const cli_options = {
  ...cli_options_defaults,
  ...CLI.processCommands(process.argv.slice(1))
};

// Initial options setup
const is_fullscreen = cli_options.fullscreen;
const is_maximize = cli_options.maximize;
if(cli_options.data_folder){
  setAppDataDir(cli_options.data_folder);
}

if(process.env.SL_LAUNCHER_APP_OFF){
  app.quit();
}
console.log("cli_options =", cli_options);
// CLI/Startup options
if(cli_options.read_exe){
  NO_RUN = true;
  parsePE(cli_options.read_exe, {}).then((result: ParsePEResponse) => {
    console.log(result.metadata());
    app.quit();
  });
} else if(cli_options.run_game_setup && !got_lock){
  NO_RUN = true;
  // When running a setup script for another window
  // Load game data
  getLocalGameData(cli_options.run_game_setup, false).then((game : GOG.GameInfo | undefined) => {
    if(game === undefined){
      console.log("GAME_NOT_FOUND");
      app.exit(404);
      return;
    }
    // Run the script
    processScript(game, cli_options.undo, cli_options.game_id_override).then(async(script: PostScriptResult) =>{
      if(!cli_options.game_id_override && !cli_options.script_only){
        // Load config for backend modules
        loadCache();
        await initConfig(undefined);
        scanAndInstallRedist(game).then((redist: boolean | undefined) =>{
          console.log("SETUP_SCRIPT_DONE:", {script, redist});
          app.exit(0);
        });
        return;
      }
      console.log("SETUP_SCRIPT_DONE:", {script});
      app.exit(0);
    });
  });
} else if(cli_options.version){
  NO_RUN = true;
  console.log("Version: " + app.getVersion());
  app.exit(0);
} else if (!got_lock){
  NO_RUN = true;
  app.quit();
} else {
  app.whenReady().then(() => {
    if(is_fullscreen){
      _win?.maximize();
      _win?.setFullScreen(true);
    }else if(is_maximize){
      _win?.maximize();
    }
    app.on("second-instance", (event, argv) => {
      let url_data = undefined;
      console.log("second-instance:", argv);
      for(const ele of argv as string[]){
        if(ele.startsWith(APP_URL_HANDLER)){
          url_data = ele.substring(ele.indexOf("//") + 2);
          if(url_data.endsWith("/")){
            url_data = url_data.substring(0, url_data.length - 1);
          }
          break;
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
  // Scheme must be registered before the app is ready
  protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { secure: true, standard: true } }
  ]);
}

function relaunch(){
  if(NO_RUN){
    return;
  }
  console.log("relaunching...");
  app.relaunch();
  app.quit();
  app.exit();

}

async function createWindow(){
  if(NO_RUN){
    return;
  }
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1000,
    minWidth: 450,
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

  ipcMain.on("go-offline", () => {
    setConfig("offline", true);
    relaunch();
  });

  ipcMain.on("go-online", () => {
    setConfig("offline", false);
    relaunch();
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

  ipcMain.on("open-dev-tools", () => {
    win?.webContents.openDevTools();
  });

  ipcMain.on("window-progress", (e, progress) => {
    win?.setProgressBar(progress);
  });

  ipcMain.on("release-channel-changed", (e, channel) => {
    notify({
      title: "Release Channel Changed",
      text: "You changed the release channel to " + channel + ", restart to complete change",
      type: "info",
      sticky: true,
      action: {
        name: "Restart",
        event: "relaunch"
      }
    });
  });

  // Load all the modules
  load(ipcMain, win);

  if (process.env.WEBPACK_DEV_SERVER_URL){
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL + "#/games");
    if (isDevelopment && !process.env.IS_TEST){ win.webContents.openDevTools(); }
  } else {
    createProtocol("app");
    // Load the index.html when not in development
    await win.loadURL("app://./index.html#/games");
  }
  return win;
}

async function createSystemWindow(){
  if(NO_RUN){
    return;
  }
  // Create the browser window.
  const locked = new BrowserWindow({
    width: 400,
    height: 175,
    frame: false,
    backgroundColor: "#424242",
    titleBarStyle: "hidden",
    titleBarOverlay: false,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: (process.env
        .ELECTRON_NODE_INTEGRATION as unknown) as boolean,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION
    }
  });
  locked.center();
  _win = locked;
  // Load all the modules
  load(ipcMain, locked);

  if (process.env.WEBPACK_DEV_SERVER_URL){
    // Load the url of the dev server if in development mode
    console.log("loading: ", process.env.WEBPACK_DEV_SERVER_URL + "#/locked");
    await locked.loadURL(process.env.WEBPACK_DEV_SERVER_URL + "#/locked");
  } else {
    createProtocol("app");
    // Load the index.html when not in development
    await locked.loadURL("app://./index.html#/locked");
  }
  return locked;
}

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  if(NO_RUN){
    return;
  }
  // On macOS it is common for applications and their menu bar
  // To stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin"){
    app.quit();
  }
});

app.on("activate", () => {
  if(NO_RUN){
    return;
  }
  // On macOS it's common to re-create a window in the app when the
  // Dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0){ createWindow(); }
});

// This method will be called when Electron has finished
// Initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async() => {
  if(NO_RUN){
    return;
  }
  if (isDevelopment && !process.env.IS_TEST){
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS);
    } catch (e: unknown){
      console.error("Vue Devtools failed to install:", e);
    }
  }
  // Allow GOG Web Requests
  const filter = {
    urls: [
      "https://api.gog.com/*",
      "https://www.gog.com/*"
    ]
  };

  session.defaultSession.webRequest.onHeadersReceived(
    filter,
    (details, callback) => {
      if(details.responseHeaders){
        for(const ele in details.responseHeaders){
          if(ele.toLowerCase() === "access-control-allow-origin"){
            details.responseHeaders[ele] = ["*"];
          }
        }
      }
      callback({ responseHeaders: details.responseHeaders });
    }
  );

  // Load the config module
  logging(ipcMain);
  await initConfig(ipcMain);
  if(cli_options.sys_locked_allow === false
      && (getConfig("sys_locked") === "true" || getConfig("sys_locked") === true)
  ){
    console.log("LOADING LOCKED SYSTEM");
    createSystemWindow();
    return;
  }
  if(cli_options.skip_update || getConfig("offline")){
    createWindow();
    return;
  }
  // If not dev run the updater now
  const splash = createSplashWindow();
  console.log("Awaiting go to main...");
  ipcMain.on("goto-main-window", async() => {
    console.log("Going to main window...");
    (await splash).close();
    createWindow();
  });
  ipcMain.on("show-login-window", async(e, msg: string) => {
    console.log("Going to login window...", msg);
    (await splash).close();
    const login = createLoginWindow();
    ipcMain.on("goto-main-window", async() => {
      (await login).close();
      createWindow();
    });
  });
});

// Register ipc
ipcMain.on("quit", () => {
  console.log("Quitting...");
  app.quit();
  app.exit();
});
ipcMain.on("relaunch", relaunch);

// Exit cleanly on request from parent process in development mode.
if (isDevelopment && !NO_RUN){
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
