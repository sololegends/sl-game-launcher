
import { BrowserWindow, IpcMain } from "electron";
import { downloadAndReinstall } from "./game_dl_install";
import { ensureRemote } from "./game_loader";
import { GOG } from "@/types/gog/game_info";

let _win = undefined as BrowserWindow | undefined;
let _ipcMain = undefined as IpcMain | undefined;

export async function checkForUpdates(game: GOG.GameInfo, sticky = false, notify = true, no_prompt = false){
  game.remote = await ensureRemote(game, false);
  return new Promise<boolean>((resolver) => {
    if(_win === undefined || _ipcMain === undefined){
      resolver(false);
      return;
    }
    _win?.webContents.send("save-game-sync-state", game, "Checking for updates: " + game.name);
    const game_id = game.iter_id || 0;
    if(game.remote?.iter_id && game.remote.iter_id > game_id){
      if(no_prompt){
        downloadAndReinstall(game).finally(() => {
          resolver(false);
        });
        _win?.webContents.send("save-game-stopped");
        return false;
      }
      if(notify){
        const evt_1 = "ignore-game-update-" + new Date().getTime();
        _win?.webContents.send("notify", {
          title: "Game update available!",
          text: game.name + " has a new version available. " + game.remote.version,
          type: "info",
          sticky,
          closed: evt_1,
          actions: [
            {
              name: "Update Now",
              event: "reinstall-game",
              data: game,
              clear: true
            },
            {
              name: "Ignore",
              event: evt_1,
              clear: true
            }
          ]
        });
        _ipcMain.once(evt_1, async() => {
          _win?.webContents.send("save-game-stopped");
          resolver(false);
          return false;
        });
      }else{
        resolver(false);
      }
      // Send message to game card that it has an update
      _win?.webContents.send("game-remote-updated", game.remote);
      _win?.webContents.send("save-game-stopped");
      return;
    }
    _win?.webContents.send("save-game-stopped");
    resolver(false);
  });
}

export default function init(ipcMain: IpcMain, win: BrowserWindow){
  _win = win;
  _ipcMain = ipcMain;

  ipcMain.on("check-for-updates", async(e, games: GOG.GameInfo[]) => {
    // Run update check for each one
    for(const game of games){
      checkForUpdates(game, false, false);
    }
  });

  ipcMain.handle("check-update-game", (e, game: GOG.GameInfo, sticky: boolean) => {
    return checkForUpdates(game, sticky);
  });

  ipcMain.handle("update-game", (e, game: GOG.GameInfo) => {
    return checkForUpdates(game, false, false, true);
  });

}