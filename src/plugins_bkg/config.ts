import { app, IpcMain } from "electron";
import { AppOptions } from "@/background";
import crypt from "./tools/crypt";
import { ensureDir } from "./tools/files";
import fs from "fs";
import { GOG } from "@/types/gog/game_info";
import { isDev } from ".";
import os from "os";

// GLOBAL CONFIGS ====>
// App
export const APP_URL_HANDLER = "slgame";
export const DEFAULT_API = "https://updates.sololegends.com";

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
let cli_args = {} as AppOptions;
let crypto_key = undefined as undefined | string;
const STATIC_KEY = "Illusion-Expulsion1-Calamari-Acre-Cedar!";

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

function cryptoInit(): string{
  if(crypto_key === undefined){
    if(fs.existsSync(app_data_dir + "key")){
      crypto_key = crypt.decrypt(fs.readFileSync(app_data_dir + "key").toString(), STATIC_KEY, "crypto_salt");
    }else{
      // Generate a new one
      crypto_key = crypt.randomString(32);
      fs.writeFileSync(app_data_dir + "key", crypt.encrypt(crypto_key, STATIC_KEY, "crypto_salt"));
    }
  }
  return crypto_key as string;
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
  if(key === "APP_EXE"){
    return app.getPath("exe");
  }
  const value = config[key];
  if(value !== undefined && typeof value === "string" && value.startsWith("$$ENC:")){
    const crypto_key = cryptoInit();
    const decrypted = crypt.decrypt(value.substring(6), crypto_key, key);
    if(decrypted){
      return JSON.parse(decrypted);
    }
    return undefined;
  }
  return value;
}
function setConfig0(key: string, value: unknown, conf_file: string, encrypt?: boolean){
  getLock().then(() => {
    const crypto_key = cryptoInit();
    config[key] = encrypt === true ? "$$ENC:" + crypt.encrypt(JSON.stringify(value), crypto_key, key) : value;
    fs.writeFile(conf_file, isDev() ? JSON.stringify(config, null, 2) : JSON.stringify(config), function(err){
      unlock();
      if (err){
        return console.log(err);
      }
      console.log("Config was saved!");
    });
  });
}

export function setConfig(key: string, value: unknown, encrypt?: boolean){
  setConfig0(key, value, getConfig("config_file"), encrypt);
}

export function setCLIArgs(cli: AppOptions){
  cli_args = cli;
}

export function getCLIArg(arg: (keyof AppOptions)): boolean | string | number{
  return cli_args[arg];
}

export function CLI(): AppOptions{
  return {...cli_args};
}

export default function init(ipcMain?: IpcMain){
  const conf_file = app_data_dir + "config.json";
  if(ipcMain){
    ipcMain.handle("cfg-get", (e, key: string) => {
      return getConfig(key);
    });
    ipcMain.on("cfg-set", (e, key: string, value: unknown, encrypt?: boolean) => {
      setConfig0(key, value, conf_file, encrypt);
    });
  }

  return new Promise<Record<string, unknown>>((resolve) => {
    // CONFIGS
    fs.stat(conf_file, (error) => {
      if(error){
        console.log("No config found");
        resolve({});
        return;
      }
      fs.readFile(conf_file, "utf8", function(err, data){
        config = JSON.parse(data);
        setConfig0("config_file", conf_file, conf_file);
        resolve(config);
      });
    });
  });
}