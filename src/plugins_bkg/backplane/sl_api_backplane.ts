
import axios, { AxiosError, AxiosResponse } from "axios";
import { DEFAULT_API, getConfig, setConfig } from "../config";
import { loadFromDataCache, loadFromImageCache, saveToDataCache, saveToImageCache } from "../cache";
import { AppBackPlane } from ".";
import { DownloaderHelper } from "node-downloader-helper";
import { ensureDir } from "../tools/files";
import FormData from "form-data";
import fs from "fs";
import { GOG } from "@/types/gog/game_info";
import { IpcMain } from "electron";

let BASE_URL = DEFAULT_API;
let $API = axios.create({
  baseURL: BASE_URL
});

async function remote_game(game_id: string, use_cache: boolean): Promise<GOG.RemoteGameData | undefined>{
  const remote_cache_data = loadFromDataCache("game-data.json", game_id);
  if(use_cache && remote_cache_data){
    const remote_data = JSON.parse(remote_cache_data);
    return remote_data as GOG.RemoteGameData;
  }
  if(getConfig("offline")){
    return undefined;
  }
  return new Promise<GOG.RemoteGameData | undefined>((resolve) => {
    $API.get("/games/" + game_id + "/data").then((response) => {
      saveToDataCache("game-data.json", Buffer.from(JSON.stringify(response.data)), game_id);
      resolve(response.data);
    }).catch((error) => {
      console.error("Failed to load remote game", error);
      resolve(undefined);
    });
  });
}
async function remote_list(use_cache: boolean, game_ids?: string[]): Promise<Record<string, GOG.RemoteGameData>>{
  if(game_ids){
    return new Promise<Record<string, GOG.RemoteGameData>>((resolve) => {
      $API.get("/games/data", {params: {games: game_ids}}).then((response) => {
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

async function remote_uninstall(game_id: string, script: string): Promise<GOG.UninstallDef | undefined>{
  return new Promise<GOG.UninstallDef | undefined>((resolve) => {
    $API.get("/games/" + game_id + "/uninstall/" + script).then((response) => {
      resolve(response.data);
    }).catch((error) => {
      console.error("Failed to load Game uninstall data", error);
      resolve(undefined);
    });
  });
}
async function remote_icon(game_id: string, game_remote: GOG.RemoteGameData): Promise<string>{
  // Check for cached data
  const image = loadFromImageCache(game_remote.logo, game_id);
  if(image instanceof Buffer){
    return "data:" + game_remote.logo_format + ";base64," + image.toString("base64");
  }
  if(getConfig("offline")){
    return "404";
  }
  return new Promise<string>((resolve) => {
    $API.get("/games/" + game_id + "/icon").then((response) => {
      if(response?.data?.image && response.data.image.includes(";base64,")){
        saveToImageCache(game_remote.logo, Buffer.from(response.data.image.split(";base64,")[1], "base64"), game_id);
      }

      resolve(response.data.image);
    }).catch((error) => {
      console.error("Failed to load Game icon data", "/games/" + game_id + "/icon", "\n",   error);
      resolve("404");
    });
  });
}

interface APILoginResult extends AxiosResponse {
  data: {
    username: string,
    result: string,
    message: string,
    token: string,
    first_name: string,
    last_name: string,
    realm: "LOCAL",
    roles: (
      "NONE" |
      "GUEST" |
      "AUDITOR" |
      "USER" |
      "ADMIN" |
      "ROOT"
    )[],
    high_role: "NONE" |
    "GUEST" |
    "AUDITOR" |
    "USER" |
    "ADMIN" |
    "ROOT"
  }
}

type Credentials = {
  user: string
  pass: string
}

async function login(api_creds: Credentials): Promise<boolean | string>{
  // Call the login function
  return new Promise<boolean | string>((resolve) => {
    $API.post("/auth/login", {
      password: api_creds.pass,
      username: api_creds.user
    }).then((response: APILoginResult) => {
      if(response.data.token){
        setConfig("sl_api_key", response.data.token, true);
        $API.defaults.headers.common.Authorization = "Bearer " + response.data.token;
        resolve(true);
      }
      resolve("Failed to login");
    }).catch((err: AxiosError) => {
      let message = null;
      if(err.response === undefined){
        message = "Unable to connect to the server";
      } else if(err.response.data === undefined){
        message = "Unable to complete request";
      } else if(err.response.data.message !== undefined){
        message = err.response.data.message;
      } else{
        message = "Unknown API Error";
      }
      resolve(message);
    });
  });
}

async function loginListener(e: unknown, creds?: Credentials): Promise<string | boolean>{
  const api_creds = creds || getConfig("api") as Credentials;
  if(!api_creds?.user || !api_creds?.pass){
    return "Username and Password Required";
  }
  return await login(api_creds);
}

export async function cliInit(){
  console.log("Initializing SL API Backplane");
  BASE_URL = getConfig("remote_api") || DEFAULT_API;
  console.log("Using API Backend: ", BASE_URL);
  $API = axios.create({
    baseURL: BASE_URL
  });
  return loginListener(undefined);
}

async function init(ipcMain: IpcMain){
  BASE_URL = getConfig("remote_api") || DEFAULT_API;
  console.log("Using API Backend: ", BASE_URL);
  $API = axios.create({
    baseURL: BASE_URL
  });
  ipcMain.removeHandler("login");
  ipcMain.handle("login", loginListener);
  ipcMain.handleOnce("login-username", () => {
    const api_creds = getConfig("api") as Credentials;
    return api_creds?.user;
  });

  ipcMain.removeHandler("change-password");
  ipcMain.handle("change-password", async(e, user: string, pass: string, new_pass: string) => {
    const api_creds = getConfig("api") as Credentials;
    if(!api_creds?.user){
      return "No username defined";
    }
    const logged_in = getConfig("sl_api_key") !== undefined;
    return new Promise<boolean | string>((resolve) => {
      $API.put((logged_in ? "/auth/" + user + "/password/set" : "/auth/" + user + "/na/password/set"),
        {
          current_password: pass,
          new_password: new_pass
        }).then(() => {
        resolve(true);
      }).catch((err: AxiosError) => {
        let message = null;
        if(err.response === undefined){
          message = "Unable to connect to the server";
        } else if(err.response.data === undefined){
          message = "Unable to complete request";
        } else if(err.response.data.message !== undefined){
          message = err.response.data.message;
        } else{
          message = "Unknown API Error";
        }
        resolve(message);
      });
    });
  });
}

export default {
  init,
  remote: {
    list: remote_list,
    games: remote_list,
    game: remote_game,
    uninstall: remote_uninstall,
    icon: remote_icon
  },
  download: {
    async installer(game_id: string, dl_link: string): Promise<DownloaderHelper | undefined>{
      const gog_path = getConfig("gog_path");
      const api_key = getConfig("sl_api_key");
      if(api_key === undefined){
        return undefined;
      }
      const tmp_download = gog_path + "\\.temp\\";
      ensureDir(tmp_download);
      return new DownloaderHelper(BASE_URL + "/games/" + game_id + "/download/" + dl_link, tmp_download, {
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
    async upload(game_id: string, remote_file: string, local_file: string | Buffer): Promise<boolean>{
      const form = new FormData();
      if(local_file instanceof Buffer){
        // Initialize stream
        form.append("save_file", local_file, remote_file);
      }else{
        form.append("save_file", fs.createReadStream(local_file), remote_file);
      }
      return new Promise<boolean>((resolve) => {
        $API.put("/games/" + game_id + "/save", form, {
          maxBodyLength: 209715200,
          headers: {
            ...form.getHeaders()
          }
        })
          .then(() => {
            resolve(true);
          })
          .catch((e) => {
            console.error(e);
            resolve(false);
          });
      });
    },
    async download(game_id: string, save_file: string): Promise<DownloaderHelper | undefined>{
      const gog_path = getConfig("gog_path");
      const api_key = getConfig("sl_api_key");
      if(api_key === undefined){
        return undefined;
      }
      const tmp_download = gog_path + "\\.temp\\";
      ensureDir(tmp_download);

      return new DownloaderHelper(BASE_URL + "/games/" + game_id + "/save", tmp_download, {
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
    async downloadAsString(game_id: string, save_file: string): Promise<string | undefined>{
      return new Promise<string | undefined>((resolve) => {
        $API.get("/games/" + game_id + "/save", {params: {as_string: true, file_name: save_file}})
          .then((response) => {
            resolve(Buffer.from(response.data?.data, "base64").toString());
          })
          .catch(() => {
            resolve(undefined);
          });
      });
    },
    async latest(game_id: string, save_file: string): Promise<string | undefined>{
      return new Promise<string | undefined>((resolve) => {
        $API.get("/games/" + game_id + "/save/lastmod", {params: {file_name: save_file}})
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