
import { BrowserWindow, ipcMain, IpcMain } from "electron";
import { compressFolder, CompressProgress, decompressFolder } from "./tools/compression";
import { downloadFile, initWebDav, mutateFolder, webDavConfig } from "./nc_webdav";
import { ErrorStats, Stats } from "node-downloader-helper";
import { FileStat, WebDAVClient } from "webdav";
import { getConfig, getOS, REMOTE_FILE_BASE, REMOTE_FOLDER } from "./config";
import fs from "fs";
import { Globals } from ".";
import { GOG } from "@/types/gog/game_info";
import os from "os";


let win = undefined as undefined | BrowserWindow;
let globals = undefined as undefined | Globals;

function procSaveFile(save_file_raw: string, game: GOG.GameInfo){
  if(save_file_raw.startsWith("~")){
    return os.homedir()  + save_file_raw.substring(1);
  }else if(save_file_raw.startsWith("./")){
    return game.root_dir  + save_file_raw.substring(1);
  }else if(save_file_raw.startsWith("<steam>/")){
    return game.root_dir  + save_file_raw.substring(1);
  }
  return save_file_raw;
}

function getRemoteSaveDirectory(game: GOG.GameInfo){
  const rf = getConfig("remote_save_folder") as string;
  const mutated_folder = mutateFolder( rf ? rf : REMOTE_FOLDER);
  return mutated_folder + "/" + game.remote_name;
}

function getSavesLocation(game: GOG.GameInfo): undefined | GOG.GameSave{
  const saves = game.remote?.saves as GOG.GameSavesLocation;
  if(saves){
    const os = getOS();
    if(saves[os]){
      const g_save =  (typeof saves[os] === "object" ? saves[os] : { "base": saves[os] }) as GOG.GameSave;
      // Process the save paths
      for(const key in g_save){
        g_save[key] = procSaveFile(g_save[key], game);
      }
      return g_save;
    }
  }
  return undefined;
}

function saveGamesExists(game: GOG.GameInfo, saves: GOG.GameSave): boolean{
  for(const save in saves){
    if(fs.existsSync(saves[save])){
      return true;
    }
  }
  return false;
}

async function packGameSave(game: GOG.GameInfo, saves: GOG.GameSave): Promise<string | undefined>{
  const gog_path = getConfig("gog_path");
  const tmp_dir = gog_path + "\\.temp\\";
  const save_tmp = tmp_dir + "save_prep\\";
  // Package each to a unique file, then compress them all together
  fs.mkdirSync(save_tmp, { recursive: true });

  let found = 0;
  for(const save in saves){
    if(fs.existsSync(saves[save])){
      await compressFolder(saves[save], save_tmp + save + ".zip", (p: CompressProgress) =>{
        win?.webContents.send("save-game-dl-progress", game, "Compressing save: " + save, p);
      });
      found++;
    }
  }
  if(found <= 0){
    return undefined;
  }

  // Compress final save folder
  const output = tmp_dir + new Date().getTime() + "-save.zip";
  await compressFolder(save_tmp, output, (p: CompressProgress) =>{
    win?.webContents.send("save-game-dl-progress", game, "Compressing save: bundle", p);
  }, 4);
  fs.rmSync(save_tmp, { recursive: true });
  return output;
}

async function unpackGameSave(game: GOG.GameInfo, saves: GOG.GameSave, save_package: string): Promise<void>{
  const gog_path = getConfig("gog_path");
  const tmp_dir = gog_path + "\\.temp\\";
  const save_tmp = tmp_dir + "save_prep\\";
  // Decompress master package
  fs.mkdirSync(save_tmp, { recursive: true });
  await decompressFolder(save_package, save_tmp, (p: CompressProgress) =>{
    win?.webContents.send("save-game-dl-progress", game, "Unpacking save: bundle", p);
  });

  // Decompress save packages
  for(const save in saves){
    if(fs.existsSync(save_tmp + save + ".zip")){
      await decompressFolder(save_tmp + save + ".zip", saves[save], (p: CompressProgress) =>{
        win?.webContents.send("save-game-dl-progress", game, "Unpacking save: " + save, p);
      });
    }
  }

  fs.rmSync(save_tmp, { recursive: true });
}

export async function uploadGameSave(game: GOG.GameInfo){
  // Check if the cloud save location is specified
  const save_files = getSavesLocation(game);
  if(save_files === undefined){
    return;
  }
  if(!saveGamesExists(game, save_files)){
    globals?.notify({
      title: "Cloud Save",
      text: "Failed to locate saves for game " + game.remote_name,
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
    const remove_save_file = remote_save_folder + "/" + REMOTE_FILE_BASE + ".zip";
    // Make the game folder here
    if(!await web_dav.exists(remote_save_folder)){
      await web_dav.createDirectory(remote_save_folder, {recursive: true});
    }

    const save_zip = await packGameSave(game, save_files);
    if(save_zip === undefined){
      globals?.notify({
        title: "Cloud Save",
        text: "Failed to package saves for " + game.remote_name,
        type: "error",
        sticky: true
      });
      return;
    }

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
            + ".zip");
      }
      await web_dav.moveFile(remove_save_file + ".new",  remove_save_file);
      // Update folder time
      for(const save in save_files){
        fs.utimesSync(save_files[save], new Date(), new Date());
      }
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
  resolver: (cloud: boolean) => void){

  const save_files = getSavesLocation(game);
  if(save_files === undefined){
    return;
  }

  win?.webContents.send("save-game-dl-progress", game, "Downloading", {total: 100, progress: 0});
  const gog_path = getConfig("gog_path");
  const tmp_download = gog_path + "\\.temp\\";
  const save_download = game.remote_name + "-save.zip";
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
    await unpackGameSave(game, save_files, tmp_download + save_download);
    win?.webContents.send("save-game-stopped", game);
    globals?.notify({
      title: "Cloud Save",
      text: "Saves for game " + game.remote_name + " synchronized locally",
      type: "success"
    });
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

async function newerInCloud(
  game: GOG.GameInfo,
  web_dav: WebDAVClient,
  remote_save_folder: string,
  remote_save_file: string
): Promise<boolean>{
  const save_files = getSavesLocation(game);
  if(save_files === undefined){
    return false;
  }
  // Check each folder for earliest date
  let oldest = -1;
  for(const s in save_files){
    const f = fs.statSync(save_files[s]);
    if(oldest === -1 || oldest > f.mtimeMs){
      oldest = f.mtimeMs;
    }
  }
  // If the folder or file doesn't exist remote there is clearly no newer saves
  if(!(await web_dav.exists(remote_save_folder)) || !(await web_dav.exists(remote_save_file))){
    return false;
  }
  // Get save age in cloud
  const stat = await web_dav.stat(remote_save_file) as FileStat;
  console.log("oldest:", oldest, "Date.parse(stat.lastmod):", Date.parse(stat.lastmod));
  return oldest < Date.parse(stat.lastmod);
}

export async function syncGameSave(game: GOG.GameInfo, resolver: (cloud: boolean) => void){
  // Check if the cloud save location is specified
  const save_files = getSavesLocation(game);
  if(save_files === undefined){
    console.warn("Failed to find save game location for game: ", game);
    return resolver(false);
  }
  const web_dav = await initWebDav();
  const nc_cfg = webDavConfig();

  if(nc_cfg !== undefined && web_dav !== undefined){
    win?.webContents.send("save-game-sync-start", game);
    // Check if newer in cloud
    win?.webContents.send("save-game-sync-search", game);
    // Generate cloud location
    const remote_save_folder = getRemoteSaveDirectory(game);
    const remote_save_file = remote_save_folder + "/" + REMOTE_FILE_BASE + ".zip";
    if(!(await newerInCloud(game, web_dav, remote_save_folder, remote_save_file))){
      win?.webContents.send("save-game-stopped", game);
      return resolver(false);
    }

    // At this point we know the file exists, and is newer than local saves

    // Proceed to user request
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
    const fn = {
      deploy: ()=> {
        // Nothing
      },
      cancel: ()=> {
        // Nothing
      }
    };
    const deploy = () => {
      deployCloudSave(game, web_dav, remote_save_file, resolver);
      ipcMain.off(evtl, fn.cancel);
    };
    fn.deploy = deploy;
    const cancel = () => {
      resolver(false);
      ipcMain.off(evt, fn.deploy);
    };
    fn.cancel = cancel;
    ipcMain.once(evt, deploy);
    ipcMain.once(evtl, cancel);
    return;
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