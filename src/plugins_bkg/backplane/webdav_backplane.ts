
import { downloadFile, initWebDav, mutateFolder, webDavConfig } from "../nc_webdav";
import { FileStat, WebDAVClient } from "webdav";
import { getConfig, REMOTE_FOLDER } from "../config";
import { loadFromDataCache, loadFromImageCache, saveToDataCache, saveToImageCache } from "../cache";
import { AppBackPlane } from ".";
import { DownloaderHelper } from "node-downloader-helper";
import fs from "fs";
import { GOG } from "@/types/gog/game_info";
import { IpcMain } from "electron";


type ShortCacheItem = {
  cached: Date
  data: GOG.RemoteGameData
}

// 2 minutes
const SHORT_THRESHOLD = 120_000;
const short_cache = {

} as Record <string, ShortCacheItem>;

let id_mapping = {

} as Record <string, string>;
const id_mapping_inv = {

} as Record <string, string>;



function flattenName(name: string): string{
  return name.trim().toLowerCase().replace(/[^-a-z0-9_]/gm, "_");
}

// Yes this is a hack for backwards compatibility
async function loadIdMap(){
  const web_dav_cfg = webDavConfig();
  const web_dav = await initWebDav();
  const remote_folder = mutateFolder(web_dav_cfg.folder);
  const data_dir = remote_folder + "~internal/id_map.json";
  if(web_dav && await web_dav?.exists(data_dir)){
    id_mapping = JSON.parse((await web_dav.getFileContents(data_dir)).toString());
    if(id_mapping){
      for(const id in id_mapping){
        id_mapping_inv[id_mapping[id]] = id;
      }
    }
  }
}

async function remote_game(game_id: string, use_cache: boolean): Promise<GOG.RemoteGameData | undefined>{
  if(short_cache[game_id] && new Date().getTime() - short_cache[game_id].cached.getTime() < SHORT_THRESHOLD){
    return short_cache[game_id].data;
  }
  if(!id_mapping[game_id]){
    await loadIdMap();
  }
  if(!id_mapping[game_id]){
    return undefined;
  }
  const remote_name = id_mapping[game_id];
  const cache_name = flattenName(remote_name);
  const remote_cache_data = loadFromDataCache("game-data.json", cache_name);
  if(use_cache && remote_cache_data){
    const remote_data = JSON.parse(remote_cache_data);
    if(!remote_data.name){
      remote_data.name = remote_name;
    }
    return remote_data as GOG.RemoteGameData;
  }
  const web_dav_cfg = webDavConfig();
  const web_dav = await initWebDav();
  const remote_folder = mutateFolder(web_dav_cfg.folder) + remote_name;
  const data_dir = remote_folder + "/.data/";
  if(await web_dav?.exists(data_dir)){
    const file_data = await web_dav?.getFileContents(data_dir + "game-data.json").catch(() => {
      return "{}";
    });
    if(file_data instanceof Buffer){
      try{
        const remote_data = JSON.parse(file_data.toString());
        if(!remote_data.name){
          remote_data.name = remote_name;
        }
        remote_data.folder = remote_folder;
        saveToDataCache("game-data.json", Buffer.from(JSON.stringify(remote_data)), cache_name);
        short_cache[remote_data.game_id] = {
          cached: new Date(),
          data: remote_data
        };
        return remote_data as GOG.RemoteGameData;
      }catch(e){
        console.error("Failed to parse game-data.json from server:", e, file_data.toString());
      }
      return undefined;
    }
  }
}

async function remote_list(use_cache: boolean, game_ids?: string[]): Promise<Record<string, GOG.RemoteGameData>>{
  const remote_data = {} as Record<string, GOG.RemoteGameData>;
  const web_dav = await initWebDav();
  const nc_cfg = webDavConfig();
  const promises = [] as Promise<void>[];
  if(Object.keys(id_mapping).length === 0){
    await loadIdMap();
  }
  if(nc_cfg !== undefined && web_dav !== undefined){
    const mutated_folder = mutateFolder(nc_cfg.folder);
    console.log("Reading games folder: ", mutated_folder);
    const contents = await web_dav.getDirectoryContents(mutated_folder) as FileStat[];
    for(const i in contents){
      const file = contents[i] as FileStat;
      const name = file.filename.replace(mutated_folder, "");
      if(!id_mapping_inv[name]){
        await loadIdMap();
      }
      if(!id_mapping_inv[name]){
        continue;
      }
      const game_id = id_mapping_inv[name];
      if(file.type !== "directory" || name.startsWith("~") || (game_ids !== undefined && !game_ids.includes(game_id))){
        continue;
      }
      console.debug("Reading game folder: ", file);
      // Get the remote data payload
      promises.push(new Promise<void>((resolve) => {
        remote_game(game_id, use_cache).then((remote) =>{
          if(remote === undefined){
            resolve();
            return;
          }
          remote.name = name;
          if(!remote.game_id){
            console.log("WARNING: ", name);
            remote.game_id = game_id;
          }
          remote_data[remote.game_id] = remote;
          resolve();
        });
      }));
    }
    await Promise.all(promises);
  }
  return remote_data;
}

async function remote_icon(game_id: string, game_remote: GOG.RemoteGameData): Promise<string>{
  if(!id_mapping[game_id]){
    await loadIdMap();
  }
  if(!id_mapping[game_id]){
    return "404";
  }
  const remote_name = id_mapping[game_id];
  // Check for cached data
  const image = loadFromImageCache(game_remote.logo, game_id);
  if(image instanceof Buffer){
    return "data:" + game_remote.logo_format + ";base64," + image.toString("base64");
  }
  const web_dav = await initWebDav();
  const nc_cfg = webDavConfig();
  const remote_folder = mutateFolder(nc_cfg.folder) + remote_name;
  const data_dir = remote_folder + "/.data/";
  if(nc_cfg !== undefined && web_dav !== undefined && game_remote?.logo){
    const logo_path = data_dir + game_remote.logo;
    const file_data = await web_dav.getFileContents(logo_path).catch((err) => {
      console.log(err);
      return "nothing";
    });
    if(file_data instanceof Buffer){
      saveToImageCache(game_remote.logo, file_data, game_id);
      return "data:" + game_remote.logo_format + ";base64," + file_data.toString("base64");
    }
  }
  return "404";
}

async function remote_uninstall(game_id: string, script: string): Promise<GOG.UninstallDef | undefined>{
  if(!id_mapping[game_id]){
    await loadIdMap();
  }
  if(!id_mapping[game_id]){
    return undefined;
  }
  const remote_name = id_mapping[game_id];
  const web_dav_cfg = webDavConfig();
  const web_dav = await initWebDav();
  const remote_folder = mutateFolder(web_dav_cfg.folder) + remote_name;
  const data_dir = remote_folder + "/.data/";
  if(await web_dav?.exists(data_dir)){
    const uninstall_data = await web_dav?.getFileContents(data_dir + script).catch(() => {
      return "{}";
    });
    if(uninstall_data instanceof Buffer){
      try{
        return JSON.parse(uninstall_data.toString()) as GOG.UninstallDef;
      }catch(e){
        console.error("Failed to parse [" + remote_name + "][" + script + "] from server:", e, uninstall_data.toString());
      }
      return undefined;
    }
  }
}

type DL_shared_tmp = {
	web_dav: WebDAVClient
	remote_save_file: string
}

async function saves_download_shared(game_id: string, save_file: string): Promise<DL_shared_tmp | undefined>{
  if(!id_mapping[game_id]){
    await loadIdMap();
  }
  if(!id_mapping[game_id]){
    return undefined;
  }
  const remote_name = id_mapping[game_id];
  const rf = getConfig("remote_save_folder") as string;
  const remote_save_file = mutateFolder( rf ? rf : REMOTE_FOLDER) + remote_name + "/" + save_file;

  // Initialize the web dav connection
  const web_dav = await initWebDav();
  if(web_dav === undefined){
    return undefined;
  }
  // Check for the save existing in the remote
  console.log("Looking for save file: ", remote_save_file);
  const remote_save_stats = await web_dav.stat(remote_save_file) as FileStat;
  if(remote_save_stats.size === undefined || remote_save_stats.size === 0){
    return undefined;
  }

  return {web_dav, remote_save_file};
}

export default {
  init: async(ipcMain: IpcMain) => {
    ipcMain.removeHandler("login-username");
    ipcMain.handle("login-username", () => {
      return "webdav";
    });
    ipcMain.removeHandler("login");
    ipcMain.handle("login", () => {
      return true;
    });
  },
  remote: {
    list: remote_list,
    games: remote_list,
    game: remote_game,
    uninstall: remote_uninstall,
    icon: remote_icon
  },
  download: {
    async installer(game_id: string, dl_link: string): Promise<DownloaderHelper | undefined>{
      if(!id_mapping[game_id]){
        await loadIdMap();
      }
      if(!id_mapping[game_id]){
        return undefined;
      }
      const remote_name = id_mapping[game_id];
      const web_dav = await initWebDav();
      if(web_dav === undefined){
        return undefined;
      }
      const nc_cfg = webDavConfig();
      const remote_folder = mutateFolder(nc_cfg.folder) + remote_name;
      return downloadFile(web_dav.getFileDownloadLink(remote_folder + "/" + dl_link), dl_link);
    }
  },
  saves: {
    async upload(game_id: string, remote_file: string, local_file: string | Buffer): Promise<boolean>{
      if(!id_mapping[game_id]){
        await loadIdMap();
      }
      if(!id_mapping[game_id]){
        return false;
      }
      const remote_name = id_mapping[game_id];
      const web_dav = await initWebDav({maxBodyLength: 536870912}, true);

      if(web_dav !== undefined){
        const rf = getConfig("remote_save_folder") as string;
        const remote_save_folder = mutateFolder( rf ? rf : REMOTE_FOLDER) + remote_name;
        const remove_save_file = remote_save_folder + "/" + remote_file;
        // Make the game folder here
        if(!await web_dav.exists(remote_save_folder)){
          await web_dav.createDirectory(remote_save_folder, {recursive: true});
        }

        // Time to upload!!
        const read_stream = (local_file instanceof Buffer) ? local_file : fs.createReadStream(local_file);
        const result = await web_dav.putFileContents(remove_save_file + ".new.zip", read_stream);
        if(read_stream instanceof fs.ReadStream){
          read_stream.close();
        }
        // Backup old save if present
        if(result && await web_dav.exists(remove_save_file + ".new.zip")){
          // Backup old save if present
          if(await web_dav.exists(remove_save_file + ".zip")){
            const d = new Date();
            await web_dav.moveFile(
              remove_save_file + ".zip",
              remove_save_file
            + "." + d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate()
            + "." + d.getHours() + "-" + d.getMinutes()
            + ".zip");
          }
          await web_dav.moveFile(remove_save_file + ".new.zip",  remove_save_file + ".zip");
          return true;
        }
      }
      return false;
    },
    async download(game_id: string, save_file: string): Promise<DownloaderHelper | undefined>{
      if(!id_mapping[game_id]){
        await loadIdMap();
      }
      if(!id_mapping[game_id]){
        return undefined;
      }
      const remote_name = id_mapping[game_id];
      // Setup the variables we need
      const save_download = remote_name + "-save.zip";
      const tmp_download = getConfig("gog_path") + "\\.temp\\";

      // Ensure the save file download location is not taken
      if(fs.existsSync(tmp_download + "/" + save_download)){
        fs.rmSync(tmp_download + "/" + save_download);
      }

      const result = await saves_download_shared(remote_name, save_file);
      if(result === undefined){
        return undefined;
      }
      const {web_dav, remote_save_file} = result;

      return downloadFile(web_dav.getFileDownloadLink(remote_save_file), save_download);
    },
    async downloadAsString(game_id: string, save_file: string): Promise<string | undefined>{
      if(!id_mapping[game_id]){
        await loadIdMap();
      }
      if(!id_mapping[game_id]){
        return undefined;
      }
      const remote_name = id_mapping[game_id];
      const result = await saves_download_shared(remote_name, save_file);
      if(result === undefined){
        return undefined;
      }
      const {web_dav, remote_save_file} = result;

      const buffer = await web_dav.getFileContents(remote_save_file);
      if(buffer instanceof Buffer){
        return buffer.toString();
      }
      return buffer as string;
    },
    async latest(game_id: string, save_file: string): Promise<string | undefined>{
      if(!id_mapping[game_id]){
        await loadIdMap();
      }
      if(!id_mapping[game_id]){
        return undefined;
      }
      const remote_name = id_mapping[game_id];
      // Setup the variables we need
      const rf = getConfig("remote_save_folder") as string;
      const remote_save_folder = mutateFolder( rf ? rf : REMOTE_FOLDER) + remote_name;
      const remote_save_file = remote_save_folder + "/" + save_file;

      // Initialize the web dav connection
      const web_dav = await initWebDav();
      if(web_dav === undefined || !(await web_dav.exists(remote_save_folder)) || !(await web_dav.exists(remote_save_file))){
        return undefined;
      }
      const stat = await web_dav.stat(remote_save_file) as FileStat;
      return stat.lastmod;
    }
  }
} as AppBackPlane;