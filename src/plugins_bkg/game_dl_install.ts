
import { abortLock, acquireLock, ACTION_LOCK, DOWNLOAD, DOWNLOAD_SEQUENCE, releaseLock, UN_INSTALL_LOCK } from "./tools/locks";
import { BrowserWindow, IpcMain } from "electron";
import { cleanupDownloaded, downloadDLC, downloadGame, downloadVersion } from "./download";
import { uninstallDLC, uninstallGame } from "./uninstall";
import { GOG } from "@/types/gog/game_info";
import { installGame } from "./install";
import { uploadGameSave } from "./cloud_saves";
import { win } from "./index";

function insDlFinish(game?: GOG.GameInfo){
  win()?.webContents.send("game-dlins-end", game);
}

function triggerReload(game?: GOG.GameInfo){
  insDlFinish(game);
  win()?.webContents.send("gog-game-reload", game);
}

export async function downloadAndReinstall(game: GOG.GameInfo){
  const token = await acquireLock(ACTION_LOCK, false);
  if(token === undefined){ return; }

  try{
    await uploadGameSave(game);
    const dl_files = await downloadGame(game);
    console.log("dl_files", dl_files);
    if(Array.isArray(dl_files) && dl_files.length >= 1){
    // Uninstall first
      await uninstallGame(game);
      await installGame(game, dl_files, dl_files[0], false);
      cleanupDownloaded(dl_files);
    }
    triggerReload(game);
  }catch(e){
    insDlFinish(game);
    console.log("Game install errored or canceled");
  }
  releaseLock(ACTION_LOCK);
}

export async function downloadAndInstall(game: GOG.GameInfo){
  const token = await acquireLock(ACTION_LOCK, false);
  if(token === undefined){ return; }

  try{
    const dl_files = await downloadGame(game);
    if(Array.isArray(dl_files) && dl_files.length >= 1){
      await installGame(game, dl_files, dl_files[0]);
      cleanupDownloaded(dl_files);
    }
    triggerReload(game);
  }catch(e){
    insDlFinish(game);
    console.log("Game install errored or canceled");
  }
  releaseLock(ACTION_LOCK);
}

export default function init(ipcMain: IpcMain, win: BrowserWindow){


  // Init
  ipcMain.on("install-game", async(e, game: GOG.GameInfo) => {
    downloadAndInstall(game);
  });

  // Init
  ipcMain.on("reinstall-game", async(e, game: GOG.GameInfo) => {
    downloadAndReinstall(game);
  });

  // Init
  ipcMain.on("download-game", async(e, game: GOG.GameInfo) => {
    try{
      await downloadGame(game);
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled");
    }
  });

  // Init
  ipcMain.on("install-dlc", async(e, game: GOG.GameInfo, dlc_slug: string) => {
    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }

    try{
      const dl_files = await downloadDLC(game, dlc_slug);
      if(Array.isArray(dl_files) && dl_files.length >= 1){
        await installGame(game, dl_files, dl_files[0], false);
        cleanupDownloaded(dl_files);
      }
      triggerReload(game);
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled");
    }
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
}