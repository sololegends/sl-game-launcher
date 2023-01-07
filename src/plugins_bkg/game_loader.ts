
import { BrowserWindow, IpcMain } from "electron";
import {removeFromDataCache, removeFromImageCache} from "./cache";

import fns from "./game_loader_fns";
import { GOG } from "@/types/gog/game_info";

let _win = undefined as undefined | BrowserWindow;

function flattenName(name: string): string{
  return name.trim().toLowerCase().replace(/[^-a-z0-9_]/gm, "_");
}

export function loadPresentDLC(game: GOG.GameInfo, remote: GOG.RemoteGameData): GOG.RemoteGameData{
  if(remote === undefined || game.root_dir === "remote"){
    return remote;
  }
  return fns.loadPresentDLC(game, remote);
}

export async function getRemoteGameData(game: GOG.GameInfo, use_cache = true): Promise<undefined | GOG.RemoteGameData>{
  if(use_cache && game.remote !== undefined){
    return game.remote;
  }
  const game_data = await fns.getRemoteGameData(game, use_cache);
  if(game_data){
    _win?.webContents.send("game-remote-updated", game, game_data);
  }
  return game_data;
}

export async function ensureRemote(game: GOG.GameInfo, use_cache = true): Promise<GOG.RemoteGameData>{
  if(use_cache && game.remote){
    return game.remote;
  }
  return fns.ensureRemote(game, use_cache);
}

export async function getLocalGameData(game_dir: string, heavy = true): Promise<GOG.GameInfo | undefined>{
  return fns.getLocalGameData(game_dir, heavy);
}

export async function getLocalGames(heavy = true): Promise<GOG.GameInfo[]>{
  return fns.getLocalGames(heavy);
}

export async function getLocalGamesFlat(): Promise<string[]>{
  return fns.getLocalGamesFlat();
}

export async function getRemoteGamesList(): Promise<GOG.GameInfo[]>{
  return fns.getRemoteGamesList();
}

async function getGameImage(game: GOG.GameInfo){
  return fns.getGameImage(game);
}

export default function init(ipcMain: IpcMain, win: BrowserWindow){
  _win = win;

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