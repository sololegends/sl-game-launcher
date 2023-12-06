
import { BrowserWindow, IpcMain } from "electron";
import { AppBackPlane } from ".";
import { DownloaderHelper } from "node-downloader-helper";
import { GOG } from "@/types/gog/game_info";


export default {
  init: (ipcMain: IpcMain, window?: BrowserWindow) => { return; },
  remote: {
    async list(use_cache: boolean): Promise<Record<string, GOG.RemoteGameData>>{
      return {};
    },
    async games(use_cache: boolean, game_ids: string[]): Promise<Record<string, GOG.RemoteGameData>>{
      return {};
    },
    async game(game_id: string, use_cache: boolean): Promise<GOG.RemoteGameData | undefined>{
      return undefined;
    },
    async uninstall(game_id: string, script: string): Promise<GOG.UninstallDef | undefined>{
      return undefined;
    },
    async icon(game_id: string, game_remote: GOG.RemoteGameData): Promise<string>{
      return "none";
    }
  },
  download: {
    async installer(game_id: string, dl_link: string): Promise<DownloaderHelper | undefined>{
      return undefined;
    }
  },
  saves: {
    async upload(game_id: string, remote_file: string, local_file: string | Buffer): Promise<boolean>{
      return false;
    },
    async download(game_id: string, save_file: string): Promise<DownloaderHelper | undefined>{
      return undefined;
    },
    async downloadAsString(game_id: string, save_file: string): Promise<string | undefined>{
      return undefined;
    },
    async latest(game_id: string, save_file: string): Promise<string | undefined>{
      return undefined;
    }
  }
} as AppBackPlane;