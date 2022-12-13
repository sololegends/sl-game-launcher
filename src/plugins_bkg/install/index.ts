

import * as child from "child_process";
import { acquireLock, LockAbortToken, releaseLock, UN_INSTALL_LOCK } from "../tools/locks";
import { ensureDir, getFolderSize, normalizeFolder } from "../tools/files";
import { game_folder_size, game_iter_id, game_name_file, game_version } from "@/json/files.json";
import { notify, win } from "..";
import zip, { ZipEntry } from "node-stream-zip";
import fs from "fs";
import { getConfig } from "../config";
import { getLocalGameData } from "../game_loader";
import { GOG } from "@/types/gog/game_info";
import { processScript } from "../script";
import { scanAndInstallRedist } from "../as_admin/redist/redist";
import tk from "tree-kill";

let active_ins = undefined as undefined | child.ChildProcess;

export function sendInstallStart(game: GOG.GameInfo, indeterminate = true){
  console.log("Starting Install");
  win()?.webContents.send("game-ins-start", game);
  win()?.webContents.send("progress-banner-init", {
    title: "Installing game: " + game.name,
    indeterminate: indeterminate,
    cancel_event: "game-dl-cancel",
    cancel_data: game
  });
}

export function sendInstallEnd(game: GOG.GameInfo){
  console.log("Ending Install");
  win()?.webContents.send("game-dlins-end", game);
  win()?.webContents.send("progress-banner-hide");
}

export function sendInstallError(game: GOG.GameInfo){
  win()?.webContents.send("game-ins-error", game);
  win()?.webContents.send("progress-banner-error", "Failed to install game: " + game.name);
}

export function cancelInstall(game: GOG.GameInfo){
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

async function zipPostInstall(game: GOG.GameInfo){
  const game_reloaded = await getLocalGameData(game.root_dir, false);
  if(game_reloaded){
    // Execute script check and execution
    try{
      await processScript(game_reloaded);
      await scanAndInstallRedist(game_reloaded);
    }catch(e){
      console.log("Error when installing dependencies and running post script", e);
      notify({
        title: "Error while installing Dependencies",
        type: "error"
      });
    }
  }
}

async function installGameZip(
  game: GOG.GameInfo, dl_files: string[], zip_f: string,
  token: LockAbortToken, do_post = true): Promise<GOG.GameInfo>{
  return new Promise<GOG.GameInfo>((resolve, reject) => {
    sendInstallStart(game, false);
    const gog_path = getConfig("gog_path");
    const tmp_download = gog_path + "\\.temp\\";
    let ins_dir = game.root_dir;
    if(ins_dir === undefined || ins_dir === "remote"){
      ins_dir = gog_path + "\\" + normalizeFolder(game.name);
    }
    console.log("Installing " + game.name + " into: ", ins_dir);
    ensureDir(ins_dir);
    if(token.aborted()){
      reject(game); return;
    }
    const archive = new zip.async({file: tmp_download + zip_f});
    token.on("abort", ()=>{
      if(archive){
        archive.close();
        reject(game);
      }
    });
    archive.entriesCount.then((total_count) => {
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
        }
      });
      if(token.aborted()){
        archive.close();
        reject(game); return;
      }
      archive.extract(null, ins_dir).then((count) => {
        console.log("Extracted:" + count);
        archive.close().then(() => {
          // Write game name to file
          game.root_dir = ins_dir;
          fs.writeFileSync(ins_dir + "/" + game_name_file, game.remote_name);
          fs.writeFileSync(ins_dir + "/" + game_version, game.remote?.version ? game.remote?.version : "0");
          fs.writeFileSync(ins_dir + "/" + game_iter_id, (game.remote?.iter_id ? game.remote?.iter_id : 0) + "");
          fs.writeFileSync(ins_dir + "/" + game_folder_size, getFolderSize(ins_dir) + "");
          sendInstallEnd(game);
          if(do_post){
            zipPostInstall(game).then(() => {
              resolve(game);
            });
            return;
          }
          resolve(game);
        });
      }).catch((e) => {
        console.error("Failed to extract game: ", e, game);
        reject(game);
      });
    });
  });
}

function installGameExe(game: GOG.GameInfo, dl_files: string[], exe: string, token: LockAbortToken): Promise<GOG.GameInfo>{
  return new Promise<GOG.GameInfo>((resolve, reject) => {
    sendInstallStart(game);
    const gog_path = getConfig("gog_path");
    const tmp_download = gog_path + "\\.temp\\";
    let ins_dir = game.root_dir;
    if(ins_dir === undefined || ins_dir === "remote"){
      ins_dir = gog_path + "\\" + normalizeFolder(game.name);
    }
    if(token.aborted()){
      reject(game); return;
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
      reject(game);
    });
    active_ins.addListener("close", (code: number) => {
      token.off("abort");
      game.root_dir = ins_dir;
      active_ins = undefined;
      console.log("Game installed with code: " + code);
      // Write game name to file
      fs.writeFileSync(ins_dir + "/" + game_name_file, game.remote_name);
      if(code === 3221226525){
        fs.writeFileSync(ins_dir + "/" + game_name_file, game.remote_name);
        fs.writeFileSync(ins_dir + "/" + game_version, game.remote?.version ? game.remote?.version : "0");
        fs.writeFileSync(ins_dir + "/" + game_iter_id, (game.remote?.iter_id ? game.remote?.iter_id : 0) + "");
        fs.writeFileSync(ins_dir + "/" + game_folder_size, getFolderSize(ins_dir) + "");
        sendInstallEnd(game);
        resolve(game);
        return;
      }
      if(code === 2){
        win()?.webContents.send("game-ins-end", game, false);
        win()?.webContents.send("progress-banner-hide");
      }
      if(code === 2){
        sendInstallError(game);
      }
      reject(game);
    });
  });
}

export async function installGame(game: GOG.GameInfo, dl_files: string[], exe: string, do_post = true): Promise<GOG.GameInfo>{
  const lock = await acquireLock(UN_INSTALL_LOCK, true);
  if(lock === undefined){
    return game;
  }
  console.log("Install init: ", exe);
  if(exe.endsWith(".exe")){
    return installGameExe(game, dl_files, exe, lock).finally(() =>{
      releaseLock(UN_INSTALL_LOCK);
    });
  }else if(exe.endsWith(".zip")){
    return installGameZip(game, dl_files, exe, lock, do_post).finally(() =>{
      releaseLock(UN_INSTALL_LOCK);
    });
  }
  return new Promise<GOG.GameInfo>((r, reject) => {
    reject(game);
  }).finally(() =>{
    releaseLock(UN_INSTALL_LOCK);
  });
}
