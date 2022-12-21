
import { BrowserWindow, ipcMain, IpcMain } from "electron";
import { compressFolder, compressGlob, CompressProgress, decompressFolder } from "./tools/compression";
import { downloadFile, initWebDav, mutateFolder, webDavConfig } from "./nc_webdav";
import { ErrorStats, Stats } from "node-downloader-helper";
import { FileStat, WebDAVClient } from "webdav";
import { getConfig, getOS, REMOTE_FILE_BASE, REMOTE_FOLDER } from "./config";
import fs from "fs";
import { Globals } from ".";
import { globAsync } from "./tools/files";
import { GOG } from "@/types/gog/game_info";
import os from "os";


let win = undefined as undefined | BrowserWindow;
let globals = undefined as undefined | Globals;

export function procSaveFile(save_file_raw: string, game: GOG.GameInfo){
  if(save_file_raw.startsWith("~")){
    return os.homedir()  + save_file_raw.substring(1);
  }else if(save_file_raw.startsWith("./")){
    return game.root_dir  + save_file_raw.substring(1);
  }else if(save_file_raw.startsWith("<steam>/")){
    return game.root_dir  + save_file_raw.substring(1);
  }
  return save_file_raw;
}

export function getRemoteSaveDirectory(name: string){
  const rf = getConfig("remote_save_folder") as string;
  const mutated_folder = mutateFolder( rf ? rf : REMOTE_FOLDER);
  return mutated_folder + "/" + name;
}

export function getSavesLocation(game: GOG.GameInfo): undefined | GOG.GameSave{
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

function isGlob(input: string): boolean{
  return input.includes("*");
}

async function saveGamesExists(game: GOG.GameInfo, saves: GOG.GameSave): Promise<boolean>{
  for(const save in saves){
    if(isGlob(saves[save])){
      const files = await globAsync(saves[save]);
      for(const s in files){
        if(fs.existsSync(files[s])){
          return true;
        }
      }
    }
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
    if(isGlob(saves[save])){
      await compressGlob(saves[save], save_tmp + save + ".zip", (p: CompressProgress) =>{
        win?.webContents.send("save-game-dl-progress", game.name, "Compressing save: " + save, p);
      }, 6);
      found++;
    }
    if(fs.existsSync(saves[save])){
      await compressFolder(saves[save], save_tmp + save + ".zip", (p: CompressProgress) =>{
        win?.webContents.send("save-game-dl-progress", game.name, "Compressing save: " + save, p);
      }, 6);
      found++;
    }
  }
  if(found <= 0){
    return undefined;
  }
  // Update folder time
  for(const save in saves){
    try{
      if(isGlob(saves[save])){
        const files = await globAsync(saves[save]);
        for(const s of files){
          fs.utimesSync(s, new Date(), new Date());
        }
        continue;
      }
      fs.utimesSync(saves[save], new Date(), new Date());
    }catch(e){
      console.log("Saves folder [" + save + "] not found");
    }
  }

  // Compress final save folder
  const output = tmp_dir + new Date().getTime() + "-save.zip";
  await compressFolder(save_tmp, output, (p: CompressProgress) =>{
    win?.webContents.send("save-game-dl-progress", game.name, "Compressing save: bundle", p);
  }, 0);
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
    win?.webContents.send("save-game-dl-progress", game.name, "Unpacking save: bundle", p);
  });

  // Decompress save packages
  for(const save in saves){
    if(fs.existsSync(save_tmp + save + ".zip")){
      let folder = saves[save];
      if(isGlob(saves[save])){
        folder = saves[save].substring(0, saves[save].replace("\\", "/").lastIndexOf("/"));
      }
      if(!fs.existsSync(folder)){
        fs.mkdirSync(folder, {recursive: true});
      }
      await decompressFolder(save_tmp + save + ".zip", folder, (p: CompressProgress) =>{
        win?.webContents.send("save-game-dl-progress", game.name, "Unpacking save: " + save, p);
      });
    }
  }

  fs.rmSync(save_tmp, { recursive: true });
}

export async function pushSaveToCloud(save_path: string, name: string, remote_folder: string, remote_file: string, loud = true){

  const web_dav = await initWebDav({maxBodyLength: 536870912}, true);

  if(web_dav !== undefined){
    const remote_save_folder = getRemoteSaveDirectory(remote_folder);
    const remove_save_file = remote_save_folder + "/" + remote_file;
    // Make the game folder here
    if(!await web_dav.exists(remote_save_folder)){
      await web_dav.createDirectory(remote_save_folder, {recursive: true});
    }

    // Time to upload!!
    if(loud){
      win?.webContents.send("save-game-dl-progress", name, "Uploading save", {total: -1, progress: -1});
    }
    const read_stream = fs.createReadStream(save_path);
    await web_dav.putFileContents(remove_save_file + ".new.zip", read_stream);
    // Backup old save if present
    if(await web_dav.exists(remove_save_file + ".new.zip")){
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
      win?.webContents.send("save-game-stopped");
    }
    read_stream.close();
  }
}

export async function uploadGameSave(game: GOG.GameInfo){
  // Check if the cloud save location is specified
  const save_files = getSavesLocation(game);
  if(save_files === undefined){
    return;
  }
  if(!await saveGamesExists(game, save_files)){
    globals?.notify({
      title: "Cloud Save",
      text: "Failed to locate saves for game " + game.remote_name,
      type: "warning",
      sticky: true
    });
    console.log("Failed to file local game save folder!");
    return;
  }
  win?.webContents.send("save-game-sync-start", game.name);

  const web_dav = await initWebDav({maxBodyLength: 536870912}, true);
  const nc_cfg = webDavConfig();

  if(nc_cfg !== undefined && web_dav !== undefined){

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

    await pushSaveToCloud(save_zip, game.name, game.remote_name, REMOTE_FILE_BASE);

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

export async function pullSaveFromCloud(name: string, web_dav: WebDAVClient, remote_folder: string, remote_file: string, loud = true){
  if(loud){
    win?.webContents.send("save-game-dl-progress", name, "Downloading", {total: 100, progress: 0});
  }
  const gog_path = getConfig("gog_path");
  const tmp_download = gog_path + "\\.temp\\";
  const save_download = remote_folder + "-save.zip";
  const remote_save_folder = getRemoteSaveDirectory(remote_folder);
  const remove_save_file = remote_save_folder + "/" + remote_file;
  if(fs.existsSync(tmp_download + "/" + save_download)){
    fs.rmSync(tmp_download + "/" + save_download);
  }
  return new Promise<string>((resolve, reject) => {
    console.log("Looking for save file: ", remove_save_file);
    const active_dl = downloadFile(web_dav.getFileDownloadLink(remove_save_file), save_download);
    active_dl.on("end", async() => {
      if(loud){
        win?.webContents.send("save-game-sync-state", name, "Cloud save downloaded");
      }
      resolve(tmp_download + save_download);
    });
    active_dl.on("stop", () => {
      if(loud){
        win?.webContents.send("save-game-stopped", name);
      }
      reject(undefined);
    });
    if(loud){
      active_dl.on("progress.throttled", (p: Stats) => {
        const prog = {
          total: p.total,
          progress: p.downloaded,
          speed: p.speed
        };
        win?.webContents.send("save-game-dl-progress", name, "Downloading", prog);
      });
    }
    active_dl.on("error", (e: ErrorStats) => {
      if(loud){
        win?.webContents.send("save-game-dl-error", e);
      }
      reject(undefined);
    });
    console.log("Downloading save file: ", remove_save_file, " => ", save_download);
    active_dl.start();
  });
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
  win?.webContents.send("save-game-dl-progress", game.name, "Downloading", {total: 100, progress: 0});

  const save_file = await pullSaveFromCloud(game.name, web_dav, game.remote_name, REMOTE_FILE_BASE + ".zip");
  if(save_file === undefined){
    return resolver(false);
  }
  win?.webContents.send("save-game-sync-state", game.name, "Unpacking");
  await unpackGameSave(game, save_files, save_file);
  win?.webContents.send("save-game-stopped", game);
  globals?.notify({
    title: "Cloud Save",
    text: "Saves for game " + game.remote_name + " synchronized locally",
    type: "success"
  });
  resolver(true);
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
    if(isGlob(save_files[s])){
      const files = await globAsync(save_files[s]);
      for(const f of files){
        // If nothing is there, then clearly it is not newer
        if(!fs.existsSync(f)){
          oldest = 0;
          break;
        }
        const fstat = fs.statSync(f);
        if(oldest === -1 || oldest > fstat.mtimeMs){
          oldest = fstat.mtimeMs;
        }
      }
      continue;
    }
    if(!fs.existsSync(save_files[s])){
      oldest = 0;
      break;
    }
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
  return oldest + 15000 < Date.parse(stat.lastmod);
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
    win?.webContents.send("save-game-sync-start", game.name);
    // Check if newer in cloud
    win?.webContents.send("save-game-sync-search", game.name);
    // Generate cloud location
    const remote_save_folder = getRemoteSaveDirectory(game.remote_name);
    const remote_save_file = remote_save_folder + "/" + REMOTE_FILE_BASE + ".zip";
    if(!(await newerInCloud(game, web_dav, remote_save_folder, remote_save_file))){
      win?.webContents.send("save-game-stopped", game);
      return resolver(false);
    }

    // At this point we know the file exists, and is newer than local saves

    // Proceed to user request
    const evt = "use-cloud-save-" + new Date().getTime();
    const evtl = "use-local-save-" + new Date().getTime();
    win?.webContents.send(
      "question",
      "Do you want to keep the local saves or use the cloud save?"
      + "\n\nWARNING: If you use the cloud, all the local saves will be overwritten.",
      "Newer saves for " + game.remote_name + " in cloud",
      {
        header: "Cloud Save Synchronization",
        buttons: [
          { text: "Use Cloud", id: evt },
          { text: "Use Local", id: evtl }
        ]
      }
    );
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
    ipcMain.once(evt, fn.deploy);
    ipcMain.once(evtl, fn.cancel);
    return;
  }else{
    console.error("Failed to get web dav connection for save sync!");
  }
  return resolver(false);
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