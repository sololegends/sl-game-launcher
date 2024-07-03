
import { BrowserWindow, IpcMain } from "electron";
import { offlineNotice, win } from "..";
import { DownloaderHelper } from "node-downloader-helper";
import { getConfig } from "../config";
import { GOG } from "@/types/gog/game_info";
import sl_api_bp from "./sl_api_backplane";
import webdav_bp from "./webdav_backplane";

export interface AppBackPlane {
  init: (ipcMain: IpcMain, window?: BrowserWindow) => Promise<void>
	remote: {
		list: (use_cache: boolean) => Promise<Record<string, GOG.RemoteGameData>>
		games: (use_cache: boolean, game_ids: string[]) => Promise<Record<string, GOG.RemoteGameData>>
		game: (game_id: string, use_cache: boolean) => Promise<GOG.RemoteGameData | undefined>
		uninstall: (game_id: string, script: string) => Promise<GOG.UninstallDef | undefined>
		icon: (game_id: string, game_remote: GOG.RemoteGameData) => Promise<string>
	},
	download: {
		installer: (game_id: string, dl_link: string) => Promise<DownloaderHelper | undefined>
	},
	saves: {
		upload: (game_id: string, remote_file: string, local_file: string | Buffer) => Promise<boolean>
		download: (game_id: string, save_file: string) => Promise<DownloaderHelper | undefined>
		downloadAsString: (game_id: string, save_file: string) => Promise<string | undefined>
		latest: (game_id: string, save_file: string) => Promise<number | undefined>
	}
}

export type PlaneType = "webdav" | "sl_api";

const BACK_PLANE = {
  webdav: webdav_bp,
  sl_api: sl_api_bp
} as Record<PlaneType, AppBackPlane>;
let use_bp =  "sl_api" as PlaneType;

export const remote = {
  list(use_cache: boolean): Promise<Record<string, GOG.RemoteGameData>>{
    if(getConfig("offline")){
      offlineNotice("Cannot retrieve remote games list in offline mode");
      return new Promise<Record<string, GOG.RemoteGameData>>((resolve) =>{
        resolve({});
      });
    }
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<Record<string, GOG.RemoteGameData>>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].remote.list(use_cache);
  },
  games(use_cache: boolean, game_ids: string[]): Promise<Record<string, GOG.RemoteGameData>>{
    if(getConfig("offline")){
      offlineNotice("Cannot retrieve remote games set in offline mode");
      return new Promise<Record<string, GOG.RemoteGameData>>((resolve) =>{
        resolve({});
      });
    }
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<Record<string, GOG.RemoteGameData>>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].remote.games(use_cache, game_ids);
  },
  game(game_id: string, use_cache: boolean): Promise<GOG.RemoteGameData | undefined>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<GOG.RemoteGameData>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].remote.game(game_id, use_cache);
  },
  uninstall(game_id: string, script: string): Promise<GOG.UninstallDef | undefined>{
    if(getConfig("offline")){
      offlineNotice("Cannot download uninstall data in offline mode");
      return new Promise<GOG.UninstallDef | undefined>((resolve) =>{
        resolve(undefined);
      });
    }
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<GOG.UninstallDef | undefined>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].remote.uninstall(game_id, script);
  },
  icon(game_id: string, game_remote: GOG.RemoteGameData): Promise<string>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<string>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].remote.icon(game_id, game_remote);
  }
};

export const download = {
  installer(game_id: string, dl_link: string): Promise<DownloaderHelper | undefined>{
    if(getConfig("offline")){
      offlineNotice("Cannot download installers in offline mode");
      return new Promise<DownloaderHelper | undefined>((resolve) =>{
        resolve(undefined);
      });
    }
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<DownloaderHelper | undefined>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].download.installer(game_id, dl_link);
  }
};

export const saves = {
  upload(game_id: string, remote_file: string, local_file: string | Buffer): Promise<boolean>{
    if(getConfig("offline")){
      offlineNotice("Cannot upload saves in offline mode");
      return new Promise<boolean>((resolve) =>{
        resolve(false);
      });
    }
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<boolean>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].saves.upload(game_id, remote_file, local_file);
  },
  download(game_id: string, save_file: string): Promise<DownloaderHelper | undefined>{
    if(getConfig("offline")){
      offlineNotice("Cannot download saves in offline mode");
      return new Promise<DownloaderHelper | undefined>((resolve) =>{
        resolve(undefined);
      });
    }
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<DownloaderHelper | undefined>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].saves.download(game_id, save_file);
  },
  downloadAsString(game_id: string, save_file: string): Promise<string | undefined>{
    if(getConfig("offline")){
      offlineNotice("Cannot download saves in offline mode");
      return new Promise<string | undefined>((resolve) =>{
        resolve(undefined);
      });
    }
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<string | undefined>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].saves.downloadAsString(game_id, save_file);
  },
  latest(game_id: string, save_file: string): Promise<number | undefined>{
    if(getConfig("offline")){
      offlineNotice("Cannot check saves in offline mode");
      return new Promise<number | undefined>((resolve) =>{
        resolve(undefined);
      });
    }
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<number | undefined>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].saves.latest(game_id, save_file);
  }
};

export default {
  remote,
  download,
  saves
} as AppBackPlane;

export function changeBackPlane(back_plane: PlaneType, ipcMain: IpcMain, window?: BrowserWindow){
  use_bp = back_plane;
  console.log("Setting backplane to: ", use_bp);
  BACK_PLANE[use_bp].init(ipcMain, window);
}

export function init(ipcMain: IpcMain, window: BrowserWindow){
  changeBackPlane((getConfig("backplane") || "sl_api") as PlaneType, ipcMain, window);

  console.log("Using Backplane: ", use_bp, getConfig("backplane"));
  ipcMain.on("change-back-plane", (e, back_plane: PlaneType) =>{
    changeBackPlane(back_plane, ipcMain, win());
  });

}