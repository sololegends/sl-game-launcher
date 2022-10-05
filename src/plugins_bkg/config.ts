
import { BrowserWindow, IpcMain } from "electron";
import fs from "fs";
import { Globals } from ".";
import { GOG } from "@/types/gog/game_info";

// GLOBAL CONFIGS ====>
// App
export const APP_URL_HANDLER = "slgame";

// Game Saves
export const REMOTE_FOLDER = ".game-saves";
export const REMOTE_FILE_BASE = "save-ng";
// <===== GLOBAL CONFIGS


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

export default function init(ipcMain: IpcMain, win: BrowserWindow, globals: Globals){
  // CONFIGS
  const app_dir = globals.app_dir;

  const conf_file = app_dir + "config.json";
  fs.stat(conf_file, (error) => {
    if(error){
      console.log("No config found");
      return;
    }
    fs.readFile(conf_file, "utf8", function(err, data){
      config = JSON.parse(data);
    });
  });

  ipcMain.handle("cfg-get", (e, key: string) => {
    return getConfig(key);
  });
  ipcMain.on("cfg-set", (e, key: string, value: unknown) => {
    setConfig(key, value, conf_file);
  });


}