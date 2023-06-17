
import { game_folder_size, game_iter_id, game_name_file, game_version } from "../../json/files.json";
import {
  loadFromImageCache,
  saveToImageCache
} from "../cache";

import fs from "fs";
import { getConfig } from "../config";
import { getFolderSize } from "../tools/files";
import { getPlaytime } from "../play_time_tracker";
import { GOG } from "@/types/gog/game_info";
import { remote } from "../backplane";
import zip from "node-stream-zip";

function flattenName(name: string): string{
  return name.trim().toLowerCase().replace(/[^-a-z0-9_]/gm, "_");
}

export function loadPresentDLC(game: GOG.GameInfo, remote?: GOG.RemoteGameData): GOG.RemoteGameData | undefined{
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
  const dlc_tasks = {} as Record<string, GOG.PlayTasks[]>;
  for(const i in files){
    const file = files[i];
    if(file.endsWith(".info") && (file.startsWith("goggame") || file.startsWith("game-data"))){
      const data = fs.readFileSync(game_dir + "\\" + file, "utf8");
      const l_info = JSON.parse(data);
      if(l_info.gameId !== l_info.rootGameId){
        const name = flattenName(l_info.name);
        dlc_found.push(name);
        dlc_ids[name] = l_info.gameId;
        dlc_tasks[l_info.gameId] = l_info.playTasks;
      }
    }
  }
  for(const i in remote.dlc){
    const dlc = remote.dlc[i];
    const name = dlc.slug.replace(remote.slug + "_", "");
    if(dlc.gameId && Object.values(dlc_ids).includes(dlc.gameId)){
      if(dlc_tasks[dlc.gameId] !== undefined){
        dlc.playTasks = dlc_tasks[dlc.gameId];
      }
      dlc.present = true;
      continue;
    }
    dlc.present = dlc_found.includes(name);
    if(dlc.gameId === undefined){
      dlc.gameId = dlc_ids[name];
    }
  }
  return remote;
}

export async function getRemoteGameData(game: GOG.GameInfo, use_cache = true): Promise<undefined | GOG.RemoteGameData>{
  if(use_cache && game.remote !== undefined){
    return game.remote;
  }
  return loadPresentDLC(game, await remote.game(game.gameId, use_cache));
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
      game_id: game.gameId,
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
          l_info.current_version = l_info.c_version;
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

export async function getRemoteGamesList(use_cache = true, filter_installed = true): Promise<GOG.GameInfo[]>{
  if(getConfig("offline")){
    return [];
  }
  const remote_games = [] as GOG.GameInfo[];
  const local_games = filter_installed ? await getLocalGamesFlat() : [];
  console.log("Remote load stage");
  const remote_game_data = await remote.list(use_cache);
  for(const game_id in remote_game_data){
    const name = remote_game_data[game_id].name;
    if(name && local_games.includes(name)){
      continue;
    }
    // Get the remote data payload
    const game = {
      clientId: "remote",
      gameId: game_id,
      language: "remote",
      languages: ["remote"],
      name: name,
      remote_name: name,
      remote: remote_game_data[game_id],
      playTasks: [] as GOG.PlayTasks[],
      rootGameId: "remote",
      version: 0,
      webcache: "remote",
      root_dir: "remote",
      is_installed: false
    } as GOG.GameInfo;
    remote_games.push(game);
  }
  return remote_games;
}

export async function getRemoteGameIcon(game: GOG.GameInfo): Promise<GOG.ImageResponse>{
  try{
    game.remote = await ensureRemote(game);
  }catch(e){
    console.log("Failed to get remote for game [" + game.name + " -- " + game.remote_name + "]");
    return { icon: "404", remote: undefined };
  }
  // Check for cached data
  const image = await remote.icon(game.gameId, game.remote);
  return { icon: image, remote: game.remote };
}

export async function getGameImage(game: GOG.GameInfo){
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
  if(game.root_dir !== "remote"){
    const searches = {
      "icon.jpg": "jpg",
      "icon.png": "png",
      "logo.jpg": "jpg",
      "logo.png": "png"
    } as Record<string, string>;
    for(const key in searches){
      if(!fs.existsSync(game.root_dir + "/" + key)){
        continue;
      }
      const image = fs.readFileSync(game.root_dir + "/" + key);
      if(image instanceof Buffer){
        return {
          icon: "data:image/" + searches[key] + ";base64," + image.toString("base64"),
          remote: game.remote
        };
      }
    }
  }
  if(game.remote){
    const image = loadFromImageCache(game.remote.logo, game.gameId);
    if(image){
      return {
        icon: "data:" + game.remote.logo_format + ";base64," + image.toString("base64"),
        remote: game.remote
      };
    }
  }
  try{
    const webcache = new zip.async({file: cache_zip});
    const data = await webcache.entryData("resources.json");
    const resource = JSON.parse(data.toString());
    let image = resource["images\\logo2x"];
    if(image === undefined){
      image = resource["images\\logo"];
    }
    // Ugh old GOG games do this..
    if(image === undefined){
      image = resource["images/logo2x"];
    }
    if(image === undefined){
      image = resource["images/logo"];
    }
    const img_data = await webcache.entryData(image);
    if(game.remote){
      saveToImageCache(game.remote.logo, img_data, game.gameId);
    }
    const ext = image.substr(image.lastIndexOf(".") + 1);
    await webcache.close();
    return {
      icon: "data:image/" + ext + ";base64," + img_data.toString("base64"),
      remote: game.remote
    };
  }catch(e){
    console.error("Failed to get image from webcache", e);
  }
  return {
    icon: "data:image/png;base64",
    remote: game.remote
  };
}

export async function dlcDataFromSlug(game: GOG.GameInfo, dlc_slug: string): Promise<GOG.RemoteGameDLCBuilding | undefined>{
  game.remote = await ensureRemote(game);
  let idx = -1;
  for(const i in game.remote.dlc){
    const dlc = game.remote.dlc[i];
    if(dlc.slug === dlc_slug){
      idx = i as unknown as number;
      break;
    }
  }
  if(idx === -1){
    return undefined;
  }
  return game.remote.dlc[idx];
}

export default {
  loadPresentDLC,
  getRemoteGameData,
  ensureRemote,
  getLocalGameData,
  getLocalGames,
  getLocalGamesFlat,
  getRemoteGamesList,
  getRemoteGameIcon,
  getGameImage
};