

import { acquireLock, DOWNLOAD, DOWNLOAD_SEQUENCE, LockAbortToken, releaseLock } from "../tools/locks";
import { notify, win } from "..";
import checkDiskSpace from "../tools/check-disk-space";
import { dlcDataFromSlug } from "../game_loader_fns";
import { download } from "../backplane";
import { ensureDir } from "../tools/files";
import { ensureRemote } from "../game_loader";
import fs from "fs";
import { getConfig } from "../config";
import { GOG } from "@/types/gog/game_info";
import { Stats } from "node-downloader-helper";

export type DownloadResult = {
  status: "success" | "backplane_error" | "canceled" | "token_failed" | "remote_failed" | "dlc_not_found" | "not_enough_space" | "unknown",
  links?: string[]
};

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
  console.log("Cleaning downloads: ", dl_link_set);
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

export async function downloadGamePromisify(game: GOG.GameInfo, dl_link_set: string[], token: LockAbortToken): Promise<DownloadResult>{
  const promise_array = [] as Promise<DownloadResult>[];
  // General init
  const gog_path = getConfig("gog_path");
  const tmp_download = gog_path + "\\.temp\\";
  ensureDir(tmp_download);

  for(const dl_link of dl_link_set){
    promise_array.push(new Promise<DownloadResult>((resolve, reject) => {
      // Acquire lock
      acquireLock(DOWNLOAD_SEQUENCE).then(() => {
        // Initialize download
        win()?.webContents.send("progress-banner-init", {
          title: "Downloading " + dl_link,
          cancel_event: "game-dl-cancel",
          cancel_data: game
        });

        function done(){
        // Release lock
          token.off("abort");
          releaseLock(DOWNLOAD_SEQUENCE);
          resolve({status: "success", links: [dl_link]});
        }

        const save_loc = tmp_download + "/" + dl_link;
        // Remove on start if left over
        if(fs.existsSync(save_loc)){
          console.log("Removing old download file");
          fs.rmSync(save_loc);
        }
        // Perform download
        download.installer(game.gameId, dl_link).then((active_dl) => {
          if(active_dl === undefined){
            reject({status: "backplane_error"});return;
          }
          active_dl.on("end", () => {
            console.log("Download end triggered");
            done();
            win()?.setProgressBar(-1);
          });
          active_dl.on("stop", () => {
            console.log("Download Stop triggered");
            cleanupDownloaded(dl_link_set);
            win()?.setProgressBar(-1);
          });
          active_dl.on("progress.throttled", (p: Stats) => {
            const prog = {
              total: p.total,
              progress: p.downloaded,
              speed: p.speed
            };
            win()?.webContents.send("game-dl-progress", game, prog);
            win()?.webContents.send("progress-banner-progress", prog);
            win()?.setProgressBar(p.downloaded / p.total);
          });
          active_dl.on("error", (e) => {
            console.log("Download error triggered");
            win()?.webContents.send("game-dl-error", game, e);
            win()?.setProgressBar(-1);
            win()?.webContents.send("progress-banner-error", "Failed to download game: " + game.name);
          });
          token.on("abort", () => {
            console.log("Aborting download");
            active_dl.stop();
            releaseLock(DOWNLOAD_SEQUENCE);
            reject("canceled");
          });
          if(token.aborted()){
            console.log("Aborting download");
            releaseLock(DOWNLOAD_SEQUENCE);
            reject("canceled");
            return;
          }
          active_dl.start();
        });
      });
    }));
  }

  const results = await Promise.all(promise_array).finally(() => {
    releaseLock(DOWNLOAD_SEQUENCE);
    win()?.webContents.send("progress-banner-hide");
  });
  // Compile the rsults
  const final_results = {
    status: "success",
    links: dl_link_set
  } as DownloadResult;
  for(const result of results){
    if(result.status !== "success"){
      final_results.status = result.status;
      return final_results;
    }
  }
  return final_results;
}

async function downloadPrep(game: GOG.GameInfo, dl_link_set: string[]): Promise<DownloadResult>{
  const token = await acquireLock(DOWNLOAD);
  win()?.webContents.send("progress-banner-init", {
    title: "Starting " + game.name + " download...",
    indeterminate: true,
    cancel_event: "nothing"
  });
  if(!token){
    return new Promise<DownloadResult>((resolve, reject) => {
      releaseLock(DOWNLOAD);
      reject({status: "token_failed"});
    });
  }
  if(game.remote === undefined){
    win()?.webContents.send("progress-banner-error", "Failed to start download: No Remote Data");
    return new Promise<DownloadResult>((resolve, reject) => {
      releaseLock(DOWNLOAD);
      reject({status: "remote_failed"});
    });
  }
  const gog_path = getConfig("gog_path");
  if(game.remote.install_size && game.remote.install_size * 2 > (await checkDiskSpace(gog_path)).free){
    win()?.webContents.send("progress-banner-error", "Failed to download game: Not Enough Space");
    return new Promise<DownloadResult>((resolve) => {
      releaseLock(DOWNLOAD);
      resolve({status: "not_enough_space"});
    });
  }
  const tmp_download = gog_path + "\\.temp\\";
  ensureDir(tmp_download);
  return downloadGamePromisify(game, dl_link_set, token)
    .finally(() => {
      releaseLock(DOWNLOAD);
    });
}

export async function downloadGame(game: GOG.GameInfo): Promise<DownloadResult>{
  try{
    game.remote = await ensureRemote(game);
  }catch(e){
    nrd(game);
    return new Promise<DownloadResult>((resolve, reject) => {
      reject({status: "remote_failed"});
    });
  }
  return downloadPrep(game, game.remote.download);
}

export async function downloadDLC(game: GOG.GameInfo, dlc_slug: string): Promise<DownloadResult>{
  try{
    game.remote = await ensureRemote(game);
  }catch(e){
    nrd(game);
    return new Promise<DownloadResult>((resolve, reject) => {
      reject({status: "remote_failed"});
    });
  }
  // Find dlc install index
  const dlc = await dlcDataFromSlug(game, dlc_slug);
  if(dlc === undefined){
    nrd(game);
    return new Promise<DownloadResult>((resolve, reject) => {
      reject({status: "dlc_not_found"});
    });
  }
  return downloadPrep(game, dlc.download);
}

export async function downloadVersion(game: GOG.GameInfo, version_id: string, version: GOG.RemoteGameDLC): Promise<DownloadResult>{
  try{
    game.remote = await ensureRemote(game);
  }catch(e){
    nrd(game);
    return new Promise<DownloadResult>((resolve, reject) => {
      reject({status: "remote_failed"});
    });
  }
  return downloadPrep(game, version.download);
}