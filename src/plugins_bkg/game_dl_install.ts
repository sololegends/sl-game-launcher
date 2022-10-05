
import * as child from "child_process";
import { BrowserWindow, IpcMain } from "electron";
import { DownloaderHelper, Stats } from "node-downloader-helper";
import { downloadFile, initWebDav } from "./nc_webdav";
import { loadFromVersionCache, removeFromVersionCache, saveToVersionCache } from "./cache";
import zip, { ZipEntry } from "node-stream-zip";
import { ensureRemote } from "./game_loader";
import { FileStat } from "webdav";
import filters from "@/js/filters";
import fs from "fs";
import { game_name_file } from "@/json/files.json";
import { getConfig } from "./config";
import { Globals } from ".";
import { GOG } from "@/types/gog/game_info";
import tk from "tree-kill";

function procKey(key: string){
  return filters.procKey(key);
}

function flattenName(name: string): string{
  return name.trim().toLowerCase().replace(/[^-a-z0-9_]/gm, "_");
}

function nothing(success: boolean){
  // Nothing
  console.log(success);
}

export default function init(ipcMain: IpcMain, win: BrowserWindow, globals: Globals){
  let active_dl = undefined as undefined | DownloaderHelper;
  let download_cancel = false;
  let active_ins = undefined as undefined | child.ChildProcess;

  function triggerReload(){
    win?.webContents.send("gog-game-reload");
  }

  function cleanupDownloaded(dl_link_set: string[]){
    for(const i in dl_link_set){
      const dl = dl_link_set[i];
      // Remove the file in temp
      const gog_path = getConfig("gog_path");
      const tmp_download = gog_path + "\\.temp\\";
      fs.rmSync(tmp_download + dl);
    }
  }

  function sendUninstallStart(game: GOG.GameInfo, title: string, notify_title?: string){
    console.log("Starting Uninstall");
    win?.webContents.send("game-uns-start", game, notify_title);
    win?.webContents.send("progress-banner-init", {
      title: "Uninstalling " + title,
      color: "deep-orange"
    });
  }

  function sendUninstallFailed(game: GOG.GameInfo, title: string, notify_title?: string){
    win?.webContents.send("game-uns-error", notify_title);
    win?.webContents.send("progress-banner-error", "Failed to uninstall " + title);
  }

  function sendUninstallEnd(game: GOG.GameInfo, title?: string){
    console.log("Ending Uninstall");
    win?.webContents.send("game-uns-end", game, title);
    win?.webContents.send("progress-banner-hide");
  }

  async function uninstallDLC(game: GOG.GameInfo, dlc: GOG.RemoteGameDLC, cb = nothing){
    sendUninstallStart(game, "dlc: " + procKey(dlc.slug));
    if(dlc.uninstall){
      let uninstall = dlc.uninstall;
      if(typeof uninstall === "string"){
        const webdav = await initWebDav();
        const remote = await ensureRemote(game);
        const uninstall_dat = await webdav?.getFileContents(remote.folder + "/.data/" + uninstall);
        if(uninstall_dat === undefined){
          sendUninstallFailed(game, "DLC: " + procKey(dlc.slug));
          return;
        }
        uninstall = JSON.parse(uninstall_dat.toString()) as GOG.DLCUninstall;
      }
      const total_count = uninstall.files?.length + uninstall.folders?.length;
      let processed = 0;
      if(uninstall.files){
        for(const f of uninstall.files){
          const file = game.root_dir + "\\" + f;
          if(fs.existsSync(file)){
            fs.rmSync(file);
          }
          processed++;
          win?.webContents.send("progress-banner-progress", {
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
          win?.webContents.send("progress-banner-progress", {
            total: total_count,
            progress: processed
          });
        }
      }
      sendUninstallEnd(game, "DLC: " + procKey(dlc.slug));
      cb(true);
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
    sendUninstallEnd(game, "DLC: " + procKey(dlc.slug));
  }

  function uninstallGameZip(game: GOG.GameInfo, cb = nothing){
    sendUninstallStart(game, "game: " + game.name);
    fs.rm(game.root_dir, { recursive: true, force: true }, (e) => {
      if(e === null){
        sendUninstallEnd(game);
        triggerReload();
        cb(true);
        return;
      }
      console.log("Game error uninstalled with error: " + e);
      sendUninstallFailed(game, "game: " + game.name);
      cb(false);
    });
  }

  function uninstallGameExe(game: GOG.GameInfo, title: string, cb = nothing, exe = "unins000.exe"){
    sendUninstallStart(game, title);
    active_ins = child.execFile(
      game.root_dir + "\\" + exe,
      [ "/VERYSILENT", "/SuppressMsgBoxes", "/NoRestart" ],
      function(err, data){
        cb(false);
        if(err){
          console.error(err);
          return;
        }
        console.log(data.toString());
      });

    active_ins.addListener("error", (code: number) => {
      console.log("Game error uninstalled with code: " + code);
      sendUninstallFailed(game, title);
      active_ins = undefined;
      cb(false);
    });
    active_ins.addListener("close", (code: number) => {
      console.log("Game uninstalled with code: " + code);
      if(code === 0){
        sendUninstallEnd(game);
        triggerReload();
        cb(true);
      }
      if(code === 1){
        sendUninstallEnd(game, "Uninstall Canceled");
      }
      active_ins = undefined;
      cb(false);
    });
  }

  async function uninstallGame(game: GOG.GameInfo, cb = nothing){
    game.remote = await ensureRemote(game);
    const version = loadFromVersionCache(flattenName(game.name));
    let download = game.remote.download;
    if(game.remote.versions && version && game.remote.versions[version]){
      download = game.remote.versions[version].download;
    }

    if(game.remote.is_zip || (download.length > 0 && download[0].endsWith(".zip"))){
      uninstallGameZip(game, cb);
    }else if(game.remote === undefined || !game.remote.is_zip){
      uninstallGameExe(game, "game: " + game.name, cb);
    }
    removeFromVersionCache(flattenName(game.name));
  }

  function sendInstallStart(game: GOG.GameInfo, indeterminate = true){
    console.log("Starting Install");
    win?.webContents.send("game-ins-start", game);
    win?.webContents.send("progress-banner-init", {
      title: "Installing game: " + game.name,
      indeterminate: indeterminate,
      cancel_event: "game-dl-cancel",
      cancel_data: game
    });
  }

  function sendInstallEnd(game: GOG.GameInfo){
    console.log("Ending Install");
    win?.webContents.send("game-dlins-end", game);
    win?.webContents.send("progress-banner-hide");
  }

  function sendInstallError(game: GOG.GameInfo){
    win?.webContents.send("game-ins-error", game);
    win?.webContents.send("progress-banner-error", "Failed to install game: " + game.name);
  }

  async function installGameZip(game: GOG.GameInfo, dl_files: string[], zip_f: string){
    sendInstallStart(game, false);
    const gog_path = getConfig("gog_path");
    const tmp_download = gog_path + "\\.temp\\";
    const ins_dir = gog_path + "\\" + globals.normalizeFolder(game.name);
    globals.ensureDir(ins_dir);
    const archive = new zip.async({file: tmp_download + zip_f});
    const total_count = await archive.entriesCount;
    let ex_count = 0;
    archive.on("extract", (entry: ZipEntry) => {
      ex_count++;
      win?.webContents.send("game-ins-progress", game, total_count, ex_count, {
        name: entry.name,
        isDirectory: entry.isDirectory,
        isFile: entry.isFile,
        comment: entry.comment,
        size: entry.size,
        crc: entry.crc
      });
      win?.webContents.send("progress-banner-progress", {
        total: total_count,
        progress: ex_count
      });
    });
    const count = await archive.extract(null, ins_dir);

    console.log("Extracted:" + count);
    await archive.close();
    // Write game name to file
    fs.writeFileSync(ins_dir + "/" + game_name_file, game.name);
    cleanupDownloaded(dl_files);
    sendInstallEnd(game);
    triggerReload();
  }

  function installGameExe(game: GOG.GameInfo, dl_files: string[], exe: string){
    sendInstallStart(game);
    const gog_path = getConfig("gog_path");
    const tmp_download = gog_path + "\\.temp\\";
    const ins_dir = gog_path + "\\" + globals.normalizeFolder(game.name);
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

    active_ins.addListener("error", (code: number) => {
      console.log("Game error installed with code: " + code);
      sendInstallError(game);
      active_ins = undefined;
    });
    active_ins.addListener("close", (code: number) => {
      console.log("Game installed with code: " + code);
      // Write game name to file
      fs.writeFileSync(ins_dir + "/" + game_name_file, game.name);
      if(code === 3221226525){
        cleanupDownloaded(dl_files);
        sendInstallEnd(game);
        triggerReload();
      }
      if(code === 2){
        win?.webContents.send("game-ins-end", game, false);
        win?.webContents.send("progress-banner-hide");
      }
      if(code === 2){
        sendInstallError(game);
      }
      active_ins = undefined;
    });
  }

  function installGame(game: GOG.GameInfo, dl_files: string[], exe: string){
    console.log("Install init: ", exe);
    if(exe.endsWith(".exe")){
      installGameExe(game, dl_files, exe);
    }else if(exe.endsWith(".zip")){
      installGameZip(game, dl_files, exe);
    }
  }

  async function downloadGameSequence(
    game: GOG.GameInfo, title: string, dl_link_set: string[],
    install = true, pos: number, downloaded = 0, cb = nothing){
    if(download_cancel){
      cb(false);
      return;
    }
    try{
      game.remote = await ensureRemote(game);
    }catch(e){
      if(globals){
        globals.notify({
          type: "error",
          title: "Failed to start download: No Remote Data",
          text: game.name
        });
        win?.webContents.send("game-dl-error", game, false);
        win?.webContents.send("progress-banner-error", "Failed to start download: No Remote Data");
      }
      cb(false);
      return;
    }
    if(dl_link_set.length <= pos){
      win?.webContents.send("game-dl-end", game, true);
      win?.webContents.send("progress-banner-hide");
      active_dl = undefined;
      cb(true);
      if(install){
        installGame(game, dl_link_set, dl_link_set[0]);
      }
      return;
    }
    if(pos === 0){
      win?.webContents.send("game-dl-start", game);
      win?.webContents.send("progress-banner-init", {
        title: "Downloading " + title,
        cancel_event: "game-dl-cancel",
        cancel_data: game
      });
    }
    const gog_path = getConfig("gog_path");
    const tmp_download = gog_path + "\\.temp\\";
    globals.ensureDir(tmp_download);
    const item = dl_link_set[pos];
    const webdav = await initWebDav();
    if(webdav){
      const total = game.remote.dl_size;
      const stat = await webdav.stat(game.remote.folder + "/" + item) as FileStat;
      const done = () => {
        if(download_cancel){
          cb(false);
          return;
        }
        win?.webContents.send("progress-banner-progress", {
          total: total,
          progress: downloaded + stat.size
        });
        return downloadGameSequence(game, title, dl_link_set, install, pos + 1, downloaded + stat.size, cb);
      };

      const save_loc = tmp_download + "/" + item;
      if(fs.existsSync(save_loc)){
        const fs_stat = fs.statSync(save_loc);
        if(fs_stat.size === stat.size){
          win?.webContents.send("game-dl-progress", game, {
            total: total,
            progress: downloaded + fs_stat.size
          });
          done();
          return;
        }
      }
      active_dl = downloadFile(webdav.getFileDownloadLink(game.remote.folder + "/" + item), item);

      active_dl.on("end", () => {
        done();
      });
      active_dl.on("stop", () => {
        cleanupDownloaded(dl_link_set);
      });
      active_dl.on("progress.throttled", (p: Stats) => {
        const prog = {
          total: total,
          progress: downloaded + p.downloaded,
          speed: p.speed
        };
        win?.webContents.send("game-dl-progress", game, prog);
        win?.webContents.send("progress-banner-progress", prog);
      });
      active_dl.on("error", (e) => {
        win?.webContents.send("game-dl-error", game, e);
        win?.webContents.send("progress-banner-error", "Failed to download game: " + game.name);
      });
      if(fs.existsSync(save_loc)){
        active_dl.resumeFromFile(save_loc);
      }else{
        active_dl.start();
      }
    }
  }
  function downloadCancel(game: GOG.GameInfo){
    console.log("Canceling Download / Install");
    download_cancel = true;
    if(active_dl !== undefined){
      active_dl.stop();
      active_dl = undefined;
    }
    if(active_ins !== undefined && active_ins.pid){
      tk(active_ins.pid, "SIGKILL", function(err){
        if(err){
          console.log(err);
          globals.notify({
            type: "error",
            title: "Failed to kill install!"
          });
        }
      });
    }
    win?.webContents.send("game-ins-end", game, false);
    win?.webContents.send("progress-banner-hide");
  }

  async function downloadPrep(
    game: GOG.GameInfo, install: boolean, title:
    string, dl_link_set: string[], remote: GOG.RemoteGameData, cb = nothing){
    downloadCancel(game);
    if(active_dl !== undefined){
      globals.notify({
        type: "warning",
        title: "There is already an active download"
      });
      cb(false);
      return;
    }
    download_cancel = false;
    if(game.remote === undefined){
      win?.webContents.send("progress-banner-error", "Failed to start download: No Remote Data");
      cb(false);
      return;
    }
    const gog_path = getConfig("gog_path");
    const tmp_download = gog_path + "\\.temp\\";
    globals.ensureDir(tmp_download);
    try{
      // Do the total size calc
      const webdav = await initWebDav();
      if(webdav){
        let dl_size = 0;
        for(const i in dl_link_set){
          const dl = dl_link_set[i];
          const stat = await webdav.stat(game.remote.folder + "/" + dl) as FileStat;
          dl_size += stat.size;
        }
        remote.dl_size = dl_size;
      }
    }catch(e){
      win?.webContents.send("progress-banner-error", "Failed to start download: Remote Files not found");
      console.log("Failed to calculate total size: ", e);
      cb(false);
      return;
    }
    return downloadGameSequence(game, title, dl_link_set, install, 0, 0, cb);
  }

  async function prepDownloadGame(game: GOG.GameInfo, install: boolean, cb = nothing){
    try{
      game.remote = await ensureRemote(game);
    }catch(e){
      globals.notify({
        type: "error",
        title: "Failed to start download: No Remote Data",
        text: game.name
      });
      win?.webContents.send("progress-banner-error", "Failed to start download: No Remote Data");
      win?.webContents.send("game-dl-error", game, false);
      cb(false);
      return;
    }
    downloadPrep(game, install, "game: " + game.name, game.remote.download, game.remote, cb);
  }

  // Init
  ipcMain.on("install-game", async(e, game: GOG.GameInfo) => {
    prepDownloadGame(game, true, (success) => {
      if(success){
        removeFromVersionCache(flattenName(game.name));
      }
    });
  });

  // Init
  ipcMain.on("reinstall-game", async(e, game: GOG.GameInfo) => {
    prepDownloadGame(game, false, (success2) => {
      if(success2){
        uninstallGame(game, (success1) => {
          if(success1){
            prepDownloadGame(game, true, (success) => {
              if(success){
                removeFromVersionCache(flattenName(game.name));
              }
            });
          }
        });
      }
    });
  });

  // Init
  ipcMain.on("download-game", async(e, game: GOG.GameInfo) => {
    prepDownloadGame(game, false);
  });

  async function prepDownloadDLC(game: GOG.GameInfo, dlc_slug: string, install: boolean, cb = nothing){
    download_cancel = false;
    try{
      game.remote = await ensureRemote(game);
    }catch(e){
      globals.notify({
        type: "error",
        title: "Failed to start download: No Remote Data",
        text: game.name
      });
      win?.webContents.send("progress-banner-error", "Failed to start download: No Remote Data");
      win?.webContents.send("game-dl-error", game, false);
      return;
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
    return downloadPrep(game, install, "dlc: " + procKey(dlc_slug), game.remote.dlc[idx].download, game.remote, cb);
  }

  async function prepDownloadVersion(game: GOG.GameInfo, version_id: string, version: GOG.RemoteGameDLC, install: boolean, cb = nothing){
    download_cancel = false;
    try{
      game.remote = await ensureRemote(game);
    }catch(e){
      globals.notify({
        type: "error",
        title: "Failed to start download: No Remote Data",
        text: game.name
      });
      win?.webContents.send("progress-banner-error", "Failed to start download: No Remote Data");
      win?.webContents.send("game-dl-error", game, false);
      cb(false);
      return;
    }
    return downloadPrep(game, install, procKey(game.name) + " version: " + version_id, version.download, game.remote, cb);
  }

  // Init
  ipcMain.on("install-dlc", (e, game: GOG.GameInfo, dlc_slug: string) => {
    prepDownloadDLC(game, dlc_slug, true, (success: boolean) => {
      if(success){
        win?.webContents.send("gog-game-reload", game);
      }
    });
  });

  // Init
  ipcMain.on("uninstall-dlc", (e, game: GOG.GameInfo, dlc: GOG.RemoteGameDLC) => {
    uninstallDLC(game, dlc, (success: boolean) => {
      if(success){
        win?.webContents.send("gog-game-reload", game);
      }
    });
  });

  // Init
  ipcMain.on("download-dlc", (e, game: GOG.GameInfo, dlc_slug: string) => {
    prepDownloadDLC(game, dlc_slug, false);
  });

  // Init
  ipcMain.on("install-version", async(e, game: GOG.GameInfo, version_id: string, version: GOG.RemoteGameDLC) => {
    prepDownloadVersion(game, version_id, version, false, (succss) => {
      if(succss){
        uninstallGame(game);
        prepDownloadVersion(game, version_id, version, true, (success) => {
          if(success){
            saveToVersionCache(flattenName(game.name), Buffer.from(version_id));
          }
        });
      }
    });
  });

  // Init
  ipcMain.on("download-version", async(e, game: GOG.GameInfo, version_id: string, version: GOG.RemoteGameDLC) => {
    prepDownloadVersion(game, version_id, version, false);
  });

  ipcMain.on("game-dl-cancel", (e,  game: GOG.GameInfo) => {
    downloadCancel(game);
  });

  ipcMain.on("uninstall-game", (e, game: GOG.GameInfo) => {
    uninstallGame(game);
  });
}