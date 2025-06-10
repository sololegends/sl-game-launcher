
import { BrowserWindow, ipcMain, IpcMain } from "electron";
import { compressFile, compressFolder, compressGlob, CompressProgress, decompressFile, decompressFolder } from "./tools/compression";
import { DownloaderHelper, ErrorStats, Stats } from "node-downloader-helper";
import { Export, Import, KeyExists, needsAdmin } from "./as_admin/regedit/windows";
import { getConfig, getOS, REMOTE_FILE_BASE } from "./config";
import { globAsync, mutatePath } from "./tools/files";
import { loadFromDataCache, saveToDataCache } from "./cache";
import fs from "fs";
import { Globals } from ".";
import { GOG } from "@/types/gog/game_info";
import { Notify } from "@/types/notification/notify";
import os from "os";
import { saves as saves_bp } from "./backplane";

function isGlob(input: string): boolean{
  return input.includes("*");
}

// ================================================
// SAVE TRACKING
// ================================================

type Saves = {
  [key: string]: number
}

let SAVES = undefined as undefined | Saves;

function slug(slug: string){
  slug = slug.toLowerCase();
  slug = slug.replaceAll(/[^a-z0-9_]/g, "_");
  while(slug.includes("__")){
    slug = slug.replaceAll("__", "_");
  }
  return slug;
}

function saves(): Saves{
  if(SAVES === undefined){
    const str = loadFromDataCache("saves.json", "$$internal$$");
    if(str === undefined){
      SAVES = {};
      return SAVES;
    }
    SAVES = JSON.parse(str) as Saves;
  }
  return SAVES;
}

export function updateSaveTime(game: GOG.GameInfo, time: Date){
  saves()[slug(game.name)] = time.getTime();
  // Save the saves data
  saveToDataCache("saves.json", Buffer.from(JSON.stringify(SAVES, null, 2)), "$$internal$$");
}

export function getSaveTime(game: GOG.GameInfo): number{
  return saves()[slug(game.name)] | -1;
}

export async function updateLocalSaveTime(save: string, date: Date){
  if(isGlob(save)){
    const files = await globAsync(save);
    for(const s of files){
      fs.utimesSync(s, date, date);
    }
    return;
  }
  fs.utimesSync(save, date, date);
}

// ================================================
// END SAVE TRACKING
// ================================================

let win = undefined as undefined | BrowserWindow;
let globals = undefined as undefined | Globals;

// The folder for saves or the folder container the save files
export function procSaveFolder(save_file_raw: string, game: GOG.GameInfo): string | undefined{
  let folder = save_file_raw;
  if(save_file_raw.startsWith("~")){
    folder = os.homedir()  + save_file_raw.substring(1);
  }else if(save_file_raw.startsWith("./")){
    folder = game.root_dir  + save_file_raw.substring(1);
  }else if(save_file_raw.startsWith("{steam}/")){
    folder = game.root_dir  + save_file_raw.substring(1);
  }
  if(save_file_raw.includes("*")){
    folder = save_file_raw.substring(0, save_file_raw.lastIndexOf("*"));
  }
  folder = folder.replaceAll("\\", "/");
  // Find closest folder to the saves
  if(!fs.existsSync(folder)){
    folder = folder.substring(0, folder.lastIndexOf("/"));
  }
  if(!fs.existsSync(folder)){
    return mutatePath(folder, game);
  }
  return mutatePath(folder, game);
}

export function procSaveFile(save_file_raw: string, game: GOG.GameInfo): string{
  return mutatePath(save_file_raw, game);
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

function isReg(input: string): boolean{
  return input.startsWith("REG:") || input.startsWith("REG32:") || input.startsWith("REG64:");
}
function isReg64(input: string): boolean{
  return input.startsWith("REG:") || input.startsWith("REG64:");
}


async function saveGamesExists(game: GOG.GameInfo, saves: GOG.GameSave): Promise<boolean>{
  for(const save in saves){
    if(isReg(saves[save])){
      if(await KeyExists(saves[save].split(":", 2)[1], isReg64(saves[save]))){
        return true;
      }
    }
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
    if(isReg(saves[save])){
      if(await KeyExists(saves[save].split(":", 2)[1], isReg64(saves[save]))){
        if(await Export(saves[save].split(":", 2)[1], save_tmp + save + ".reg", true, isReg64(saves[save]))){
          await compressFile(save_tmp + save + ".reg", save_tmp + save + ".zip", (p: CompressProgress) =>{
            win?.webContents.send("save-game-dl-progress", game.name, "Compressing save: " + save, p);
          }, 6);
          found++;
        }
      }
    }
    if(isGlob(saves[save])){
      await compressGlob(saves[save], save_tmp + save + ".zip", (p: CompressProgress) =>{
        win?.webContents.send("save-game-dl-progress", game.name, "Compressing save: " + save, p);
      }, 6);
      found++;
    }
    if(fs.existsSync(saves[save])){
      if(fs.statSync(saves[save]).isDirectory()){
        await compressFolder(saves[save], save_tmp + save + ".zip", (p: CompressProgress) =>{
          win?.webContents.send("save-game-dl-progress", game.name, "Compressing save: " + save, p);
        }, 6);
        found++;
        continue;
      }
      await compressFile(saves[save], save_tmp + save + ".zip", (p: CompressProgress) =>{
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
      updateLocalSaveTime(saves[save], new Date());
      updateSaveTime(game, new Date());
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
      if(isReg(saves[save])){
        await decompressFile(save_tmp + save + ".zip", save_tmp + save + ".reg", (p: CompressProgress) =>{
          win?.webContents.send("save-game-dl-progress", game.name, "Unpacking save: " + save, p);
        });
        await Import(save_tmp + save + ".reg", isReg64(saves[save]), needsAdmin(saves[save].split(":", 2)[1]));
      }
      if(isGlob(saves[save])){
        folder = saves[save].substring(0, saves[save].replace("\\", "/").lastIndexOf("/"));
      }
      const is_dir = isNaN(save as unknown as number);
      if(is_dir){
        if(!fs.existsSync(folder)){
          fs.mkdirSync(folder, {recursive: true});
        }
        await decompressFolder(save_tmp + save + ".zip", folder, (p: CompressProgress) =>{
          win?.webContents.send("save-game-dl-progress", game.name, "Unpacking save: " + save, p);
        });
        continue;
      }
      await decompressFile(save_tmp + save + ".zip", folder, (p: CompressProgress) =>{
        win?.webContents.send("save-game-dl-progress", game.name, "Unpacking save: " + save, p);
      });
    }
  }

  fs.rmSync(save_tmp, { recursive: true });
  const save_download = game.remote_name + "-save.zip";
  if(fs.existsSync(tmp_dir + "/" + save_download)){
    fs.rmSync(tmp_dir + "/" + save_download);
  }
}

export async function pushSaveToCloud(
  save_path: string, name: string, game_id: string, remote_file: string, loud = true): Promise<boolean>{

  if(loud){
    win?.webContents.send("save-game-dl-progress", name, "Uploading save", {total: -1, progress: -1});
  }
  const result = await saves_bp.upload(game_id, remote_file, save_path);
  console.log("Save file push"
  + " game_id[" + game_id + "]"
  + " remote_file[" + remote_file + "]"
  + " save_path[" + save_path + "] result=", result);
  win?.webContents.send("save-game-stopped");
  return result;
}

export async function uploadGameSave(game: GOG.GameInfo){
  // Check if the cloud save location is specified
  const save_files = getSavesLocation(game);
  if(save_files === undefined){
    return;
  }
  if(!await saveGamesExists(game, save_files)){
    console.log("Failed to find local game save folder!");
    return;
  }
  win?.webContents.send("save-game-sync-start", game.name);

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
  if(fs.statSync(save_zip).size > 209715200){
    globals?.notify({
      title: "Cloud Save",
      text: game.remote_name + " save files over 200MB cannot sync to cloud. Remove some save data to be able to cloud sync again.",
      type: "error",
      sticky: true
    });
    return;
  }


  let text = "Saves for game " + game.remote_name + " synchronized to cloud";
  let type = "success" as Notify.Type;

  if(!await pushSaveToCloud(save_zip, game.name, game.gameId, REMOTE_FILE_BASE + ".zip")){
    text = "Saves for game " + game.remote_name + " failed to synchronize";
    type = "error";
  }

  // Delete tmp save file
  fs.rmSync(save_zip);
  globals?.notify({
    title: "Cloud Save",
    text: text,
    type: type
  });
  win?.webContents.send("save-game-stopped", game);
}

export async function pullSaveFromCloud(name: string, game_id: string, remote_file: string, loud = true){
  if(loud){
    win?.webContents.send("save-game-dl-progress", name, "Downloading", {total: 100, progress: 0});
  }

  return new Promise<string>((resolve, reject) => {
    saves_bp.download(game_id, remote_file).then((active_dl: DownloaderHelper | undefined) => {
      if(active_dl === undefined){
        reject(undefined);return;
      }
      active_dl.on("end", async() => {
        if(loud){
          win?.webContents.send("save-game-sync-state", name, "Cloud save downloaded");
        }
        resolve(active_dl.getDownloadPath());
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
      console.log("Downloading save file: ", game_id, " => ", active_dl.getDownloadPath());
      active_dl.start();
    });
  });
}

async function deployCloudSave(
  game: GOG.GameInfo,
  resolver: (cloud: boolean, local_present: boolean) => void){

  const save_files = getSavesLocation(game);
  if(save_files === undefined){
    return;
  }
  win?.webContents.send("save-game-dl-progress", game.name, "Downloading", {total: 100, progress: 0});

  const save_file = await pullSaveFromCloud(game.name, game.gameId, REMOTE_FILE_BASE + ".zip");
  if(save_file === undefined){
    return resolver(false, true);
  }
  win?.webContents.send("save-game-sync-state", game.name, "Unpacking");
  await unpackGameSave(game, save_files, save_file);
  win?.webContents.send("save-game-stopped", game);
  globals?.notify({
    title: "Cloud Save",
    text: "Saves for game " + game.remote_name + " synchronized locally",
    type: "success"
  });
  return resolver(true, true);
}

async function newerInCloud(
  game: GOG.GameInfo,
  game_id: string,
  remote_save_file: string
): Promise<boolean | -1>{
  const save_files = getSavesLocation(game);
  if(save_files === undefined){
    return false;
  }
  // Check each folder for earliest date
  let oldest = -1;
  // Fall back to old method now
  for(const s in save_files){
    if(isGlob(save_files[s])){
      const files = await globAsync(save_files[s]);
      for(const f of files){
        // If nothing is there, then clearly it is not newer
        if(!fs.existsSync(f)){
          continue;
        }
        const fstat = fs.statSync(f);
        if(oldest === -1 || oldest > fstat.mtimeMs){
          oldest = fstat.mtimeMs;
        }
      }
      continue;
    }
    if(!fs.existsSync(save_files[s])){
      continue;
    }
    const f = fs.statSync(save_files[s]);
    if(oldest === -1 || oldest > f.mtimeMs){
      oldest = f.mtimeMs;
    }
  }
  const remote_latest = await saves_bp.latest(game_id, remote_save_file);
  // If the folder or file doesn't exist remote there is clearly no newer saves
  if(remote_latest === undefined){
    return false;
  }
  // Get save age in cloud
  console.log("oldest:", oldest, "remote_latest:", remote_latest);
  return oldest === 0 ? -1 : oldest + 15000 < remote_latest;
}

export async function syncGameSave(game: GOG.GameInfo, resolver: (cloud: boolean, local_present: boolean) => void){
  // Check if the cloud save location is specified
  const save_files = getSavesLocation(game);
  if(save_files === undefined){
    console.warn("Failed to find save game location for game: ", game);
    return resolver(false, false);
  }

  win?.webContents.send("save-game-sync-start", game.name);
  // Check if newer in cloud
  win?.webContents.send("save-game-sync-search", game.name);
  const newer_in_cloud = await newerInCloud(game, game.gameId, REMOTE_FILE_BASE + ".zip");
  if(!newer_in_cloud){
    win?.webContents.send("save-game-stopped", game);
    return resolver(false, true);
  }

  // At this point we know the file exists, and is newer than local saves

  // Proceed to user request IF the saves existed (newer_in_cloud !== -1)
  if(newer_in_cloud === -1){
    return deployCloudSave(game, resolver);
  }
  return new Promise<void>((resolve) => {
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
      deployCloudSave(game, resolver).then((result) => {
        resolve(result);
      });
      ipcMain.off(evtl, fn.cancel);
    };
    fn.deploy = deploy;
    const cancel = () => {
      resolve(resolver(false, true));
      ipcMain.off(evt, fn.deploy);
    };
    fn.cancel = cancel;
    ipcMain.once(evt, fn.deploy);
    ipcMain.once(evtl, fn.cancel);
  });
  return resolver(false, true);
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