

import { acquireLock, DOWNLOAD, DOWNLOAD_SEQUENCE, LockAbortToken, releaseLock } from "../tools/locks";
import { downloadFile, initWebDav } from "../nc_webdav";
import { notify, win } from "..";
import { ensureDir } from "../tools/files";
import { ensureRemote } from "../game_loader";
import fs from "fs";
import { getConfig } from "../config";
import { GOG } from "@/types/gog/game_info";
import { Stats } from "node-downloader-helper";


function nrd(game: GOG.GameInfo){
  notify({
    type: "error",
    title: "Failed to start download: No Remote Data",
    text: game.name
  });
  win()?.webContents.send("game-dl-error", game, false);
  win()?.webContents.send("progress-banner-error", "Failed to start download: No Remote Data");
  return;
}

export function cleanupDownloaded(dl_link_set: string[]){
  for(const i in dl_link_set){
    const dl = dl_link_set[i];
    // Remove the file in temp
    const gog_path = getConfig("gog_path");
    const tmp_download = gog_path + "\\.temp\\";
    if(fs.existsSync(tmp_download + dl)){
      fs.rmSync(tmp_download + dl);
    }
  }
}

export async function downloadGamePromisify(game: GOG.GameInfo, dl_link_set: string[], token: LockAbortToken): Promise<string[]>{
  const promise_array = [] as Promise<string>[];
  // General init
  const game_remote = await ensureRemote(game);

  const webdav = await initWebDav();
  if(!webdav){
    return new Promise<string[]>((r, reject) => {
      reject(dl_link_set);
    });
  }
  const gog_path = getConfig("gog_path");
  const tmp_download = gog_path + "\\.temp\\";
  ensureDir(tmp_download);

  for(const dl_link of dl_link_set){
    promise_array.push(new Promise<string>((resolve, reject) => {
      // Acquire lock
      acquireLock(DOWNLOAD_SEQUENCE);
      // Initialize download
      win()?.webContents.send("progress-banner-init", {
        title: "Downloading " + dl_link,
        cancel_event: "game-dl-cancel",
        cancel_data: game
      });
      const total = game_remote.dl_size;

      function done(){
        // Release lock
        token.off("abort");
        releaseLock(DOWNLOAD_SEQUENCE);
        resolve(dl_link);
      }

      const save_loc = tmp_download + "/" + dl_link;
      if(fs.existsSync(save_loc)){
        const fs_stat = fs.statSync(save_loc);
        if(fs_stat.size === total){
          win()?.webContents.send("game-dl-progress", game, {
            total: total,
            progress: total
          });
          done();
          return;
        }
      }
      // Perform download
      const active_dl = downloadFile(webdav.getFileDownloadLink(game_remote.folder + "/" + dl_link), dl_link);
      active_dl.on("end", () => {
        done();
      });
      active_dl.on("stop", () => {
        cleanupDownloaded(dl_link_set);
      });
      active_dl.on("progress", (p: Stats) => {
        const prog = {
          total: total,
          progress: p.downloaded,
          speed: p.speed
        };
        win()?.webContents.send("game-dl-progress", game, prog);
        win()?.webContents.send("progress-banner-progress", prog);
      });
      active_dl.on("error", (e) => {
        win()?.webContents.send("game-dl-error", game, e);
        win()?.webContents.send("progress-banner-error", "Failed to download game: " + game.name);
      });
      token.on("abort", () => {
        console.log("Aborting download");
        active_dl.stop();
        releaseLock(DOWNLOAD_SEQUENCE);
        reject(dl_link);
      });
      if(fs.existsSync(save_loc)){
        active_dl.resumeFromFile(save_loc);
      }else{
        active_dl.start();
      }
    }));
  }

  return Promise.all(promise_array).finally(() => {
    releaseLock(DOWNLOAD_SEQUENCE);
    win()?.webContents.send("progress-banner-hide");
  });
}

async function downloadPrep(game: GOG.GameInfo, dl_link_set: string[]): Promise<string[]>{
  const token = await acquireLock(DOWNLOAD);
  if(!token){
    return new Promise<string[]>((resolve, reject) => {
      releaseLock(DOWNLOAD);
      reject(dl_link_set);
    });
  }
  if(game.remote === undefined){
    win()?.webContents.send("progress-banner-error", "Failed to start download: No Remote Data");
    return new Promise<string[]>((resolve, reject) => {
      releaseLock(DOWNLOAD);
      reject(dl_link_set);
    });
  }
  const gog_path = getConfig("gog_path");
  const tmp_download = gog_path + "\\.temp\\";
  ensureDir(tmp_download);
  return downloadGamePromisify(game, dl_link_set, token)
    .finally(() => {
      releaseLock(DOWNLOAD);
    });
}

export async function downloadGame(game: GOG.GameInfo): Promise<string[] | undefined>{
  try{
    game.remote = await ensureRemote(game);
  }catch(e){
    nrd(game);
    return new Promise<string[]>((resolve, reject) => {
      reject(undefined);
    });
  }
  return downloadPrep(game, game.remote.download);
}

export async function downloadDLC(game: GOG.GameInfo, dlc_slug: string): Promise<string[] | undefined>{
  try{
    game.remote = await ensureRemote(game);
  }catch(e){
    nrd(game);
    return new Promise<string[]>((resolve, reject) => {
      reject(undefined);
    });
  }
  // Find dlc install index
  let idx = 0;
  for(const i in game.remote.dlc){
    const dlc = game.remote.dlc[i];
    if(dlc.slug === dlc_slug){
      idx = i as unknown as number;
      break;
    }
  }
  return downloadPrep(game, game.remote.dlc[idx].download);
}

export async function downloadVersion(game: GOG.GameInfo, version_id: string, version: GOG.RemoteGameDLC): Promise<string[]>{
  try{
    game.remote = await ensureRemote(game);
  }catch(e){
    nrd(game);
    return new Promise<string[]>((resolve, reject) => {
      reject([]);
    });
  }
  return downloadPrep(game, version.download);
}