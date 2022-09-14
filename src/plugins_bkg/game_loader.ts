
import { BrowserWindow, IpcMain } from "electron";
import { initWebDav, mutateFolder, webDavConfig } from "./nc_webdav";
import {
  loadFromDataCache,
  loadFromImageCache,
  loadFromVersionCache,
  removeFromDataCache,
  removeFromImageCache,
  saveToDataCache,
  saveToImageCache
} from "./cache";

import { FileStat } from "webdav";
import fs from "fs";
import { getConfig } from "./config";
import { Globals } from ".";
import { GOG } from "@/types/gog/game_info";
import zip from "node-stream-zip";

function flattenName(name: string): string{
  return name.trim().toLowerCase().replace(/[^-a-z0-9_]/gm, "_");
}

export function loadPresentDLC(game: GOG.GameInfo, remote: GOG.RemoteGameData): GOG.RemoteGameData{
  if(remote === undefined || game.root_dir === "remote"){
    return remote;
  }
  const game_dir = game.root_dir;
  if(fs.statSync(game_dir).isFile()){
    return remote;
  }
  const files = fs.readdirSync(game_dir);
  const dlc_found = [];
  const dlc_ids = {} as Record<string, string>;
  for(const i in files){
    const file = files[i];
    if(file.endsWith(".info")){
      const data = fs.readFileSync(game_dir + "\\" + file, "utf8");
      const l_info = JSON.parse(data);
      if(l_info.gameId !== l_info.rootGameId){
        const name = flattenName(l_info.name);
        dlc_found.push(name);
        dlc_ids[name] = l_info.gameId;
      }
    }
  }
  for(const i in remote.dlc){
    const dlc = remote.dlc[i];
    if(dlc.gameId && Object.values(dlc_ids).includes(dlc.gameId)){
      dlc.present = true;
      continue;
    }
    const name = dlc.slug.replace(remote.slug + "_", "");
    dlc.present = dlc_found.includes(name);
    dlc.gameId = dlc_ids[name];
  }
  return remote;
}

export async function getRemoteGameData(game: GOG.GameInfo): Promise<undefined | GOG.RemoteGameData>{
  if(game.remote !== undefined){
    return game.remote;
  }
  const cache_name = flattenName(game.name);
  const remote_cache_data = loadFromDataCache("game-data.json", cache_name);
  const web_dav_cfg = webDavConfig();
  const web_dav = await initWebDav();
  const remote_folder = mutateFolder(web_dav_cfg.folder + "/" + game.name);
  if(remote_cache_data){
    const game_data = loadPresentDLC(game, JSON.parse(remote_cache_data));
    game_data.folder = remote_folder;
    return game_data as GOG.RemoteGameData;
  }
  const data_dir = remote_folder + "/.data/";
  if(await web_dav?.exists(data_dir)){
    const file_data = await web_dav?.getFileContents(data_dir + "game-data.json").catch(() => {
      return "{}";
    });
    if(file_data instanceof Buffer){
      const game_data = loadPresentDLC(game, JSON.parse(file_data.toString()));
      game_data.folder = remote_folder;
      saveToDataCache("game-data.json", file_data, cache_name);
      return game_data as GOG.RemoteGameData;
    }
  }
  return undefined;
}

export async function ensureRemote(game: GOG.GameInfo): Promise<GOG.RemoteGameData>{
  if(game.remote){
    return game.remote;
  }
  game.remote = await getRemoteGameData(game);
  if(game.remote === undefined){
    throw new Error("Failed to retrieve remote data for game: [" + game.name + "]");
  }
  return game.remote;
}

export async function loadDownloadSize(game: GOG.GameInfo): Promise<number>{
  try{
    game.remote = await ensureRemote(game);
  }catch(e){
    return -1;
  }
  const web_dav = await initWebDav();
  const remote_folder = game.remote?.folder;
  let total_size = 0;
  for(const i in game.remote.download){
    const dl = game.remote.download[i];
    if(await web_dav?.exists(remote_folder + "/" + dl)){
      const stat = await web_dav?.stat(remote_folder + "/" + dl) as FileStat;
      total_size += stat.size;
    }
  }
  return total_size;
}

export default function init(ipcMain: IpcMain, win: BrowserWindow, globals: Globals){

  async function getLocalGames(remote = true): Promise<GOG.GameInfo[]>{
    const folder = getConfig("gog_path") as string;
    const game_list = [] as GOG.GameInfo[];
    const games = fs.readdirSync(folder);
    for(const i in games){
      const game = games[i];
      const game_dir = folder + "\\" + game;
      if(fs.statSync(game_dir).isFile()){
        continue;
      }
      const files = fs.readdirSync(game_dir);
      let info = undefined as GOG.GameInfo | undefined;
      const dlc_found = [];
      for(const i in files){
        const file = files[i];
        if(file.endsWith(".info")){
          const data = fs.readFileSync(game_dir + "\\" + file, "utf8");
          const l_info = JSON.parse(data) as GOG.GameInfo;
          if(l_info.gameId === l_info.rootGameId){
            l_info.webcache = game_dir + "\\webcache.zip";
            l_info.root_dir = game_dir;
            l_info.install_size = globals.getFolderSize(game_dir);
            l_info.current_version = loadFromVersionCache(flattenName(l_info.name));
            if(remote){
              // Load remote data
              l_info.remote = await ensureRemote(l_info);
            }
            // Finally have the info
            info = l_info;
          } else{
            dlc_found.push(flattenName(l_info.name.substring(l_info.name.indexOf(" - ") + 3)));
          }
        }
      }
      if(info){
        game_list.push(info);
      }
    }
    return game_list;
  }

  async function getLocalGamesFlat(): Promise<string[]>{
    const local_games = await getLocalGames(false) as GOG.GameInfo[];
    const flat_games = [];
    for(const i in local_games){
      const game = local_games[i];
      flat_games.push(game.name);
    }
    return flat_games;
  }

  async function getRemoteGamesList(): Promise<GOG.GameInfo[]>{
    const remote_games = [] as GOG.GameInfo[];
    const local_games = await getLocalGamesFlat();
    const web_dav = await initWebDav();
    const nc_cfg = webDavConfig();
    if(nc_cfg !== undefined && web_dav !== undefined){
      const mutated_folder = mutateFolder(nc_cfg.folder);
      const contents = await web_dav.getDirectoryContents(mutated_folder) as FileStat[];
      for(const i in contents){
        const file = contents[i] as FileStat;
        const name = file.filename.replace(mutated_folder + "/", "");
        if(file.type === "directory" && !name.startsWith("~") && !local_games.includes(name)){
          // Get the remote data payload
          const game = {
            "clientId": "remote",
            "gameId": file.filename,
            "language": "remote",
            "languages": ["remote"],
            "name": name,
            "playTasks": [] as GOG.PlayTasks[],
            "rootGameId": "remote",
            "version": 0,
            "webcache": "remote",
            "root_dir": "remote"
          } as GOG.GameInfo;
          remote_games.push(game);
        }
      }
    }
    return remote_games;
  }

  async function getRemoteGameIcon(game: GOG.GameInfo): Promise<GOG.ImageResponse>{
    const web_dav = await initWebDav();
    const nc_cfg = webDavConfig();
    try{
      game.remote = await ensureRemote(game);
    }catch(e){
      console.log("Failed to get remote for game [" + game.name + "]");
      return { icon: "404", remote: undefined };
    }
    if(nc_cfg !== undefined && web_dav !== undefined && game.remote?.logo){
      const logo_path = game.gameId + "/.data/" + game.remote.logo;
      // Check for cached data
      const image = loadFromImageCache(game.remote.logo, game.remote.slug);
      if(image instanceof Buffer){
        return {
          icon: "data:" + game.remote.logo_format + ";base64," + image.toString("base64"),
          remote: game.remote
        };
      }
      const file_data = await web_dav.getFileContents(logo_path).catch((err) => {
        console.log(err);
        return "nothing";
      });
      if(file_data instanceof Buffer){
        saveToImageCache(game.remote.logo, file_data, game.remote.slug);
        return {
          icon: "data:" + game.remote.logo_format + ";base64," + file_data.toString("base64"),
          remote: game.remote
        };
      }
    }
    return { icon: "404", remote: game.remote };
  }

  async function getGameImage(type: GOG.ImageType, game: GOG.GameInfo){
    const cache_zip = game.webcache;
    try{
      game.remote = await ensureRemote(game);
    }catch(e){
      // Nothing here
      console.log("Failed to get remote for game [" + game.name + "]");
    }
    if(cache_zip === "remote"){
      return getRemoteGameIcon(game);
    }
    const webcache = new zip.async({file: cache_zip});
    const data = await webcache.entryData("resources.json");
    const resource = JSON.parse(data.toString());
    const image = resource["images\\" + type];
    const img_data = await webcache.entryData(image);
    const ext = image.substr(image.lastIndexOf(".") + 1);
    await webcache.close();
    return {
      icon: "data:image/" + ext + ";base64," + img_data.toString("base64"),
      remote: game.remote
    };
  }

  // Init
  ipcMain.handle("read-remote-games", async() => {
    return getRemoteGamesList();
  });

  ipcMain.handle("reload-cache-data", async(e, game: GOG.GameInfo): Promise<GOG.ImageResponse> => {
    removeFromDataCache("game-data.json", flattenName(game.name));
    if(game.remote){
      removeFromImageCache(game.remote.logo, game.remote.slug);
    }
    game.remote = undefined;
    return await getGameImage("logo2x", game);
  });

  // GAMES BITS
  ipcMain.handle("read-games", async(e, remote = true) => {
    return await getLocalGames(remote);
  });

  ipcMain.handle("get-image", async(e, type: GOG.ImageType, game: GOG.GameInfo) => {
    return getGameImage(type, game);
  });

  ipcMain.handle("get-dl-size", async(e, game: GOG.GameInfo) => {
    try{
      game.remote = await ensureRemote(game);
    }catch(e){
      return -1;
    }
    const dl_size =  await loadDownloadSize(game);
    game.remote.dl_size = dl_size;
    const cache_name = flattenName(game.name);
    saveToDataCache("game-data.json", Buffer.from(JSON.stringify(game.remote, null, 2)), cache_name);
    return dl_size;
  });
}