
import * as child from "child_process";
import { app, BrowserWindow, dialog, IpcMain } from "electron";
import { ensureDir, getFolderSize, normalizeFolder } from "./tools/files";
import z_cfg_init, { getOS } from "./config";
import fs from "fs";
import { Notify } from "@/types/notification/notify";
import z_autoupdate from "./auto_update";
import z_cache from "./cache";
import z_cloud_saves from "./cloud_saves";
import z_game_dl_install from "./game_dl_install";
import z_game_loader from "./game_loader";
import z_gc_init from "./game_control";
import z_logging from "./logging";
import z_play_time_tracker from "./play_time_tracker";
import z_process_cloud from "./process_cloud";
import z_sys_notifications from "./sys_notifications";
import z_webdav_init from "./nc_webdav";

const fns = [
  z_logging,
  z_cfg_init,
  z_sys_notifications,
  z_cache,
  z_play_time_tracker,
  z_gc_init,
  z_webdav_init,
  z_game_loader,
  z_process_cloud,
  z_game_dl_install,
  z_autoupdate,
  z_cloud_saves
];


export type Globals = {
	app_dir: string
	ensureDir: (dir: string) => void
  normalizeFolder: (path: string) => string
	notify: (options: Notify.Alert) => void
  getFolderSize: (folder: string) => number
  log: (log: string) => void
}

const globals = {
  app_dir: app.getPath("appData") + "\\sololegends\\gog-viewer\\",
  ensureDir: ensureDir,
  normalizeFolder: normalizeFolder,
  getFolderSize: getFolderSize,
  log: (log: string) => {
    console.log(log);
    // TODO: Do the file logging
  }
} as Globals;

globals.ensureDir(globals.app_dir);

export default function init(ipcMain: IpcMain, win: BrowserWindow){
  globals.notify = (options: Notify.Alert) => {
    win?.webContents.send("notify", options);
  };

  // Init the different modules here
  for(const i in fns){
    fns[i](ipcMain, win, globals);
  }

  ipcMain.on("open-folder", (e, path: string) => {
    path = path.replaceAll("[&|;:$()]+", "");
    const os = getOS();
    switch(os){
    case "windows": path = path.replaceAll("/", "\\"); break;
    case "linux": path = path.replaceAll("\\", "/"); break;
    default: break;
    }
    console.log("Opening path:", path);
    if(fs.existsSync(path)){
      child.exec("explorer.exe " + path);
    }
  });

  ipcMain.handle("browse-folder", async() => {
    return await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
  });
}