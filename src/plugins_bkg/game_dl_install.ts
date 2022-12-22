
import { abortLock, acquireLock, ACTION_LOCK, DOWNLOAD, DOWNLOAD_SEQUENCE, releaseLock, UN_INSTALL_LOCK } from "./tools/locks";
import { BrowserWindow, IpcMain } from "electron";
import { cleanupDownloaded, downloadDLC, downloadGame, downloadVersion } from "./download";
import { notify, win } from "./index";
import { syncGameSave, uploadGameSave } from "./cloud_saves";
import { uninstallDLC, uninstallGame } from "./uninstall";
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

export async function downloadAndInstallDLC(game: GOG.GameInfo, dlc_slug: string){
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
    const dl_files = await downloadGame(game);
    console.log("dl_files", dl_files);
    if(dl_files === undefined){
      notify({
        title: "Game download failed",
        text: "Failed to connect to server",
        type: "error"
      });
      return;
    }
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

export async function downloadAndInstall(game: GOG.GameInfo){
  const token = await acquireLock(ACTION_LOCK, false);
  if(token === undefined){ return; }

  try{
    const dl_files = await downloadGame(game);
    if(dl_files === undefined){
      notify({
        title: "Game download failed",
        text: "Failed to connect to server",
        type: "error"
      });
      return;
    }
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
      const dl_files = await downloadGame(game);
      if(dl_files === undefined){
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