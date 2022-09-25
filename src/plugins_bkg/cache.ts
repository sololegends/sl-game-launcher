import { BrowserWindow, IpcMain } from "electron";
import fs from "fs";
import { Globals } from ".";

let image_cache_dir = "none";
let data_cache_dir = "none";
let version_cache_dir = "none";
let l_globals = undefined as undefined | Globals;

const LOADED = {} as Record<string, number>;

function saveToCache(cache_dir: string, name: string, data: Buffer, folder?: string): boolean{
  if(!l_globals){
    return false;
  }
  const file = cache_dir + (folder ? (folder + "/") : "") + name;
  if(folder){
    l_globals.ensureDir(cache_dir + folder);
  }
  console.log("Data [" + ((folder ? (folder + "/") : "") + name) + "] saved to cache");
  const fsw = fs.createWriteStream(file);
  const bool = fsw.write(data);
  fsw.close();
  return bool;
}

function loadFromCache(cache_dir: string, name: string, folder?: string): undefined | Buffer{
  const file = cache_dir + (folder ? (folder + "/") : "") + name;
  if(fs.existsSync(file)){
    console.log("Data [" + ((folder ? (folder + "/") : "") + name) + "] loaded from cache");
    return fs.readFileSync(file);
  }
  return undefined;
}

function removeFromCache(cache_dir: string, name: string, folder?: string){
  const file = cache_dir + (folder ? (folder + "/") : "") + name;
  if(fs.existsSync(file)){
    console.log("Data [" + ((folder ? (folder + "/") : "") + name) + "] deleted from cache");
    fs.rmSync(file);
  }
}

export function clearImageCache(): void{
  fs.rmSync(image_cache_dir, { recursive: true });
  l_globals?.ensureDir(image_cache_dir);
}

export function clearDataCache(): void{
  fs.rmSync(data_cache_dir, { recursive: true });
  l_globals?.ensureDir(data_cache_dir);
}

export function clearVersionCache(): void{
  fs.rmSync(version_cache_dir, { recursive: true });
  l_globals?.ensureDir(version_cache_dir);
}

export function saveToImageCache(name: string, image: Buffer, folder?: string): boolean{
  return saveToCache(image_cache_dir, name, image, folder);
}

export function loadFromImageCache(name: string, folder?: string): undefined | Buffer{
  return loadFromCache(image_cache_dir, name, folder);
}

export function removeFromImageCache(name: string, folder?: string){
  return removeFromCache(image_cache_dir, name, folder);
}


export function saveToDataCache(name: string, data: Buffer, folder?: string): boolean{
  return saveToCache(data_cache_dir, name, data, folder);
}

export function loadFromDataCache(name: string, folder?: string): undefined | string{
  const log_name = name + (folder ? "-" + folder : "-");
  if(LOADED[log_name] !== undefined){
    console.log(log_name + " was loaded [" + LOADED[log_name] + "] times");
  }else{
    LOADED[log_name] = 1;
  }
  LOADED[log_name] += 1;
  return loadFromCache(data_cache_dir, name, folder)?.toString();
}

export function removeFromDataCache(name: string, folder?: string){
  return removeFromCache(data_cache_dir, name, folder);
}


export function saveToVersionCache(name: string, data: Buffer, folder?: string): boolean{
  return saveToCache(version_cache_dir, name, data, folder);
}

export function loadFromVersionCache(name: string, folder?: string): undefined | string{
  return loadFromCache(version_cache_dir, name, folder)?.toString();
}

export function removeFromVersionCache(name: string, folder?: string){
  return removeFromCache(version_cache_dir, name, folder);
}


export default function init(ipcMain: IpcMain, win: BrowserWindow, globals: Globals){

  function getImageCacheSize(): number{
    return globals.getFolderSize(image_cache_dir);
  }

  function getDataCacheSize(): number{
    return globals.getFolderSize(data_cache_dir);
  }
  function getVersionCacheSize(): number{
    return globals.getFolderSize(version_cache_dir);
  }

  // Init
  image_cache_dir = globals.app_dir + "img_cache\\";
  data_cache_dir = globals.app_dir + "data_cache\\";
  version_cache_dir = globals.app_dir + "version_cache\\";
  globals.ensureDir(image_cache_dir);
  globals.ensureDir(data_cache_dir);
  globals.ensureDir(version_cache_dir);
  l_globals = globals;

  ipcMain.handle("cache-folder", () =>{
    return globals.app_dir;
  });

  ipcMain.handle("image-cache-size", () =>{
    return getImageCacheSize();
  });

  ipcMain.handle("data-cache-size", () =>{
    return getDataCacheSize();
  });

  ipcMain.handle("version-cache-size", () =>{
    return getVersionCacheSize();
  });

  ipcMain.handle("image-cache-clear", () =>{
    return clearImageCache();
  });

  ipcMain.handle("data-cache-clear", () =>{
    return clearDataCache();
  });

  ipcMain.handle("version-cache-clear", () =>{
    return clearVersionCache();
  });
}