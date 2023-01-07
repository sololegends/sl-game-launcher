
import { ensureDir } from "./tools/files";
import fs from "fs";
import { GOG } from "@/types/gog/game_info";
import { IpcMain } from "electron";
import os from "os";

// GLOBAL CONFIGS ====>
// App
export const APP_URL_HANDLER = "slgame";

// Game Saves
export const REMOTE_FOLDER = ".game-saves";
export const REMOTE_FILE_BASE = "save-ng";
export const DEFAULT_DATA_DIR = "gog-viewer";
// <===== GLOBAL CONFIGS

let app_data_dir = os.homedir() + "\\AppData\\Roaming\\sololegends\\" + DEFAULT_DATA_DIR + "\\";
// Ensure the data dir is intact
ensureDir(app_data_dir);

export function setAppDataDir(data_dir: string): string{
  app_data_dir = os.homedir() + "\\AppData\\Roaming\\sololegends\\" + data_dir + "\\";
  // Ensure the data dir is intact
  ensureDir(app_data_dir);
  return app_data_dir;
}
export function appDataDir(): string{
  return app_data_dir;
}

let config = {} as Record<string, unknown>;

let lock = false;
async function sleep(milliseconds: number): Promise<void>{
  return new Promise<void>((resolved) => {
    setTimeout(() => {
      resolved();
    }, milliseconds);
  });
}
async function getLock(){
  while(lock){
    await sleep(100);
  }
  lock = true;
}
function unlock(){
  lock = false;
}

export function getOS(): GOG.GamePlatform{
  const platform = process.platform;
  // TODO: Detect the Steam Deck Linux version
  if(platform === "win32"){
    return "windows";
  }
  return platform as GOG.GamePlatform;
}

export function getConfig(key: string){
  return config[key];
}
export function setConfig(key: string, value: unknown, conf_file: string){
  getLock().then(() => {
    console.log("Setting config: [" + key + "] = " + value);
    config[key] = value;
    fs.writeFile(conf_file, JSON.stringify(config), function(err){
      unlock();
      if (err){
        return console.log(err);
      }
      console.log("Config was saved!");
    });
  });
}

export default function init(ipcMain?: IpcMain){
  const conf_file = app_data_dir + "config.json";

  if(ipcMain){
    ipcMain.handle("cfg-get", (e, key: string) => {
      return getConfig(key);
    });
    ipcMain.on("cfg-set", (e, key: string, value: unknown) => {
      setConfig(key, value, conf_file);
    });
  }

  return new Promise<void>((resolve) => {
    // CONFIGS
    fs.stat(conf_file, (error) => {
      if(error){
        console.log("No config found");
        resolve();
        return;
      }
      fs.readFile(conf_file, "utf8", function(err, data){
        config = JSON.parse(data);
        resolve();
      });
    });
  });
}