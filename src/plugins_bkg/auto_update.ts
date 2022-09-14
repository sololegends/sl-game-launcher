
import { autoUpdater, ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from "electron-updater";
import { BrowserWindow, IpcMain } from "electron";
import { Globals } from ".";


export default function init(ipcMain: IpcMain, win: BrowserWindow, globals: Globals){

  let downloading_update = false;

  ipcMain.on("download-update", () => {
    globals.log("Update download triggered...");
    win?.webContents.send("progress-banner-init", {
      title: "Downloading app update",
      color: "blue-grey"
    });
    autoUpdater.downloadUpdate();
  });

  ipcMain.on("install-update", () => {
    globals.log("Update install triggered...");
    autoUpdater.quitAndInstall();
  });

  autoUpdater.on("checking-for-update", () => {
    globals.log("Checking for update...");
  });
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    globals.log("Update available: " + info);
    win.webContents.send("notify", {
      title: "New version available!",
      text: "Version " + info.version + " is available as of " + info.releaseDate,
      type: "success",
      action: {
        name: "Download",
        event: "download-update",
        clear: true
      }
    }, "bell_alerts");
  });
  autoUpdater.on("update-not-available", () => {
    globals.log("Update not available");
  });
  autoUpdater.on("error", (err) => {
    if(downloading_update){
      win?.webContents.send("progress-banner-hide");
    }
    globals.log("Update err: " + err);
    win.webContents.send("notify", {
      title: "Error in auto-updater",
      text: err.message,
      type: "error"
    }, "bell_alerts");
  });
  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    downloading_update = true;
    globals.log("Update progress: " + progress);
    win?.webContents.send("progress-banner-progress", {
      total: progress.total,
      progress: progress.transferred,
      speed: progress.bytesPerSecond
    });
  });
  autoUpdater.on("update-downloaded", (info: UpdateDownloadedEvent) => {
    win?.webContents.send("progress-banner-hide");
    globals.log("Update downloaded: " + info);
    win.webContents.send("notify", {
      title: "Ready for install!",
      text: "Version " + info.version + " is ready for install",
      type: "success",
      action: {
        name: "Install",
        event: "install-update",
        clear: true
      }
    }, "bell_alerts");
  });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.checkForUpdatesAndNotify();
}