
import { abortLock, acquireLock, ACTION_LOCK, DOWNLOAD, DOWNLOAD_SEQUENCE, releaseLock, UN_INSTALL_LOCK } from "./tools/locks";
import { BrowserWindow, IpcMain } from "electron";
import { cleanupDownloaded, downloadDLC, downloadGame, downloadVersion } from "./download";
import { notify, win } from "./index";
import { syncGameSave, uploadGameSave } from "./cloud_saves";
import { uninstallDLC, uninstallGame } from "./uninstall";
import { ensureRemote } from "./game_loader";
import { getConfig } from "./config";
import { GOG } from "@/types/gog/game_info";
import { installGame } from "./install";
import { processScript } from "./script";

function insDlFinish(game?: GOG.GameInfo){
  win()?.webContents.send("game-dlins-end", game);
}

function triggerReload(game?: GOG.GameInfo){
  insDlFinish(game);
  win()?.webContents.send("gog-game-reload", game);
}

export async function downloadAndInstallDLC(game: GOG.GameInfo, dlc_slug: string): Promise<string>{
  try{
    const dl_result = await downloadDLC(game, dlc_slug);
    console.log("dl_result", dl_result);
    if(dl_result.status !== "success"){
      if(dl_result.status === "canceled"){
        releaseLock(ACTION_LOCK);
        return "canceled";
      }
      notify({
        title: "DLC download failed",
        text: "Failed to connect to server",
        type: "error"
      });
      releaseLock(ACTION_LOCK);
      return "errored";
    }
    const dl_files = dl_result.links;
    if(Array.isArray(dl_files) && dl_files.length >= 1){
      await installGame(game, dl_files, dl_files[0], false);
      cleanupDownloaded(dl_files);
    }
    triggerReload(game);
    return "success";
  }catch(e){
    insDlFinish(game);
    console.log("Game install errored or canceled: ", e);
    return e as string;
  }
}

export async function downloadAndInstallAllDLC(game: GOG.GameInfo){
  await ensureRemote(game);
  if(game.remote === undefined){
    return false;
  }
  for(const dlc of game.remote.dlc){
    const result = await downloadAndInstallDLC(game, dlc.slug);
    // If cancel, kill the rest
    if(result === "canceled"){
      return false;
    }
  }
}

export async function downloadAndReinstall(game: GOG.GameInfo){
  const token = await acquireLock(ACTION_LOCK, false);
  if(token === undefined){ return; }

  // Find the presently installed DLC
  const dlc_set = game.remote?.dlc;
  const installed_dlc = [] as GOG.RemoteGameDLC[];
  if(dlc_set){
    for(const dlc of dlc_set){
      if(dlc.present){
        installed_dlc.push(dlc);
      }
    }
  }

  try{
    await uploadGameSave(game);
    const dl_result = await downloadGame(game);
    console.log("dl_result", dl_result);
    if(dl_result.status !== "success"){
      if(dl_result.status === "canceled"){
        return;
      }
      notify({
        title: "Game download failed",
        text: "Failed to connect to server",
        type: "error"
      });
      return;
    }
    const dl_files = dl_result.links;
    if(Array.isArray(dl_files) && dl_files.length >= 1){
    // Uninstall first
      await uninstallGame(game);
      await installGame(game, dl_files, dl_files[0], false);
      // Reinstall the DLC, if any
      for(const dlc of installed_dlc){
        await downloadAndInstallDLC(game, dlc.slug);
      }
      await syncGameSave(game, (b: boolean ) => {
        if(b){ console.log("Saves synchronized from the cloud"); }
      });
      cleanupDownloaded(dl_files);
    }
    triggerReload(game);
  }catch(e){
    insDlFinish(game);
    console.log("Game install errored or canceled");
  }
  releaseLock(ACTION_LOCK);
}

export async function downloadAndInstall(game: GOG.GameInfo): Promise<boolean>{
  const token = await acquireLock(ACTION_LOCK, false);
  if(token === undefined){ return false; }

  try{
    const dl_result = await downloadGame(game);
    console.log("dl_result", dl_result);
    if(dl_result.status !== "success"){
      if(dl_result.status === "canceled"){
        releaseLock(ACTION_LOCK);
        return false;
      }
      notify({
        title: "Game download failed",
        text: "Failed to connect to server",
        type: "error"
      });
      releaseLock(ACTION_LOCK);
      return false;
    }
    const dl_files = dl_result.links;
    if(Array.isArray(dl_files) && dl_files.length >= 1){
      await installGame(game, dl_files, dl_files[0]);
      await syncGameSave(game, (b: boolean ) => {
        if(b){
          console.log("Saves synchronized from the cloud");
        }
      });
      cleanupDownloaded(dl_files);
    }
    triggerReload(game);
  }catch(e){
    insDlFinish(game);
    console.log("Game install errored or canceled");
    releaseLock(ACTION_LOCK);
    return false;
  }
  releaseLock(ACTION_LOCK);
  return true;
}

export default function init(ipcMain: IpcMain, win: BrowserWindow){

  // Init
  ipcMain.handle("install-game", async(e, game: GOG.GameInfo) => {
    const result = await downloadAndInstall(game);
    if(result && getConfig("auto_dlc")){
      console.log("Triggering install all DLC");
      downloadAndInstallAllDLC(game);
    }
  });

  // Init
  ipcMain.on("reinstall-game", async(e, game: GOG.GameInfo) => {
    downloadAndReinstall(game);
  });

  // Init
  ipcMain.on("download-game", async(e, game: GOG.GameInfo) => {
    try{
      const dl_result = await downloadGame(game);
      if(dl_result.status !== "success"){
        if(dl_result.status === "canceled"){
          return false;
        }
        notify({
          title: "Game download failed",
          text: "Failed to connect to server",
          type: "error"
        });
        return;
      }
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled");
    }
  });

  // Init
  ipcMain.on("install-dlc", async(e, game: GOG.GameInfo, dlc_slug: string) => {
    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }
    downloadAndInstallDLC(game, dlc_slug);
    releaseLock(ACTION_LOCK);
  });

  // Init
  ipcMain.on("uninstall-dlc", async(e, game: GOG.GameInfo, dlc: GOG.RemoteGameDLC) => {
    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }

    try{
      await uninstallDLC(game, dlc);
      triggerReload(game);
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled");
    }
    releaseLock(ACTION_LOCK);
  });

  // Init
  ipcMain.on("download-dlc", async(e, game: GOG.GameInfo, dlc_slug: string) => {
    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }
    try{
      await downloadDLC(game, dlc_slug);
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled");
    }
    releaseLock(ACTION_LOCK);
  });

  // Init
  ipcMain.on("install-version", async(e, game: GOG.GameInfo, version_id: string, version: GOG.RemoteGameDLC) => {
    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }

    try{
      await uploadGameSave(game);
      const dl_files = await downloadVersion(game, version_id, version);
      if(Array.isArray(dl_files) && dl_files.length >= 1){
      // Uninstall first
        await uninstallGame(game);
        await installGame(game, dl_files, dl_files[0]);
        cleanupDownloaded(dl_files);
      }
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled");
    }
    releaseLock(ACTION_LOCK);
  });

  // Init
  ipcMain.on("download-version", async(e, game: GOG.GameInfo, version_id: string, version: GOG.RemoteGameDLC) => {
    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }
    try{
      await downloadVersion(game, version_id, version);
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled");
    }
    releaseLock(ACTION_LOCK);
  });

  ipcMain.on("game-dl-cancel", () => {
    abortLock(UN_INSTALL_LOCK);
    abortLock(DOWNLOAD_SEQUENCE);
    abortLock(DOWNLOAD);
    win.webContents.send("progress-banner-hide");
  });

  ipcMain.on("uninstall-game", async(e, game: GOG.GameInfo) => {
    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }
    try{
      await uninstallGame(game);
      triggerReload(game);
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled");
    }
    releaseLock(ACTION_LOCK);
  });

  ipcMain.on("rerun-ins-script", (e, game: GOG.GameInfo) => {
    processScript(game);
  });
}