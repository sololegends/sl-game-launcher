
import { BrowserWindow, IpcMain } from "electron";
import { loadFromDataCache, saveToDataCache } from "./cache";
import { GOG } from "@/types/gog/game_info";

type Playtime = {
  [key: string]: number
}

function loadData(): Playtime{
  const str = loadFromDataCache("playtime.json", "$$internal$$");
  if(str === undefined){
    return {};
  }
  return JSON.parse(str);
}


let PLAYTIME = undefined as undefined | Playtime;
let g_win = undefined as undefined | BrowserWindow;


function asSlug(slug: string){
  slug = slug.toLowerCase();
  slug = slug.replaceAll(/[^a-z0-9_]/g, "_");
  while(slug.includes("__")){
    slug = slug.replaceAll("__", "_");
  }
  return slug;
}

function playtime(){
  if(PLAYTIME === undefined){
    PLAYTIME = loadData();
  }
  return PLAYTIME;
}

function sendToWindow(game: GOG.GameInfo, playtime: number){
  g_win?.webContents.send("game-playtime-update", game, playtime);
}

function savePlaytime(){
  saveToDataCache("playtime.json", Buffer.from(JSON.stringify(playtime(), null, 2)), "$$internal$$");
}

export function updatePlayTime(game: GOG.GameInfo, seconds: number){
  if(playtime()[asSlug(game.name)] === undefined){
    playtime()[asSlug(game.name)] = 0;
  }
  playtime()[asSlug(game.name)] += seconds;
  sendToWindow(game, playtime()[asSlug(game.name)]);
  savePlaytime();
}

export function getPlaytime(game: GOG.GameInfo): number{
  return playtime()[asSlug(game.name)] | 0;
}

export default function init(ipcMain: IpcMain, win: BrowserWindow){
  g_win = win;
  ipcMain.handle("add-playtime", (e, game: GOG.GameInfo, seconds: number) => {
    return updatePlayTime(game, seconds);
  });

  ipcMain.handle("get-playtime", (e, game: GOG.GameInfo) => {
    return getPlaytime(game);
  });
}