
import { BrowserWindow, ipcMain, IpcMain } from "electron";
import { compressFolder, CompressProgress } from "./tools/compression";
import { downloadFile, initWebDav, mutateFolder, webDavConfig } from "./nc_webdav";
import { ErrorStats, Stats } from "node-downloader-helper";
import { FileStat, WebDAVClient } from "webdav";
import fs from "fs";
import { getConfig } from "./config";
import { Globals } from ".";
import { GOG } from "@/types/gog/game_info";
import os from "os";
import zip from "node-stream-zip";

// CONFIG ==>
const REMOTE_FOLDER = ".game-saves";
const REMOTE_FILE = "save.zip";
// <== CONFIG

let win = undefined as undefined | BrowserWindow;
let globals = undefined as undefined | Globals;

function procSaveFile(save_file_raw: string, game: GOG.GameInfo){
  if(save_file_raw.startsWith("~")){
    return os.homedir()  + save_file_raw.substring(1);
  }else if(save_file_raw.startsWith("./")){
    return game.root_dir  + save_file_raw.substring(1);
  }
  return save_file_raw;
}

function getRemoteSaveDirectory(game: GOG.GameInfo){
  const rf = getConfig("remote_save_folder") as string;
  const mutated_folder = mutateFolder( rf ? rf : REMOTE_FOLDER);
  return mutated_folder + "/" + game.remote_name;
}

export async function uploadGameSave(game: GOG.GameInfo){
  // Check if the cloud save location is specified
  const save_file_raw = game?.remote?.save_location;
  if(save_file_raw === undefined){
    return;
  }
  const local_save_folder = procSaveFile(save_file_raw, game);
  if(!fs.existsSync(local_save_folder)){
    globals?.notify({
      title: "Cloud Save",
      text: "Failed to locate saves for game " + game.remote_name + " in folder: " + local_save_folder,
      type: "warning",
      sticky: true
    });
    console.log("Failed to file local game save folder!");
    return;
  }
  win?.webContents.send("save-game-sync-start", game);

  const web_dav = await initWebDav({maxBodyLength: 536870912}, true);
  const nc_cfg = webDavConfig();

  if(nc_cfg !== undefined && web_dav !== undefined){
    const remote_save_folder = getRemoteSaveDirectory(game);
    const remove_save_file = remote_save_folder + "/" + REMOTE_FILE;
    // Make the game folder here
    if(!await web_dav.exists(remote_save_folder)){
      await web_dav.createDirectory(remote_save_folder, {recursive: true});
    }
    const gog_path = getConfig("gog_path");
    const tmp_dir = gog_path + "\\.temp\\";
    // Compress the save file
    const save_zip = tmp_dir + new Date().getTime() + "-save.zip";
    win?.webContents.send("save-game-dl-progress", game, "Compressing save", {total: 100, progress: 0});
    // ========== FILE ZIPPING ==========
    await compressFolder(local_save_folder, save_zip, (p: CompressProgress) =>{
      win?.webContents.send("save-game-dl-progress", game, "Compressing save", p);
    });

    // Time to upload!!
    win?.webContents.send("save-game-dl-progress", game, "Uploading save", {total: -1, progress: -1});
    const read_stream = fs.createReadStream(save_zip);
    await web_dav.putFileContents(remove_save_file + ".new", read_stream);
    // Backup old save if present
    if(await web_dav.exists(remove_save_file + ".new")){
      // Backup old save if present
      if(await web_dav.exists(remove_save_file)){
        const d = new Date();
        await web_dav.moveFile(
          remove_save_file,
          remove_save_file
            + "." + d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate()
            + "." + d.getHours() + "-" + d.getMinutes()
            + ".old");
      }
      await web_dav.moveFile(remove_save_file + ".new",  remove_save_file);
      // Update folder time
      fs.utimesSync(local_save_folder, new Date(), new Date());
    }
    read_stream.close();
    // Delete tmp save file
    fs.rmSync(save_zip);
    globals?.notify({
      title: "Cloud Save",
      text: "Saves for game " + game.remote_name + " synchronized to cloud",
      type: "success"
    });
  }
  win?.webContents.send("save-game-stopped", game);
}

async function deployCloudSave(
  game: GOG.GameInfo,
  web_dav: WebDAVClient,
  remove_save_file: string,
  local_save_folder: string,
  resolver: (cloud: boolean) => void){
  win?.webContents.send("save-game-dl-progress", game, "Downloading", {total: 100, progress: 0});
  const gog_path = getConfig("gog_path");
  const tmp_download = gog_path + "\\.temp\\";
  const save_download = game.name + "-save.zip";
  if(fs.existsSync(tmp_download + "/" + save_download)){
    fs.rmSync(tmp_download + "/" + save_download);
  }
  const active_dl = downloadFile(web_dav.getFileDownloadLink(remove_save_file), save_download);
  active_dl.on("end", async() => {
    win?.webContents.send("save-game-sync-state", game, "Cloud save downloaded");
    globals?.notify({
      title: "Cloud Save",
      text: "Unpacking cloud saves for game " + game.remote_name + "...",
      type: "info"
    });
    win?.webContents.send("save-game-sync-state", game, "Unpacking");
    const archive = new zip.async({file: tmp_download + save_download});
    const total_count = await archive.entriesCount;
    let ex_count = 0;
    win?.webContents.send("save-game-dl-progress", game, "Unpacking", {total: total_count, progress: ex_count});
    archive.on("extract", () => {
      ex_count++;
      win?.webContents.send("save-game-dl-progress", game, "Unpacking", {total: total_count, progress: ex_count});
    });
    // Remove old save folder
    if(fs.existsSync(local_save_folder)){
      fs.rmSync(local_save_folder, {recursive: true});
    }
    const count = await archive.extract(null, local_save_folder);
    console.log("Extracted:" + count);
    win?.webContents.send("save-game-stopped", game);
    globals?.notify({
      title: "Cloud Save",
      text: "Saves for game " + game.remote_name + " synchronized locally",
      type: "success"
    });
    await archive.close();
    resolver(true);
  });
  active_dl.on("stop", () => {
    win?.webContents.send("save-game-stopped", game);
    resolver(false);
  });
  active_dl.on("progress.throttled", (p: Stats) => {
    const prog = {
      total: p.total,
      progress: p.downloaded,
      speed: p.speed
    };
    win?.webContents.send("save-game-dl-progress", game, "Downloading", prog);
  });
  active_dl.on("error", (e: ErrorStats) => {
    win?.webContents.send("save-game-dl-error", game, e);
    resolver(false);
  });
  active_dl.start();
}

export async function syncGameSave(game: GOG.GameInfo, resolver: (cloud: boolean) => void){
  // Check if the cloud save location is specified
  const save_file_raw = game?.remote?.save_location;
  if(save_file_raw === undefined){
    console.warn("Failed to find save game location for game: ", game);
    return resolver(false);
  }
  const web_dav = await initWebDav();
  const nc_cfg = webDavConfig();

  if(nc_cfg !== undefined && web_dav !== undefined){
    win?.webContents.send("save-game-sync-start", game);
    const remote_save_folder = getRemoteSaveDirectory(game);
    console.log("remote_save_folder", remote_save_folder);
    const local_save_folder = procSaveFile(save_file_raw, game);
    const remove_save_file = remote_save_folder + "/" + REMOTE_FILE;
    // Make the game folder here
    if(!(await web_dav.exists(remote_save_folder))){
      win?.webContents.send("save-game-stopped", game);
      return resolver(false);
    }

    win?.webContents.send("save-game-sync-search", game);
    console.log("Looking for file: ", remove_save_file);
    if(await web_dav.exists(remove_save_file)){
      // Check if it is newer than the local files
      const local_stat = fs.statSync(local_save_folder);
      const remote_stat = await web_dav.stat(remove_save_file) as FileStat;
      if((local_stat.mtimeMs + 10000) < Date.parse(remote_stat.lastmod)){
        const evt = "use-cloud-save-" + new Date().getTime();
        const evtl = "use-local-save-" + new Date().getTime();
        globals?.notify({
          title: "Cloud Save",
          text: "Newer saves for game " + game.remote_name + " in cloud",
          type: "info",
          actions: [
            {
              name: "Use cloud save",
              event: evt,
              clear: true
            },
            {
              name: "Use local save",
              event: evtl,
              clear: true
            }
          ],
          sticky: true
        });
        win?.webContents.send("save-game-stopped", game);
        ipcMain.once(evt, () => {
          deployCloudSave(game, web_dav, remove_save_file, local_save_folder, resolver);
        });
        ipcMain.once(evtl, () => {
          resolver(false);
        });
        return;
      }
      win?.webContents.send("save-game-stopped", game);
    }
  }else{
    console.error("Failed to get web dav connection for save sync!");
  }
  resolver(false);
}

export default function init(ipcMain: IpcMain, _win: BrowserWindow, _globals: Globals){
  win = _win;
  globals = _globals;
  ipcMain.on("sync-game-save", async(e, game: GOG.GameInfo) => {
    syncGameSave(game, (b: boolean) => {
      console.log((b ? "Cloud" : "Local") + " game saves used for " + game.remote_name);
    });
  });
  ipcMain.on("upload-game-save", async(e, game: GOG.GameInfo) => {
    uploadGameSave(game);
  });
}