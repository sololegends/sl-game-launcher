import { BrowserWindow, IpcMain } from "electron";
import fs from "fs";
import { Globals } from ".";

let config = {} as Record<string, unknown>;

export function getConfig(key: string){
  return config[key];
}
export function setConfig(key: string, value: unknown, conf_file: string){
  config[key] = value;
  fs.writeFile(conf_file, JSON.stringify(config), function(err){
    if (err){
      return console.log(err);
    }
    console.log("Config was saved!");
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
    return setConfig(key, value, conf_file);
  });


}