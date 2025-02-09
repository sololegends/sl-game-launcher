
import { loadFromDataCache, saveToDataCache } from "./cache";
import { GOG } from "@/types/gog/game_info";
import { IpcMain } from "electron";
import { saves } from "./backplane";
import { win } from ".";

type GameHidden = {
  [key: string]: boolean
}

let HIDDEN = undefined as undefined | GameHidden;

function asSlug(slug: string){
  slug = slug.toLowerCase();
  slug = slug.replaceAll(/[^a-z0-9_]/g, "_");
  while(slug.includes("__")){
    slug = slug.replaceAll("__", "_");
  }
  return slug;
}

async function pushGameHiddenToCloud(){
  if(HIDDEN === undefined){ return; }
  await saves.upload("$$internal$$", "hidden_games.json", Buffer.from(JSON.stringify(HIDDEN, null, 2)));
}

function saveGameHidden(push_to_cloud = true){
  if(HIDDEN === undefined){ return; }
  saveToDataCache("hidden_games.json", Buffer.from(JSON.stringify(HIDDEN, null, 2)), "$$internal$$");
  if(push_to_cloud){
  // Push the data to the cloud silently
    pushGameHiddenToCloud();
  }
}

async function pullGameHiddenFromCloud(){
  console.log("Pulling hidden game data from cloud...");
  const result = await saves.downloadAsString("$$internal$$", "hidden_games.json");
  if(result === undefined){
    return;
  }
  try{
    const games_hidden = JSON.parse(result);
    HIDDEN = games_hidden;
    console.log("New hidden game data retrieved");
    saveGameHidden(false);
    // Trigger refresh
    win()?.webContents.send("gog-game-reload");
  } catch(e){
    console.error("Failed to pull hidden game data from cloud", e);
  }
}

function loadData(): GameHidden{
  const str = loadFromDataCache("hidden_games.json", "$$internal$$");
  if(str === undefined){
    pullGameHiddenFromCloud();
    return HIDDEN || {};
  }
  return JSON.parse(str);
}

function gamesHidden(){
  if(HIDDEN === undefined){
    HIDDEN = loadData();
  }
  return HIDDEN;
}

function sendToWindow(game: GOG.GameInfo, hide: boolean){
  win()?.webContents.send("game-hidden-update", game, hide);
}

export function updateGameHidden(game: GOG.GameInfo, hidden: boolean){
  if(gamesHidden()[asSlug(game.name)] === undefined){
    gamesHidden()[asSlug(game.name)] = false;
  }
  gamesHidden()[asSlug(game.name)] = hidden;
  sendToWindow(game, hidden);
  saveGameHidden();
}

export function getGameHidden(game: GOG.GameInfo | string): boolean{
  const tmp = gamesHidden()[asSlug(typeof game === "string" ? game : game.name)];
  return tmp === undefined ? false : tmp;
}

export default function init(ipcMain: IpcMain){
  ipcMain.handle("set-game-hidden", (e, game: GOG.GameInfo, hidden: boolean) => {
    return updateGameHidden(game, hidden);
  });

  ipcMain.handle("get-game-hidden", (e, game: GOG.GameInfo) => {
    return getGameHidden(game);
  });
}