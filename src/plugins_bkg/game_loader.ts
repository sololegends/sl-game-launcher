
import { BrowserWindow, IpcMain } from "electron";
import { game_folder_size, game_iter_id, game_name_file, game_version } from "@/json/files.json";
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
import { getFolderSize } from "./tools/files";
import { getPlaytime } from "./play_time_tracker";
import { GOG } from "@/types/gog/game_info";
import zip from "node-stream-zip";

let _win = undefined as undefined | BrowserWindow;

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
    if(file.endsWith(".info") && (file.startsWith("goggame") || file.startsWith("game-data"))){
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

export async function getRemoteGameData(game: GOG.GameInfo, use_cache = true): Promise<undefined | GOG.RemoteGameData>{
  if(use_cache && game.remote !== undefined){
    return game.remote;
  }
  const cache_name = flattenName(game.remote_name);
  const remote_cache_data = loadFromDataCache("game-data.json", cache_name);
  const web_dav_cfg = webDavConfig();
  const web_dav = await initWebDav();
  const remote_folder = mutateFolder(web_dav_cfg.folder + "/" + game.remote_name);
  if(use_cache && remote_cache_data){
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
      try{
        const game_data = loadPresentDLC(game, JSON.parse(file_data.toString()));
        game_data.folder = remote_folder;
        saveToDataCache("game-data.json", file_data, cache_name);
        _win?.webContents.send("game-remote-updated", game, game_data);
        return game_data as GOG.RemoteGameData;
      }catch(e){
        console.error("Failed to parse game-data.json from server:", e, file_data.toString());
      }
      return undefined;
    }
  }
  return undefined;
}

export async function ensureRemote(game: GOG.GameInfo, use_cache = true): Promise<GOG.RemoteGameData>{
  if(use_cache && game.remote){
    return game.remote;
  }
  game.remote = await getRemoteGameData(game, use_cache);
  if(game.remote === undefined){
    // ONly alert if we are supposed to be able to get it
    if(!getConfig("offline")){
      console.error(new Error("Failed to retrieve remote data for game: [" + game.name + " -- " + game.remote_name + "]"));
    }
    return {
      logo: "logo.jpg",
      folder: "localonly",
      logo_format: "image/jpg",
      slug: game.name.toLowerCase().replaceAll("[^a-z0-1]", "_"),
      download: [],
      dl_size: 0,
      dlc: []
    };
  }
  return game.remote;
}

export async function getLocalGameData(game_dir: string, heavy = true): Promise<GOG.GameInfo | undefined>{
  const files = fs.readdirSync(game_dir);
  let info = undefined as GOG.GameInfo | undefined;
  const dlc_found = [];
  for(const i in files){
    const file = files[i];
    if(file.endsWith(".info") && (file.startsWith("goggame") || file.startsWith("game-data"))){
      const data = fs.readFileSync(game_dir + "\\" + file, "utf8");
      const l_info = JSON.parse(data) as GOG.GameInfo;
      if(l_info.gameId === l_info.rootGameId){
        l_info.remote_name = l_info.name;
        if(fs.existsSync(game_dir + "/" + game_name_file)){
          l_info.remote_name = fs.readFileSync(game_dir + "/" + game_name_file).toString();
        }
        if(fs.existsSync(game_dir + "/" + game_iter_id)){
          l_info.iter_id = parseInt(fs.readFileSync(game_dir + "/" + game_iter_id).toString());
        }
        if(fs.existsSync(game_dir + "/" + game_version)){
          l_info.c_version = fs.readFileSync(game_dir + "/" + game_version).toString();
        }
        // Install size
        if(fs.existsSync(game_dir + "/" + game_folder_size)){
          l_info.install_size = parseInt(fs.readFileSync(game_dir + "/" + game_folder_size).toString());
        }else{
          l_info.install_size = getFolderSize(game_dir);
          fs.writeFileSync(game_dir + "/" + game_folder_size, l_info.install_size + "");
        }
        l_info.webcache = game_dir + "\\webcache.zip";
        l_info.root_dir = game_dir;
        if(heavy){
          l_info.play_time = getPlaytime(l_info);
          l_info.current_version = loadFromVersionCache(flattenName(l_info.name));
          // Load remote data
          try{
            l_info.remote = await ensureRemote(l_info);
          } catch(e){
            console.log("Failed to get remote game data" + e);
          }
        }
        // Finally have the info
        info = l_info;
      } else{
        dlc_found.push(flattenName(l_info.name.substring(l_info.name.indexOf(" - ") + 3)));
      }
    }
  }
  return info;
}

export async function getLocalGames(heavy = true): Promise<GOG.GameInfo[]>{
  const folder = getConfig("gog_path") as string;
  const game_list = [] as GOG.GameInfo[];
  const games = fs.readdirSync(folder);
  for(const i in games){
    const game = games[i];
    const game_dir = folder + "\\" + game;
    if(fs.statSync(game_dir).isFile()){
      continue;
    }
    try{
      const info = await getLocalGameData(game_dir, heavy);
      if(info){
        info.is_installed = true;
        game_list.push(info);
      }
    }catch(e){
      console.log("Failed to load game", game, e);
    }
  }
  return game_list;
}

export async function getLocalGamesFlat(): Promise<string[]>{
  const local_games = await getLocalGames(false) as GOG.GameInfo[];
  const flat_games = [];
  for(const i in local_games){
    const game = local_games[i];
    flat_games.push(game.remote_name);
  }
  return flat_games;
}

export async function getRemoteGamesList(): Promise<GOG.GameInfo[]>{
  const remote_games = [] as GOG.GameInfo[];
  const local_games = await getLocalGamesFlat();
  console.log("Remote load stage");
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
          clientId: "remote",
          gameId: file.filename,
          language: "remote",
          languages: ["remote"],
          name: name,
          remote_name: name,
          playTasks: [] as GOG.PlayTasks[],
          rootGameId: "remote",
          version: 0,
          webcache: "remote",
          root_dir: "remote",
          is_installed: false
        } as GOG.GameInfo;
        game.remote = await ensureRemote(game);
        remote_games.push(game);
      }
    }
  }
  return remote_games;
}

export default function init(ipcMain: IpcMain, win: BrowserWindow){
  _win = win;

  async function getRemoteGameIcon(game: GOG.GameInfo): Promise<GOG.ImageResponse>{
    try{
      game.remote = await ensureRemote(game);
    }catch(e){
      console.log("Failed to get remote for game [" + game.name + " -- " + game.remote_name + "]");
      return { icon: "404", remote: undefined };
    }
    // Check for cached data
    const image = loadFromImageCache(game.remote.logo, game.remote.slug);
    if(image instanceof Buffer){
      return {
        icon: "data:" + game.remote.logo_format + ";base64," + image.toString("base64"),
        remote: game.remote
      };
    }
    const web_dav = await initWebDav();
    const nc_cfg = webDavConfig();
    if(nc_cfg !== undefined && web_dav !== undefined && game.remote?.logo){
      const logo_path = game.gameId + "/.data/" + game.remote.logo;
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

  async function getGameImage(game: GOG.GameInfo){
    // Load the remote data
    try{
      game.remote = await ensureRemote(game);
    }catch(e){
      // Nothing here
      console.log("Failed to get remote for game [" + game.name + "]");
    }
    const cache_zip = game.webcache;
    if(cache_zip === "remote"){
      return getRemoteGameIcon(game);
    }
    // Check for the local icon file
    if(game.root_dir !== "remote" && fs.existsSync(game.root_dir + "/logo.jpg")){
      const image = fs.readFileSync(game.root_dir + "/logo.jpg");
      if(image instanceof Buffer){
        return {
          icon: "data:image/jpg;base64," + image.toString("base64"),
          remote: game.remote
        };
      }
    }
    if(game.remote){
      const image = loadFromImageCache(game.remote.logo, game.remote.slug);
      if(image){
        return {
          icon: "data:" + game.remote.logo_format + ";base64," + image.toString("base64"),
          remote: game.remote
        };
      }
    }
    const webcache = new zip.async({file: cache_zip});
    const data = await webcache.entryData("resources.json");
    const resource = JSON.parse(data.toString());
    let image = resource["images\\logo2x"];
    if(image === undefined){
      image = resource["images\\logo"];
    }
    const img_data = await webcache.entryData(image);
    if(game.remote){
      saveToImageCache(game.remote.logo, img_data, game.remote.slug);
    }
    const ext = image.substr(image.lastIndexOf(".") + 1);
    await webcache.close();
    return {
      icon: "data:image/" + ext + ";base64," + img_data.toString("base64"),
      remote: game.remote
    };
  }

  // Init
  ipcMain.handle("read-remote-games", async() => {
    return new Promise<GOG.GameInfo[]>((resolve) => {
      getRemoteGamesList().then((games: GOG.GameInfo[]) => {
        resolve(games);
      });
    });
  });

  ipcMain.handle("reload-cache-data", async(e, game: GOG.GameInfo): Promise<GOG.ImageResponse> => {
    return new Promise<GOG.ImageResponse>((resolve, reject) => {
      removeFromDataCache("game-data.json", flattenName(game.remote_name));
      if(game.remote){
        removeFromImageCache(game.remote.logo, game.remote.slug);
      }
      game.remote = undefined;
      getGameImage(game).then((image: GOG.ImageResponse) => {
        if(image.icon === "404"){
          reject(image);
          return;
        }
        resolve(image);
      });
    });
  });

  // GAMES BITS
  ipcMain.handle("read-games", async(e, remote = true) => {
    return new Promise<GOG.GameInfo[]>((resolve) => {
      getLocalGames(remote).then((games: GOG.GameInfo[]) => {
        resolve(games);
      });
    });
  });

  ipcMain.handle("get-image", async(e, type: GOG.ImageType, game: GOG.GameInfo) => {
    return new Promise<GOG.ImageResponse>((resolve, reject) => {
      getGameImage(game).then((image: GOG.ImageResponse) => {
        if(image.icon === "404"){
          reject(image);
          return;
        }
        resolve(image);
      });
    });
  });

}