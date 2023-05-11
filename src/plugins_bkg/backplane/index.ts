
import { DownloaderHelper } from "node-downloader-helper";
import { GOG } from "@/types/gog/game_info";
import { IpcMain } from "electron";
import webdav_bp from "./webdav_backplane";

export interface AppBackPlane {
	remote: {
		list: (use_cache: boolean) => Promise<Record<string, GOG.RemoteGameData>>
		games: (use_cache: boolean, remote_names: string[]) => Promise<Record<string, GOG.RemoteGameData>>
		game: (remote_name: string, use_cache: boolean) => Promise<GOG.RemoteGameData | undefined>
		uninstall: (remote_name: string, script: string) => Promise<GOG.UninstallDef | undefined>
		icon: (remote_name: string, game_remote: GOG.RemoteGameData) => Promise<string>
	},
	download: {
		installer: (remote_name: string, dl_link: string) => Promise<DownloaderHelper | undefined>
	},
	saves: {
		upload: (remote_name: string, remote_file: string, local_file: string | Buffer) => Promise<boolean>
		download: (remote_name: string, save_file: string) => Promise<DownloaderHelper | undefined>
		downloadAsString: (remote_name: string, save_file: string) => Promise<string | undefined>
		latest: (remote_name: string, save_file: string) => Promise<string | undefined>
	}
}

type PlaneType = "webdav" | "game_api";

const BACK_PLANE = {
  webdav: webdav_bp
} as Record<PlaneType, AppBackPlane>;
let use_bp = "webdav" as PlaneType;

export const remote = {
  list(use_cache: boolean): Promise<Record<string, GOG.RemoteGameData>>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<Record<string, GOG.RemoteGameData>>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].remote.list(use_cache);
  },
  games(use_cache: boolean, remote_games: string[]): Promise<Record<string, GOG.RemoteGameData>>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<Record<string, GOG.RemoteGameData>>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].remote.games(use_cache, remote_games);
  },
  game(remote_name: string, use_cache: boolean): Promise<GOG.RemoteGameData | undefined>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<GOG.RemoteGameData>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].remote.game(remote_name, use_cache);
  },
  uninstall(remote_name: string, script: string): Promise<GOG.UninstallDef | undefined>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<GOG.UninstallDef | undefined>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].remote.uninstall(remote_name, script);
  },
  icon(remote_name: string, game_remote: GOG.RemoteGameData): Promise<string>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<string>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].remote.icon(remote_name, game_remote);
  }
};

export const download = {
  installer(remote_name: string, dl_link: string): Promise<DownloaderHelper | undefined>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<DownloaderHelper | undefined>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].download.installer(remote_name, dl_link);
  }
};

export const saves = {
  upload(remote_name: string, remote_file: string, local_file: string | Buffer): Promise<boolean>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<boolean>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].saves.upload(remote_name, remote_file, local_file);
  },
  download(remote_name: string, save_file: string): Promise<DownloaderHelper | undefined>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<DownloaderHelper | undefined>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].saves.download(remote_name, save_file);
  },
  downloadAsString(remote_name: string, save_file: string): Promise<string | undefined>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<string | undefined>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].saves.downloadAsString(remote_name, save_file);
  },
  latest(remote_name: string, save_file: string): Promise<string | undefined>{
    if(BACK_PLANE[use_bp] === undefined){
      return new Promise<string | undefined>((resolve, reject) => {
        reject("Back plane invalid: " + use_bp + " installed: [" + Object.keys(BACK_PLANE) + "]");
      });
    }
    return BACK_PLANE[use_bp].saves.latest(remote_name, save_file);
  }
};

export default {
  remote,
  download,
  saves
} as AppBackPlane;

export function changeBackPlane(back_plane: PlaneType){
  use_bp = back_plane;
}

export function init(ipcMain: IpcMain){
  ipcMain.on("change-back-plane", (e, back_plane: PlaneType) =>{
    changeBackPlane(back_plane);
  });

}