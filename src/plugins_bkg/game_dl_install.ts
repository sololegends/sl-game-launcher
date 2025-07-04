
import {
  abortLock,
  acquireLock,
  ACTION_LOCK,
  DOWNLOAD,
  DOWNLOAD_SEQUENCE,
  LockAbortToken,
  releaseLock,
  UN_INSTALL_LOCK
} from "./tools/locks";
import { BrowserWindow, ipcMain, IpcMain } from "electron";
import { cleanupDownloaded, downloadDLC, downloadGame, DownloadResult, downloadVersion } from "./download";
import { getCLIArg, getConfig } from "./config";
import { installGame, processSetupSelfElevate } from "./install";
import { needsElevation, processScript } from "./script";
import { notify, win } from "./index";
import { syncGameSave, uploadGameSave } from "./cloud_saves";
import { uninstallDLC, uninstallDLCSlug, uninstallGame } from "./uninstall";
import { dlcDataFromSlug } from "./game_loader_fns";
import { ensureRemote } from "./game_loader";
import { GOG } from "@/types/gog/game_info";

function insDlFinish(game?: GOG.GameInfo){
  win()?.webContents.send("game-dlins-end", game);
}

function triggerReload(game?: GOG.GameInfo){
  insDlFinish(game);
  win()?.webContents.send("gog-game-reload", game);
}

function showAwaitSaveSync(token: LockAbortToken, cancel_note = ""){
  const evt = "await-save-sync-cancel-" + new Date().getTime();
  ipcMain.once(evt, () => {
    win()?.webContents.send("progress-banner-init", {
      title: "Canceling " + cancel_note + "...",
      cancel_event: evt,
      indeterminate: true,
      color: "primary"
    });
    token.abort();
  });
  win()?.webContents.send("progress-banner-init", {
    title: "Awaiting Save Sync...",
    cancel_event: evt,
    indeterminate: true
  });
}

function clearAwaitSaveSync(){
  win()?.webContents.send("progress-banner-hide");
}

async function awaitSaveSync(game: GOG.GameInfo, cancel_note = ""){
  const sync_token_n = "await-save-sync-" + game.gameId;
  const sync_token = await acquireLock(sync_token_n);
  if(sync_token === undefined){
    return false;
  }
  showAwaitSaveSync(sync_token, cancel_note);
  await syncGameSave(game, async(b: boolean, present: boolean) => {
    if(b){
      console.log("Saves synchronized from the cloud");
      return;
    }
    console.log("Using local save");
    if(sync_token.aborted()){
      releaseLock(sync_token_n);
      return;
    }
    if(present){
      await uploadGameSave(game);
    }
  });
  clearAwaitSaveSync();
  const aborted = !sync_token.aborted();
  releaseLock(sync_token_n);
  return aborted;
}

function downloadResultSuccess(dl_result : DownloadResult): boolean{
  if(dl_result.status !== "success"){
    releaseLock(ACTION_LOCK);
    if(dl_result.status === "canceled"){
      return false;
    }
    if(dl_result.status === "not_enough_space"){
      notify({
        title: "Game download failed",
        text: "Not enough space on disk",
        type: "error"
      });
      return false;
    }
    if(dl_result.status === "install_locked"){
      notify({
        title: "Game download failed",
        text: "Downloads and installs have been locked by your system admin",
        type: "warning"
      });
      return false;
    }
    notify({
      title: "Game download failed",
      text: "Failed to connect to server",
      type: "error"
    });
    return false;
  }
  return true;
}

export function canInstallUninstall(): boolean{
  console.log("getConfig(\"ins_locked\")",  getConfig("ins_locked"));
  return getConfig("ins_locked") !== true || getCLIArg("ins_locked_allow") === true;
}

export async function downloadAndInstallDLC(game: GOG.GameInfo, dlc_slug: string): Promise<"canceled" | "errored" | "success" | string>{
  if(!canInstallUninstall()){ return "errored"; }

  let dl_files = [] as string[] | undefined;
  let hit_install = false;
  try{
    const dl_result = await downloadDLC(game, dlc_slug);
    console.log("dl_result", dl_result);
    if(!downloadResultSuccess(dl_result)){
      insDlFinish(game);
      if(dl_result.status === "canceled"){
        return "canceled";
      }
      return "errored";
    }
    dl_files = dl_result.links;
    if(Array.isArray(dl_files) && dl_files.length >= 1){
      hit_install = true;
      const dlc = await dlcDataFromSlug(game, dlc_slug);
      if(dlc === undefined){
        console.error("Failed to find dlc from slug [", dlc_slug, "]", dlc);
      }
      await installGame(game, dl_files, dl_files[0], true, undefined, dlc);
      cleanupDownloaded(dl_files);
    }
    triggerReload(game);
    return "success";
  }catch(e){
    insDlFinish(game);
    console.log("Game install errored or canceled: ", e);
    // Uninstall the dlc
    if(hit_install){
      uninstallDLCSlug(game, dlc_slug);
    }
    if(Array.isArray(dl_files) && dl_files.length >= 1){
      cleanupDownloaded(dl_files);
    }
    return e as string;
  }
}

export async function downloadAndInstallAllDLC(game: GOG.GameInfo){
  if(!canInstallUninstall()){ return false; }
  const token = await acquireLock(ACTION_LOCK, false);
  if(token === undefined){ return false; }
  await ensureRemote(game);
  if(game.remote === undefined){
    releaseLock(ACTION_LOCK);
    return false;
  }
  for(const dlc of game.remote.dlc){
    const result = await downloadAndInstallDLC(game, dlc.slug);
    // If cancel, kill the rest
    if(result === "canceled"){
      releaseLock(ACTION_LOCK);
      return false;
    }
  }
  releaseLock(ACTION_LOCK);
  return true;
}

export async function downloadAndReinstall(game: GOG.GameInfo){
  if(!canInstallUninstall()){ return; }

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
    if(!await awaitSaveSync(game, "install")){
      releaseLock(ACTION_LOCK);
      return;
    }
    const dl_result = await downloadGame(game);
    console.log("dl_result", dl_result);
    if(!downloadResultSuccess(dl_result)){
      insDlFinish(game);
      return;
    }
    const dl_files = dl_result.links;
    if(Array.isArray(dl_files) && dl_files.length >= 1){
    // Uninstall first
      await uninstallGame(game);
      await installGame(game, dl_files, dl_files[0]);
      // Reinstall the DLC, if any
      for(const dlc of installed_dlc){
        await downloadAndInstallDLC(game, dlc.slug);
      }
      await awaitSaveSync(game, "install");
      cleanupDownloaded(dl_files);
    }
    triggerReload(game);
  }catch(e){
    insDlFinish(game);
    console.log("Game install errored or canceled", e);
  }
  releaseLock(ACTION_LOCK);
}

export async function downloadAndInstall(game: GOG.GameInfo): Promise<boolean>{
  if(!canInstallUninstall()){ return false; }

  const token = await acquireLock(ACTION_LOCK, false);
  if(token === undefined){ return false; }
  // Update remote data, no cache
  await ensureRemote(game, false);
  try{
    const dl_result = await downloadGame(game);
    console.log("dl_result", dl_result);
    if(!downloadResultSuccess(dl_result)){
      insDlFinish(game);
      return false;
    }
    const dl_files = dl_result.links;
    if(Array.isArray(dl_files) && dl_files.length >= 1){
      await installGame(game, dl_files, dl_files[0]);
      cleanupDownloaded(dl_files);
      await awaitSaveSync(game, "install");
    }
    releaseLock(ACTION_LOCK);
    triggerReload(game);
  }catch(e){
    insDlFinish(game);
    console.log("Game install errored or canceled", e);
    releaseLock(ACTION_LOCK);
    return false;
  }
  return true;
}

export async function installVersion(game: GOG.GameInfo, version_id: string, version: GOG.RemoteGameDLC): Promise<void>{
  if(!canInstallUninstall()){ return; }
  const token = await acquireLock(ACTION_LOCK, false);
  if(token === undefined){ return; }

  try{
    if(!await awaitSaveSync(game, "version install")){
      releaseLock(ACTION_LOCK);
      return;
    }
    const dl_result = await downloadVersion(game, version_id, version);
    console.log("dl_result", dl_result);
    if(!downloadResultSuccess(dl_result)){
      insDlFinish(game);
      return;
    }
    const dl_files = dl_result.links;
    if(Array.isArray(dl_files) && dl_files.length >= 1){
    // Uninstall first
      await uninstallGame(game);
      await installGame(game, dl_files, dl_files[0], true, {version: version_id, iter_id: version.iter_id});
      cleanupDownloaded(dl_files);
      triggerReload(game);
      await awaitSaveSync(game, "version install");
    }
  }catch(e){
    insDlFinish(game);
    console.log("Game install errored or canceled", e);
  }
  releaseLock(ACTION_LOCK);
}

export default function init(ipcMain: IpcMain, win: BrowserWindow){

  ipcMain.handle("install-allowed", (): boolean =>{
    return canInstallUninstall();
  });

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
      if(!downloadResultSuccess(dl_result)){
        insDlFinish(game);
        return false;
      }
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled", e);
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
    if(!canInstallUninstall()){ return; }

    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }

    try{
      await uninstallDLC(game, dlc);
      triggerReload(game);
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled", e);
    }
    releaseLock(ACTION_LOCK);
  });

  // Init
  ipcMain.on("download-dlc", async(e, game: GOG.GameInfo, dlc_slug: string) => {
    if(!canInstallUninstall()){ return; }
    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }
    try{
      await downloadDLC(game, dlc_slug);
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled", e);
    }
    releaseLock(ACTION_LOCK);
  });

  // Init
  ipcMain.on("install-version", async(e, game: GOG.GameInfo, version_id: string, version: GOG.RemoteGameDLC) => {
    installVersion(game, version_id, version);
  });

  // Init
  ipcMain.on("download-version", async(e, game: GOG.GameInfo, version_id: string, version: GOG.RemoteGameDLC) => {
    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }
    try{
      await downloadVersion(game, version_id, version);
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled", e);
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
    if(!canInstallUninstall()){ return; }

    const token = await acquireLock(ACTION_LOCK, false);
    if(token === undefined){ return; }
    try{
      await uninstallGame(game);
      triggerReload(game);
    }catch(e){
      insDlFinish(game);
      console.log("Game install errored or canceled", e);
    }
    releaseLock(ACTION_LOCK);
  });

  ipcMain.on("rerun-ins-script", (e, game: GOG.GameInfo, game_id?: string) => {
    try{
      if(needsElevation(game, game_id)){
        processSetupSelfElevate(game, false, game_id, true);
        return;
      }
      processScript(game, false, game_id);
    }catch(e){
      console.log("Error when running post script", JSON.stringify(e));
      notify({
        title: "Error while running post script",
        type: "error"
      });
    }
  });
}