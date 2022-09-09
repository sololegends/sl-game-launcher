
import * as child from "child_process";
import { app, BrowserWindow, IpcMain } from "electron";
import fs from "fs";
import { Notify } from "@/types/notification/notify";
import z_cache from "./cache";
import z_cfg_init from "./config";
import z_game_dl_install from "./game_dl_install";
import z_game_loader from "./game_loader";
import z_gc_init from "./game_control";
import z_process_cloud from "./process_cloud";
import z_webdav_init from "./nc_webdav";

const fns = [
  z_cfg_init,
  z_cache,
  z_gc_init,
  z_webdav_init,
  z_game_loader,
  z_process_cloud,
  z_game_dl_install
];


export type Globals = {
	app_dir: string
	ensureDir: (dir: string) => void
	notify: (options: Notify.Alert) => void
  getFolderSize: (folder: string) => number
}

const globals = {
  app_dir: app.getPath("appData") + "\\sololegends\\gog-viewer\\",
  ensureDir: (dir: string) => {
    if(!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }
  },
  getFolderSize: (folder: string): number => {
    if(folder.endsWith("\\") || folder.endsWith("/")){
      folder = folder.substring(0, folder.length - 1);
    }
    const dir_stat = fs.statSync(folder);
    let accumulator = 0;
    if(dir_stat.isDirectory()){
      const files = fs.readdirSync(folder);
      for(const i in files){
        accumulator += globals.getFolderSize(folder + "/" + files[i]);
      }
      return accumulator;
    }
    return dir_stat.size;
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
    child.exec("explorer.exe " + path.replaceAll("[&|;:$()]+", ""));
  });
}