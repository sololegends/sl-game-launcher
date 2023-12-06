

import * as child from "child_process";
import { acquireLock, LockAbortToken, releaseLock, UN_INSTALL_LOCK } from "../tools/locks";
import { ensureDir, getFolderSize, normalizeFolder } from "../tools/files";
import { game_folder_size, game_iter_id, game_name_file, game_version } from "../../json/files.json";
import { notify, win } from "..";
import zip, { ZipEntry } from "node-stream-zip";
import filters from "../../js/filters";
import fs from "fs";
import { getConfig } from "../config";
import { getLocalGameData } from "../game_loader";
import { GOG } from "@/types/gog/game_info";
import { processScript } from "../script";
import { scanAndInstallRedist } from "../as_admin/redist/redist";
import tk from "tree-kill";

let active_ins = undefined as undefined | child.ChildProcess;

export type InstallResult = "success" | "canceled" | "extract_failed" | "install_failed" | "lock_failed" | "invalid_install" | "unknown";

export type VersionInstallData = {
  version: string
  iter_id?: number
}

export function sendInstallStart(game: GOG.GameInfo, indeterminate = true, dlc_data?: GOG.RemoteGameDLCBuilding){
  console.log("Starting Install");
  win()?.webContents.send("game-ins-start", game);
  win()?.webContents.send("progress-banner-init", {
    title: "Installing " + (dlc_data ? "DLC: " + filters.procKey(dlc_data.slug) : "game: " + game.name),
    indeterminate: indeterminate,
    cancel_event: "game-dl-cancel",
    cancel_data: game
  });
}

export function sendInstallEnd(game: GOG.GameInfo){
  console.log("Ending Install");
  win()?.webContents.send("game-dlins-end", game);
  win()?.webContents.send("progress-banner-hide");
  win()?.setProgressBar(-1);
}

export function sendInstallError(game: GOG.GameInfo, dlc_data?: GOG.RemoteGameDLCBuilding){
  win()?.webContents.send("game-ins-error", game);
  win()?.webContents.send("progress-banner-error",
    "Failed to install " + (dlc_data ? "DLC: " + filters.procKey(dlc_data.slug) : "game: " + game.name)
  );
  win()?.setProgressBar(-1);
}

export function cancelInstall(game: GOG.GameInfo){
  win()?.setProgressBar(-1);
  if(active_ins !== undefined && active_ins.pid){
    win()?.webContents.send("game-ins-end", game, false);
    tk(active_ins.pid, "SIGKILL", function(err){
      if(err){
        console.log(err);
        notify({
          type: "error",
          title: "Failed to kill install!"
        });
      }
    });
    active_ins = undefined;
  }
}

async function zipPostInstall(game: GOG.GameInfo, dlc_data?: GOG.RemoteGameDLCBuilding){
  win()?.setProgressBar(2);
  const game_reloaded = await getLocalGameData(game.root_dir, false);
  console.debug("dlc_data:", dlc_data);
  if(game_reloaded){
    // Execute script check and execution
    try{
      await processScript(game_reloaded, false, dlc_data?.gameId);
      if(!dlc_data){
        await scanAndInstallRedist(game_reloaded);
      }
    }catch(e){
      console.log("Error when installing dependencies and running post script", JSON.stringify(e));
      notify({
        title: "Error while installing Dependencies",
        type: "error"
      });
    }
  }
  win()?.setProgressBar(-1);
}

async function installGameZip(
  game: GOG.GameInfo, dl_files: string[], zip_f: string,
  token: LockAbortToken, do_post = true, version?: VersionInstallData,
  dlc_data?: GOG.RemoteGameDLCBuilding): Promise<InstallResult>{
  return new Promise<InstallResult>((resolve, reject) => {
    sendInstallStart(game, false, dlc_data);
    const gog_path = getConfig("gog_path");
    const tmp_download = gog_path + "\\.temp\\";
    let ins_dir = game.root_dir;
    if(ins_dir === undefined || ins_dir === "remote"){
      ins_dir = gog_path + "\\" + normalizeFolder(game.name);
    }
    console.log("Installing " + game.name + " into: ", ins_dir);
    ensureDir(ins_dir);
    if(token.aborted()){
      reject("canceled"); return;
    }
    const archive = new zip.async({file: tmp_download + zip_f});
    token.on("abort", ()=>{
      reject("canceled");
    });
    archive.entriesCount.then((total_count) => {
      if(token.aborted()){
        reject("canceled"); return;
      }
      let ex_count = 0;
      archive.on("extract", (entry: ZipEntry) => {
        if(!token.aborted()){
          ex_count++;
          win()?.webContents.send("game-ins-progress", game, total_count, ex_count, {
            name: entry.name,
            isDirectory: entry.isDirectory,
            isFile: entry.isFile,
            comment: entry.comment,
            size: entry.size,
            crc: entry.crc
          });
          win()?.webContents.send("progress-banner-progress", {
            total: total_count,
            progress: ex_count
          });
          win()?.setProgressBar(ex_count / total_count);
        }
      });
      if(token.aborted()){
        reject("canceled"); return;
      }
      archive.extract(null, ins_dir).then((count) => {
        if(token.aborted()){
          console.log("Closing archive in extraxt -> then");
          archive.close();
          sendInstallEnd(game);
          return;
        }
        console.log("Extracted:" + count);
        archive.close().then(() => {
          // Write game name to file
          game.root_dir = ins_dir;
          const version_txt = version?.version ? version.version : (game.remote?.version ? game.remote?.version : "0");
          const version_id = version?.iter_id ? version.iter_id : (game.remote?.iter_id ? game.remote?.iter_id : 0);
          fs.writeFileSync(ins_dir + "/" + game_name_file, game.remote_name);
          fs.writeFileSync(ins_dir + "/" + game_version, version_txt);
          fs.writeFileSync(ins_dir + "/" + game_iter_id, version_id + "");
          fs.writeFileSync(ins_dir + "/" + game_folder_size, getFolderSize(ins_dir) + "");
          sendInstallEnd(game);
          if(do_post){
            zipPostInstall(game, dlc_data).then(() => {
              resolve("success");
            });
            return;
          }
          resolve("success");
        });
      }).catch((e) => {
        console.error("Failed to extract game: ", e, game);
        reject("extract_failed");
      });
    });
  });
}

function installGameExe(
  game: GOG.GameInfo, dl_files: string[], exe: string,
  token: LockAbortToken, do_post = true, version?: VersionInstallData): Promise<InstallResult>{
  return new Promise<InstallResult>((resolve, reject) => {
    win()?.setProgressBar(2);
    sendInstallStart(game);
    const gog_path = getConfig("gog_path");
    const tmp_download = gog_path + "\\.temp\\";
    let ins_dir = game.root_dir;
    if(ins_dir === undefined || ins_dir === "remote"){
      ins_dir = gog_path + "\\" + normalizeFolder(game.name);
    }
    if(token.aborted()){
      reject("canceled"); return;
    }
    console.log("Installing " + game.name + " into: ", ins_dir);
    active_ins = child.execFile(
      tmp_download + "" + exe,
      [ "/VERYSILENT",  "\"/dir=" + ins_dir + "\"", "/NoRestart" ],
      function(err, data){
        if(err){
          console.error(err);
          return;
        }
        console.log(data.toString());
      });
    token.on("abort", ()=>{
      cancelInstall(game);
    });
    active_ins.addListener("error", (code: number) => {
      active_ins = undefined;
      console.log("Game error installed with code: " + code);
      sendInstallError(game);
      reject("install_failed");
    });
    active_ins.addListener("close", (code: number) => {
      win()?.setProgressBar(-1);
      token.off("abort");
      game.root_dir = ins_dir;
      active_ins = undefined;
      console.log("Game installed with code: " + code);
      // Write game name to file
      fs.writeFileSync(ins_dir + "/" + game_name_file, game.remote_name);
      if(code === 3221226525){
        // Write game name to file
        game.root_dir = ins_dir;
        const version_txt = version?.version ? version.version : (game.remote?.version ? game.remote?.version : "0");
        const version_id = version?.iter_id ? version.iter_id : (game.remote?.iter_id ? game.remote?.iter_id : 0);
        fs.writeFileSync(ins_dir + "/" + game_name_file, game.remote_name);
        fs.writeFileSync(ins_dir + "/" + game_version, version_txt);
        fs.writeFileSync(ins_dir + "/" + game_iter_id, version_id + "");
        fs.writeFileSync(ins_dir + "/" + game_folder_size, getFolderSize(ins_dir) + "");
        sendInstallEnd(game);
        if(do_post){
          // Don't need this the exe does it
          // ZipPostInstall(game, dlc_data).then(() => {
          //   Resolve("success");
          // });
          return;
        }
        resolve("success");
        return;
      }
      if(code === 2){
        win()?.webContents.send("game-ins-end", game, false);
        win()?.webContents.send("progress-banner-hide");
      }
      if(code === 2){
        sendInstallError(game);
      }
      reject("install_failed");
    });
  });
}

export async function installGame(
  game: GOG.GameInfo, dl_files: string[], exe: string, do_post = true,
  version?: VersionInstallData, dlc_data?: GOG.RemoteGameDLCBuilding
): Promise<InstallResult>{
  const lock = await acquireLock(UN_INSTALL_LOCK, true);
  if(lock === undefined){
    return new Promise<InstallResult>((r, reject) => {
      reject("lock_failed");
    });
  }
  console.log("Install init: ", exe);
  if(exe.endsWith(".exe")){
    return installGameExe(game, dl_files, exe, lock, do_post, version).finally(() =>{
      releaseLock(UN_INSTALL_LOCK);
    });
  }else if(exe.endsWith(".zip")){
    return installGameZip(game, dl_files, exe, lock, do_post, version, dlc_data).finally(() =>{
      releaseLock(UN_INSTALL_LOCK);
    });
  }
  return new Promise<InstallResult>((r, reject) => {
    reject("invalid_install");
  }).finally(() =>{
    releaseLock(UN_INSTALL_LOCK);
  });
}
