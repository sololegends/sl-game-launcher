import archiver, { ArchiverError, ProgressData } from "archiver";
import { BrowserWindow, IpcMain } from "electron";
import { FileStat, ProgressEvent } from "webdav";
import { initWebDav, mutateFolder, webDavConfig } from "./nc_webdav";
import { ensureRemote } from "./game_loader";
import fs from "fs";
import { getConfig } from "./config";
import { glob } from "glob";
import { GOG } from "@/types/gog/game_info";


export default function init(ipcMain: IpcMain, win: BrowserWindow){
  // Init

  async function initCloudEntries(){
    const web_dav = await initWebDav();
    const nc_cfg = webDavConfig();
    if(nc_cfg !== undefined && web_dav !== undefined){
      const mutated_folder = mutateFolder(nc_cfg.folder);
      const contents = await web_dav.getDirectoryContents(mutated_folder) as FileStat[];
      for(const i in contents){
        const file = contents[i] as FileStat;
        if(file.type === "directory" && !file.filename.startsWith("~")){
          // Check for or create .data dir
          const data_dir = file.filename + "/.data/";
          if(!await web_dav.exists(data_dir)){
            console.log("[" + file.filename + "] Creating data dir");
            web_dav.createDirectory(data_dir);
          }
          // Check for or create game-data.json
          const game_data = data_dir + "game-data.json";
          if(!await web_dav.exists(game_data)){
            console.log("[" + file.filename + "] Creating game-data");
            // Get file listings
            const files = await web_dav.getDirectoryContents(file.filename) as FileStat[];
            const file_data = {} as Record<string, string[]>;
            let shortest = undefined as undefined | string;
            for(const i in files){
              const f = files[i];
              const ext = f.filename.substring(f.filename.lastIndexOf(".") + 1);
              const fname = f.filename.substring(1 + f.filename.lastIndexOf("/"));
              console.log("[" + file.filename + "] handling file: [" + f.filename + "][" + ext + "]");
              const ekey = fname.substring(0, fname.lastIndexOf("."));
              if(ext === "exe" && file_data[ekey] === undefined){
                file_data[ekey] = [fname];
              }else if(ext === "exe"){
                file_data[ekey].push(fname);
              }
              const key = fname.substring(0, fname.lastIndexOf("-"));
              if(ext === "bin" && file_data[key] === undefined){
                file_data[key] = [fname];
              } else if(ext === "bin"){
                file_data[key].push(fname);
              }
            }
            for(const k in file_data){
              if(shortest === undefined || shortest.length > k.length){
                shortest = k;
              }
            }
            if(shortest === undefined){
              shortest = "none";
            }
            const main_exe = file_data[shortest];
            delete file_data[shortest];
            const dlc = [];
            for(const k in file_data){
              dlc.push({
                "slug": k.substring(6),
                "download": file_data[k]
              });
            }
            const game_data_json = {
              "logo": "logo.jpg",
              "logo_format": "image/jpg",
              "slug": shortest.substring(6),
              "download": [
                main_exe
              ],
              "dlc": dlc
            };
            console.log("[" + file.filename + "] Writing game-data");
            await web_dav.putFileContents(game_data, JSON.stringify(game_data_json, null, 2));
          }
        }
      }
    }
  }
  ipcMain.on("initCloudEntries", initCloudEntries);


  async function makeZipPackage(e: Electron.IpcMainEvent, game: GOG.GameInfo){
    function cancelFn(){
      win?.webContents.send("progress-banner-hide");
      win?.webContents.send("zip-package-done", game);
      return 1;
    }
    let cancel = false;
    // ========== PREPARATION ==========
    win?.webContents.send("progress-banner-init", {
      title: "Creating Package for " + game.name,
      cancel_event: "make-zip-cancel"
    });
    try{
      game.remote = await ensureRemote(game);
    }catch(e){
      win?.webContents.send("progress-banner-error", "Failed to make zip: No remote data");
      return;
    }
    const gog_path = getConfig("gog_path");
    const tmp_download = gog_path + "\\.temp\\";
    const ins_dir = game.root_dir;
    const zip_file = tmp_download + game.remote?.slug + ".zip";
    const remote_file = game.remote.folder + "/" + game.remote?.slug + ".zip";

    // ========== FILE ZIPPING ==========
    const output = fs.createWriteStream(zip_file);
    const archive_op = archiver.create("zip", {
      comment: "SL Game Packaged Game",
      zlib: {
        level: 9
      }
    });

    function zipCancel(){
      cancel = true;
      console.log("Canceling Archive operation");
      archive_op?.abort();
      output.close();
      fs.rmSync(zip_file);
      win?.webContents.send("progress-banner-hide");
      win?.webContents.send("zip-package-done", game);
    }
    ipcMain.on("make-zip-cancel", zipCancel);

    const globber = glob(ins_dir + "\\**", {
      stat: true,
      dot: true
    }, (e) => {
      console.log(e);
    } );

    const promise = new Promise<void>((resolver) => {
      globber.on("end", () => {
        resolver();
      });
    });
    await promise;
    const files = globber.found;

    archive_op.on("error", (error: ArchiverError) => {
      win?.webContents.send("zip-package-error", error);
    });
    archive_op.on("progress", (progress: ProgressData) => {
      win?.webContents.send("progress-banner-progress", {
        total: files.length,
        progress: progress.entries.processed
      });
      win?.webContents.send("zip-package-progress", progress);
    });
    archive_op.pipe(output);

    archive_op.directory(ins_dir, false);
    await archive_op.finalize();
    const promise2 = new Promise<void>((resolver) => {
      output.on("finish", () => {
        output.close();
        resolver();
      });
    });
    await promise2;
    ipcMain.off("make-zip-cancel", zipCancel);
    if(cancel){ return cancelFn(); }

    // ========== WebDAV UPLOAD ==========
    function preWebDavAbort(){
      cancel = true;
    }
    ipcMain.on("make-zip-cancel", preWebDavAbort);
    win?.webContents.send("progress-banner-init", "Uploading Package for " + game.name);
    const webdav = await initWebDav({maxBodyLength: 1073741824}, true);
    // Check if file is on the server
    if(webdav === undefined){
      win?.webContents.send("progress-banner-error", "Failed to connect to remote storage");
      return;
    }
    if(cancel){ return cancelFn(); }
    if(await webdav.exists(remote_file)){
      win?.webContents.send("progress-banner-hide");
      win?.webContents.send("zip-package-done", game);
      return;
    }
    if(cancel){ return cancelFn(); }
    ipcMain.off("make-zip-cancel", preWebDavAbort);
    const read_stream = fs.createReadStream(zip_file);
    const controller = new AbortController();
    console.log("Uploading file...");
    const webdav_op = webdav.putFileContents(remote_file, read_stream, {
      signal: controller.signal,
      overwrite: false,
      onUploadProgress: (e: ProgressEvent) => {
        console.log(e);
        win?.webContents.send("progress-banner-progress", {
          total: e.total,
          processed: e.loaded
        });
      }
    });
    function abortWebdav(){
      console.log("Canceling Archive upload");
      controller.abort();
      read_stream.close();
    }
    ipcMain.on("make-zip-cancel", abortWebdav);
    await webdav_op;
    read_stream.close();
    ipcMain.off("make-zip-cancel", abortWebdav);

    win?.webContents.send("progress-banner-hide");
    win?.webContents.send("zip-package-done", game);
  }

  ipcMain.on("zip-package-make", makeZipPackage);
}