
import { loadFromDataCache, saveToDataCache } from "./cache";
import { getRemoteSaveDirectory } from "./cloud_saves";
import { GOG } from "@/types/gog/game_info";
import { initWebDav } from "./nc_webdav";
import { IpcMain } from "electron";
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
  const web_dav = await initWebDav();
  if(web_dav){
    const remote_save_folder = getRemoteSaveDirectory("$$internal$$");
    const remove_save_file = remote_save_folder + "/playtime.json";
    if(!await web_dav.exists(remote_save_folder)){
      await web_dav.createDirectory(remote_save_folder, {recursive: true});
    }
    await web_dav.putFileContents(remove_save_file, Buffer.from(JSON.stringify(PLAYTIME, null, 2)));
  }
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
  const web_dav = await initWebDav();
  if(web_dav){
    const remote_save_folder = getRemoteSaveDirectory("$$internal$$");
    const remote_save_file = remote_save_folder + "/playtime.json";
    console.log("await web_dav.exists(remote_save_file)", await web_dav.exists(remote_save_file));
    if(await web_dav.exists(remote_save_file)){
      console.log("Pulling playtime data from cloud...");
      const file = await web_dav.getFileContents(remote_save_file);
      const result = file instanceof Buffer ? file.toString() : file as string;
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
  }
}

function loadData(): Playtime{
  const str = loadFromDataCache("playtime.json", "$$internal$$");
  pullPlaytimeFromCloud();
  if(str === undefined){
    return {};
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

export function getPlaytime(game: GOG.GameInfo): number{
  return playtime()[asSlug(game.name)] | 0;
}

export default function init(ipcMain: IpcMain){
  ipcMain.handle("add-playtime", (e, game: GOG.GameInfo, seconds: number) => {
    return updatePlayTime(game, seconds);
  });

  ipcMain.handle("get-playtime", (e, game: GOG.GameInfo) => {
    return getPlaytime(game);
  });
}