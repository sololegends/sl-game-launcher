
import { DEFAULT_API, getConfig } from "../config";
import { loadFromDataCache, loadFromImageCache, saveToDataCache, saveToImageCache } from "../cache";
import { AppBackPlane } from ".";
import axios from "axios";
import { DownloaderHelper } from "node-downloader-helper";
import { ensureDir } from "../tools/files";
import FormData from "form-data";
import fs from "fs";
import { GOG } from "@/types/gog/game_info";

const BASE_URL = getConfig("remote_api") || DEFAULT_API;
const $API = axios.create({
  baseURL: BASE_URL
});

function flattenName(name: string): string{
  return name.trim().toLowerCase().replace(/[^-a-z0-9_]/gm, "_");
}

async function remote_game(remote_name: string, use_cache: boolean): Promise<GOG.RemoteGameData | undefined>{
  const cache_name = flattenName(remote_name);
  const remote_cache_data = loadFromDataCache("game-data.json", cache_name);
  if(use_cache && remote_cache_data){
    const remote_data = JSON.parse(remote_cache_data);
    return remote_data as GOG.RemoteGameData;
  }
  return new Promise<GOG.RemoteGameData | undefined>((resolve) => {
    $API.get("/games/" + remote_name + "/data").then((response) => {
      saveToDataCache("game-data.json", Buffer.from(JSON.stringify(response.data)), cache_name);
      resolve(response.data);
    }).catch((error) => {
      console.error("Failed to load Games list", error);
      resolve(undefined);
    });
  });
}
async function remote_list(use_cache: boolean, remote_names?: string[]): Promise<Record<string, GOG.RemoteGameData>>{
  if(remote_names){
    return new Promise<Record<string, GOG.RemoteGameData>>((resolve) => {
      $API.get("/games/data", {params: {games: remote_names}}).then((response) => {
        resolve(response.data);
      }).catch((error) => {
        console.error("Failed to load filtered Games list", error);
        resolve({});
      });
    });
  }
  return new Promise<Record<string, GOG.RemoteGameData>>((resolve) => {
    $API.get("/games/all/data").then((response) => {
      resolve(response.data);
    }).catch((error) => {
      console.error("Failed to load Games list", error);
      resolve({});
    });
  });
}

async function remote_uninstall(remote_name: string, script: string): Promise<GOG.UninstallDef | undefined>{
  return new Promise<GOG.UninstallDef | undefined>((resolve) => {
    $API.get("/games/" + remote_name + "/uninstall/" + script).then((response) => {
      resolve(response.data);
    }).catch((error) => {
      console.error("Failed to load Game uninstall data", error);
      resolve(undefined);
    });
  });
}
async function remote_icon(remote_name: string, game_remote: GOG.RemoteGameData): Promise<string>{
  // Check for cached data
  const image = loadFromImageCache(game_remote.logo, game_remote.slug);
  if(image instanceof Buffer){
    return "data:" + game_remote.logo_format + ";base64," + image.toString("base64");
  }
  return new Promise<string>((resolve) => {
    $API.get("/games/" + remote_name + "/icon").then((response) => {
      if(response.data.image.include(";base64,")){
        saveToImageCache(game_remote.logo, Buffer.from(response.data.image.split(";base64,")[1]), game_remote.slug);
      }

      resolve(response.data.image);
    }).catch((error) => {
      console.error("Failed to load Game uninstall data", error);
      resolve("404");
    });
  });
}

export default {
  remote: {
    list: remote_list,
    games: remote_list,
    game: remote_game,
    uninstall: remote_uninstall,
    icon: remote_icon
  },
  download: {
    async installer(remote_name: string, dl_link: string): Promise<DownloaderHelper | undefined>{
      const gog_path = getConfig("gog_path");
      const api_key = getConfig("sl_api_key");
      if(api_key === undefined){
        return undefined;
      }
      const tmp_download = gog_path + "\\.temp\\";
      ensureDir(tmp_download);
      return new DownloaderHelper(BASE_URL + "/games/" + remote_name + "/download/" + dl_link, tmp_download, {
        headers: {
          "Authorization": "Bearer " + api_key
        },
        fileName: dl_link,
        resumeIfFileExists: false,
        removeOnStop: true,
        removeOnFail: true,
        progressThrottle: 500
      });
    }
  },
  saves: {
    async upload(remote_name: string, remote_file: string, local_file: string | Buffer): Promise<boolean>{
      const file_data = new FormData();
      file_data.append("file", fs.createReadStream(local_file), remote_file);
      return new Promise<boolean>((resolve) => {
        $API.put("/games/" + remote_name + "/save", file_data)
          .then(() => {
            resolve(true);
          })
          .catch(() => {
            resolve(false);
          });
      });
    },
    async download(remote_name: string, save_file: string): Promise<DownloaderHelper | undefined>{
      const gog_path = getConfig("gog_path");
      const api_key = getConfig("sl_api_key");
      if(api_key === undefined){
        return undefined;
      }
      const tmp_download = gog_path + "\\.temp\\";
      ensureDir(tmp_download);

      return new DownloaderHelper(BASE_URL + "/games/" + remote_name + "/save", tmp_download, {
        headers: {
          "Authorization": "Bearer " + api_key
        },
        fileName: save_file,
        resumeIfFileExists: false,
        removeOnStop: true,
        removeOnFail: true,
        progressThrottle: 500
      });
    },
    async downloadAsString(remote_name: string, save_file: string): Promise<string | undefined>{
      return new Promise<string | undefined>((resolve) => {
        $API.get("/games/" + remote_name + "/save", {params: {as_string: true, file_name: save_file}})
          .then((response) => {
            resolve(Buffer.from(response.data?.data, "base64").toString());
          })
          .catch(() => {
            resolve(undefined);
          });
      });
    },
    async latest(remote_name: string, save_file: string): Promise<string | undefined>{
      return new Promise<string | undefined>((resolve) => {
        $API.get("/games/" + remote_name + "/save/lastmod", {params: {file_name: save_file}})
          .then((response) => {
            resolve(response.data?.lastmod);
          })
          .catch(() => {
            resolve(undefined);
          });
      });
    }
  }
} as AppBackPlane;