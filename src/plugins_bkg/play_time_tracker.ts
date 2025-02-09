
import { loadFromDataCache, saveToDataCache } from "./cache";
import { GOG } from "@/types/gog/game_info";
import { IpcMain } from "electron";
import { saves } from "./backplane";
import { win } from ".";

type Playtime = {
  [key: string]: number
}

let PLAYTIME = undefined as undefined | Playtime;

function asSlug(slug: string){
  slug = slug.toLowerCase();
  slug = slug.replaceAll(/[^a-z0-9_]/g, "_");
  while(slug.includes("__")){
    slug = slug.replaceAll("__", "_");
  }
  return slug;
}

async function pushPlaytimeToCloud(){
  if(PLAYTIME === undefined){ return; }
  await saves.upload("$$internal$$", "playtime.json", Buffer.from(JSON.stringify(PLAYTIME, null, 2)));
}

function savePlaytime(push_to_cloud = true){
  if(PLAYTIME === undefined){ return; }
  saveToDataCache("playtime.json", Buffer.from(JSON.stringify(PLAYTIME, null, 2)), "$$internal$$");
  if(push_to_cloud){
  // Push the data to the cloud silently
    pushPlaytimeToCloud();
  }
}

async function pullPlaytimeFromCloud(){
  console.log("Pulling playtime data from cloud...");
  const result = await saves.downloadAsString("$$internal$$", "playtime.json");
  if(result === undefined){
    return;
  }
  try{
    const playtime = JSON.parse(result);
    PLAYTIME = playtime;
    console.log("New playtime data retrieved");
    savePlaytime(false);
    // Trigger refresh
    win()?.webContents.send("gog-game-reload");
  } catch(e){
    console.error("Failed to pull playtime data from cloud", e);
  }
}

function loadData(): Playtime{
  const str = loadFromDataCache("playtime.json", "$$internal$$");
  if(str === undefined){
    pullPlaytimeFromCloud();
    return PLAYTIME || {};
  }
  return JSON.parse(str);
}

function playtime(){
  if(PLAYTIME === undefined){
    PLAYTIME = loadData();
  }
  return PLAYTIME;
}


function sendToWindow(game: GOG.GameInfo, playtime: number){
  win()?.webContents.send("game-playtime-update", game, playtime);
}

export function updatePlayTime(game: GOG.GameInfo, seconds: number){
  if(playtime()[asSlug(game.name)] === undefined){
    playtime()[asSlug(game.name)] = 0;
  }
  playtime()[asSlug(game.name)] += seconds;
  sendToWindow(game, playtime()[asSlug(game.name)]);
  savePlaytime();
}

export function getPlaytime(game: GOG.GameInfo | string): number{
  const tmp = playtime()[asSlug(typeof game === "string" ? game : game.name)];
  return tmp === undefined? 0 : tmp;
}

export default function init(ipcMain: IpcMain){
  ipcMain.handle("add-playtime", (e, game: GOG.GameInfo, seconds: number) => {
    return updatePlayTime(game, seconds);
  });

  ipcMain.handle("get-playtime", (e, game: GOG.GameInfo) => {
    return getPlaytime(game);
  });
}