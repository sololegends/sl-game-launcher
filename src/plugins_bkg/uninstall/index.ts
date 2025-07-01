
import * as child from "child_process";
import { acquireLock, LockAbortToken, releaseLock, UN_INSTALL_LOCK } from "../tools/locks";
import { notify, win } from "..";
import { canInstallUninstall } from "../game_dl_install";
import { ensureRemote } from "../game_loader";
import filters from "../../js/filters";
import fs from "fs";
import { GOG } from "@ctypes/gog/game_info";
import { processScriptReverse } from "../script";
import { remote } from "../backplane";
import tk from "tree-kill";

let active_uns = undefined as undefined | child.ChildProcess;

export function sendUninstallStart(game: GOG.GameInfo, title: string, notify_title?: string){
  console.log("Starting Uninstall");
  win()?.setProgressBar(2);
  win()?.webContents.send("game-uns-start", game, notify_title);
  win()?.webContents.send("progress-banner-init", {
    title: "Uninstalling " + title,
    color: "deep-orange"
  });
}

export function sendUninstallFailed(game: GOG.GameInfo, title: string, notify_title?: string){
  win()?.webContents.send("game-uns-error", notify_title);
  win()?.webContents.send("progress-banner-error", "Failed to uninstall " + title);
  win()?.setProgressBar(-1);
}

export function sendUninstallEnd(game: GOG.GameInfo, title?: string){
  console.log("Ending Uninstall");
  win()?.webContents.send("game-uns-end", game, title);
  win()?.webContents.send("progress-banner-hide");
  win()?.setProgressBar(-1);
}

export function cancelUninstall(game: GOG.GameInfo){
  win()?.setProgressBar(-1);
  if(active_uns !== undefined && active_uns.pid){
    win()?.webContents.send("game-ins-end", game, false);
    tk(active_uns.pid, "SIGKILL", function(err){
      if(err){
        console.log(err);
        notify({
          type: "error",
          title: "Failed to kill install!"
        });
      }
    });
    active_uns = undefined;
  }
}

function performUninstall(game: GOG.GameInfo, uninstall: GOG.UninstallDef){
  const total_count = uninstall.files?.length + uninstall.folders?.length;
  let processed = 0;
  if(uninstall.files){
    for(const f of uninstall.files){
      const file = game.root_dir + "\\" + f;
      if(fs.existsSync(file)){
        fs.rmSync(file);
      }
      processed++;
      win()?.webContents.send("progress-banner-progress", {
        total: total_count,
        progress: processed
      });
    }
  }
  if(uninstall.folders){
    for(const f of uninstall.folders){
      const folder = game.root_dir + "\\" + f;
      if(fs.existsSync(folder)){
        fs.rmSync(folder, {recursive: true});
      }
      processed++;
      win()?.webContents.send("progress-banner-progress", {
        total: total_count,
        progress: processed
      });
    }
  }
}

export async function uninstallDLC(game: GOG.GameInfo, dlc: GOG.RemoteGameDLC): Promise<GOG.GameInfo>{
  if(!canInstallUninstall()){ return game; }

  await acquireLock(UN_INSTALL_LOCK, true);
  sendUninstallStart(game, "dlc: " + filters.procKey(dlc.slug));
  try{
    await processScriptReverse(game, dlc?.gameId);
  }catch(e){
    console.log("Failed tin reverse script", e);
  }
  return new Promise<GOG.GameInfo>((resolve, reject) => {
    if(dlc.uninstall){
      if(typeof dlc.uninstall === "string"){
        remote.uninstall(game.gameId, dlc.uninstall).then((uninstall) => {
          if(uninstall === undefined){
            sendUninstallFailed(game, "DLC: " + filters.procKey(dlc.slug));
            return;
          }
          performUninstall(game, uninstall);
          sendUninstallEnd(game, "DLC: " + filters.procKey(dlc.slug));
          resolve(game);
        }).catch(() => { reject(game); });
        return;
      }
      performUninstall(game, dlc.uninstall);
      sendUninstallEnd(game, "DLC: " + filters.procKey(dlc.slug));
      resolve(game);
      return;
    }

    // Rough uninstall?
    const f1 = game.root_dir + "\\goggame-" + dlc.gameId + ".hashdb";
    const f2 = game.root_dir + "\\goggame-" + dlc.gameId + ".ico";
    const f3 = game.root_dir + "\\goggame-" + dlc.gameId + ".info";
    if(fs.existsSync(f1)){
      fs.rmSync(f1);
    }
    if(fs.existsSync(f2)){
      fs.rmSync(f2);
    }
    if(fs.existsSync(f3)){
      fs.rmSync(f3);
    }
    sendUninstallEnd(game, "DLC: " + filters.procKey(dlc.slug));
    resolve(game);
  }).finally(() =>{
    releaseLock(UN_INSTALL_LOCK);
  });
}

export async function uninstallDLCSlug(game: GOG.GameInfo, dlc_slug: string): Promise<GOG.GameInfo>{
  try{
    game.remote = await ensureRemote(game);
  }catch(e){
    return new Promise<GOG.GameInfo>((resolve, reject) => {
      reject({status: "remote_failed"});
    });
  }
  let idx = 0;
  for(const i in game.remote.dlc){
    const dlc = game.remote.dlc[i];
    if(dlc.slug === dlc_slug){
      idx = i as unknown as number;
      break;
    }
  }
  return uninstallDLC(game, game.remote.dlc[idx]);
}


async function uninstallGameZip(game: GOG.GameInfo, token: LockAbortToken): Promise<GOG.GameInfo>{
  if(!canInstallUninstall()){ return game; }

  sendUninstallStart(game, "game: " + game.name);
  try{
    await processScriptReverse(game);
    // Perform dl reverse if needed
    if(game?.remote?.dlc){
      for(const dlc of game.remote.dlc){
        if(dlc.gameId){
          await processScriptReverse(game, dlc.gameId);
        }
      }
    }
  }catch(e){
    console.log("Failed tin reverse script", e);
  }
  return new Promise<GOG.GameInfo>((resolve, reject) => {
    if(token.aborted()){
      reject(game);
      return;
    }
    fs.rm(game.root_dir, { recursive: true, force: true }, (e) => {
      if(e === null){
        sendUninstallEnd(game);
        resolve(game);
        return;
      }
      console.log("Game error uninstalled with error: " + e);
      sendUninstallFailed(game, "game: " + game.name);
      reject(game);
    });
  });
}

async function uninstallGameExe(game: GOG.GameInfo, title: string, exe = "unins000.exe", token: LockAbortToken): Promise<GOG.GameInfo>{
  if(!canInstallUninstall()){ return game; }

  return new Promise<GOG.GameInfo>((resolve, reject) => {
    win()?.setProgressBar(2);
    sendUninstallStart(game, title);
    active_uns = child.execFile(
      game.root_dir + "\\" + exe,
      [ "/VERYSILENT", "/SuppressMsgBoxes", "/NoRestart" ],
      function(err, data){
        reject(game);
        if(err){
          console.error(err);
          return;
        }
        console.log(data.toString());
      });
    token.on("abort", () => {
      cancelUninstall(game);
    });
    active_uns.addListener("error", (code: number) => {
      console.log("Game error uninstalled with code: " + code);
      sendUninstallFailed(game, title);
      active_uns = undefined;
      reject(game);
    });
    active_uns.addListener("close", (code: number) => {
      console.log("Game uninstalled with code: " + code);
      if(code === 0){
        sendUninstallEnd(game);
        resolve(game);
      }
      if(code === 1){
        sendUninstallEnd(game, "Uninstall Canceled");
      }
      active_uns = undefined;
      reject(game);
    });
  });
}

export async function uninstallGame(game: GOG.GameInfo): Promise<GOG.GameInfo>{
  if(!canInstallUninstall()){ return game; }

  const lock = await acquireLock(UN_INSTALL_LOCK, true);
  if(lock === undefined){
    return game;
  }
  return new Promise<GOG.GameInfo>((resolve, reject) => {
    ensureRemote(game).then((remote) => {
      game.remote = remote;
      const version = game.current_version;
      let download = game.remote.download;
      if(game.remote.versions && version && game.remote.versions[version]){
        download = game.remote.versions[version].download;
      }
      if(lock.aborted()){
        return;
      }
      if(game.remote === undefined || game.remote.is_zip || download.length === 0 || (download.length > 0 && download[0].endsWith(".zip"))){
        uninstallGameZip(game, lock).then((game) => {
          resolve(game);
        }).catch((game) => {
          reject(game);
        });
        return;
      }else if(!game.remote.is_zip){
        uninstallGameExe(game, "game: " + game.name, "unins000.exe", lock).then((game) => {
          resolve(game);
        }).catch((game) => {
          reject(game);
        });
        return;
      }
      reject(game);
    }).catch(() => {
      reject(game);
    });
  }).finally(() =>{
    releaseLock(UN_INSTALL_LOCK);
  });
}