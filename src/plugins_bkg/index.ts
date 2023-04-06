
import { BrowserWindow, dialog, IpcMain } from "electron";
import { ensureDir, getFolderSize, normalizeFolder } from "./tools/files";
import { appDataDir } from "./config";
import { GOG } from "@/types/gog/game_info";
import { Notify } from "@/types/notification/notify";
import z_cache from "./cache";
import z_cloud_saves from "./cloud_saves";
import z_game_dl_install from "./game_dl_install";
import z_game_loader from "./game_loader";
import z_gc_init from "./game_control";
import z_misc_os from "./misc_os";
import z_play_time_tracker from "./play_time_tracker";
import z_process_cloud from "./process_cloud";
import z_sys_notifications from "./sys_notifications";
import z_update_check from "./update_check";
import z_webdav_init from "./nc_webdav";

const fns = [
  z_sys_notifications,
  z_cache,
  z_play_time_tracker,
  z_gc_init,
  z_webdav_init,
  z_game_loader,
  z_process_cloud,
  z_game_dl_install,
  z_cloud_saves,
  z_update_check,
  z_misc_os
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
  ensureDir: ensureDir,
  normalizeFolder: normalizeFolder,
  getFolderSize: getFolderSize,
  log: (log: string) => {
    console.log(log);
    // TODO: Do the file logging
  }
} as Globals;

export function undefinedOrNull(_var: BrowserWindow | BrowserWindow[]){
  return typeof _var === "undefined" || _var === null;
}

export function win(): BrowserWindow | null{
  // Main process
  const mainWindow = BrowserWindow.getAllWindows();
  if (
    undefinedOrNull(mainWindow) ||
    undefinedOrNull(mainWindow[mainWindow.length - 1])
  ){
    return null;
  }

  return mainWindow[mainWindow.length - 1];
}

export function triggerReload(game?: GOG.GameInfo){
  win()?.webContents.send("gog-game-reload", game);
}

export function notify(options: Notify.Alert){
  win()?.webContents.send("notify", options);
}

export default function init(ipcMain: IpcMain, win: BrowserWindow){
  globals.notify = notify;
  globals.app_dir = appDataDir();
  globals.ensureDir(globals.app_dir);
  console.log("globals.app_dir", globals.app_dir);
  // Init the different modules here
  for(const i in fns){
    fns[i](ipcMain, win, globals);
  }

  ipcMain.handle("browse-folder", async() => {
    return await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
  });
}