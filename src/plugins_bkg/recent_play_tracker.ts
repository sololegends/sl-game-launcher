
import { loadFromDataCache, saveToDataCache } from "./cache";
import { GOG } from "@/types/gog/game_info";
import { IpcMain } from "electron";
import { saves } from "./backplane";
import { win } from ".";

type LastPlayed = {
  [key: string]: number
}

let LAST_PLAYED = undefined as undefined | LastPlayed;

function asSlug(slug: string){
  slug = slug.toLowerCase();
  slug = slug.replaceAll(/[^a-z0-9_]/g, "_");
  while(slug.includes("__")){
    slug = slug.replaceAll("__", "_");
  }
  return slug;
}

async function pushLastPlayedToCloud(){
  if(LAST_PLAYED === undefined){ return; }
  await saves.upload("$$internal$$", "last_played.json", Buffer.from(JSON.stringify(LAST_PLAYED, null, 2)));
}

function saveLastPlayed(push_to_cloud = true){
  if(LAST_PLAYED === undefined){ return; }
  saveToDataCache("last_played.json", Buffer.from(JSON.stringify(LAST_PLAYED, null, 2)), "$$internal$$");
  if(push_to_cloud){
  // Push the data to the cloud silently
    pushLastPlayedToCloud();
  }
}

async function pullLastPlayedFromCloud(){
  console.log("Pulling last played data from cloud...");
  const result = await saves.downloadAsString("$$internal$$", "last_played.json");
  if(result === undefined){
    return;
  }
  try{
    const last_played = JSON.parse(result);
    LAST_PLAYED = last_played;
    console.log("New last played data retrieved");
    saveLastPlayed(false);
    // Trigger refresh
    win()?.webContents.send("gog-game-reload");
  } catch(e){
    console.error("Failed to pull last played data from cloud", e);
  }
}

function loadData(): LastPlayed{
  const str = loadFromDataCache("last_played.json", "$$internal$$");
  if(str === undefined){
    pullLastPlayedFromCloud();
    return LAST_PLAYED || {};
  }
  return JSON.parse(str);
}

function lastPlayed(){
  if(LAST_PLAYED === undefined){
    LAST_PLAYED = loadData();
  }
  return LAST_PLAYED;
}


function sendToWindow(game: GOG.GameInfo, last_played: number){
  win()?.webContents.send("game-last-played-update", game, last_played);
}

export function updateLastPlayed(game: GOG.GameInfo){
  if(lastPlayed()[asSlug(game.name)] === undefined){
    lastPlayed()[asSlug(game.name)] = 0;
  }
  lastPlayed()[asSlug(game.name)] = new Date().getTime();
  sendToWindow(game, lastPlayed()[asSlug(game.name)]);
  saveLastPlayed();
}

export function getLastPlayed(game: GOG.GameInfo | string): number{
  const tmp = lastPlayed()[asSlug(typeof game === "string" ? game : game.name)];
  return tmp === undefined ? 0 : tmp;
}

export default function init(ipcMain: IpcMain){
  ipcMain.handle("set-played", (e, game: GOG.GameInfo) => {
    return updateLastPlayed(game);
  });

  ipcMain.handle("get-last-played", (e, game: GOG.GameInfo) => {
    return getLastPlayed(game);
  });
}