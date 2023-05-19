
import { AppBackPlane } from ".";
import { DownloaderHelper } from "node-downloader-helper";
import { GOG } from "@/types/gog/game_info";


export default {
  remote: {
    async list(use_cache: boolean): Promise<Record<string, GOG.RemoteGameData>>{
      return {};
    },
    async games(use_cache: boolean, remote_names: string[]): Promise<Record<string, GOG.RemoteGameData>>{
      return {};
    },
    async game(remote_name: string, use_cache: boolean): Promise<GOG.RemoteGameData | undefined>{
      return undefined;
    },
    async uninstall(remote_name: string, script: string): Promise<GOG.UninstallDef | undefined>{
      return undefined;
    },
    async icon(remote_name: string, game_remote: GOG.RemoteGameData): Promise<string>{
      return "none";
    }
  },
  download: {
    async installer(remote_name: string, dl_link: string): Promise<DownloaderHelper | undefined>{
      return undefined;
    }
  },
  saves: {
    async upload(remote_name: string, remote_file: string, local_file: string | Buffer): Promise<boolean>{
      return false;
    },
    async download(remote_name: string, save_file: string): Promise<DownloaderHelper | undefined>{
      return undefined;
    },
    async downloadAsString(remote_name: string, save_file: string): Promise<string | undefined>{
      return undefined;
    },
    async latest(remote_name: string, save_file: string): Promise<string | undefined>{
      return undefined;
    }
  }
} as AppBackPlane;