
import { downloadAndReinstall } from "./game_dl_install";
import { ensureRemote } from "./game_loader";
import {getConfig} from "./config";
import { GOG } from "@/types/gog/game_info";
import { IpcMain } from "electron";
import {remote} from "./backplane";
import { win } from ".";

let _ipcMain = undefined as IpcMain | undefined;

export async function checkForUpdates(game: GOG.GameInfo, notify = true, no_prompt = false, loud = true, use_remote?: GOG.RemoteGameData){
  if(getConfig("offline")){
    return new Promise<boolean>((resolver) => {
      resolver(false);
    });
  }
  game.remote = use_remote || await ensureRemote(game, false);
  return new Promise<boolean>((resolver) => {
    if(win() === undefined || _ipcMain === undefined){
      resolver(false);
      return;
    }
    const updateGame = function(){
      downloadAndReinstall(game).finally(() => {
        resolver(false);
      });
      if(loud){
        win()?.webContents.send("save-game-stopped");
      }
    };
    if(loud){
      win()?.webContents.send("save-game-sync-state", game.name, "Checking for updates: " + game.name);
    }
    const game_id = game.iter_id || 0;
    if(game.remote?.iter_id && game.remote.iter_id > game_id){
      if(no_prompt){
        updateGame();
        return;
      }
      if(notify){
        const evt = "do-game-update-" + new Date().getTime();
        const evt_1 = "ignore-game-update-" + new Date().getTime();
        _ipcMain.once(evt_1, async() => {
          if(loud){
            win()?.webContents.send("save-game-stopped");
          }
          resolver(true);
          return;
        });
        _ipcMain.once(evt, async() => {
          updateGame();
          return;
        });
        win()?.webContents.send(
          "question",
          "The game will launch following update completion.",
          game.name + " has a new version available. " + game.remote.version,
          {
            header: "Game update available",
            buttons: [
              { text: "Update", id: evt },
              { text: "Skip", id: evt_1 }
            ]
          }
        );
      }else{
        resolver(false);
      }
      // Send message to game card that it has an update

      if(loud){
        win()?.webContents.send("game-remote-updated", game.remote);
        win()?.webContents.send("save-game-stopped");
      }
      return;
    }
    if(loud){
      win()?.webContents.send("save-game-stopped");
    }
    resolver(false);
  });
}

export default function init(ipcMain: IpcMain){
  _ipcMain = ipcMain;

  ipcMain.on("check-for-updates", async(e, games: GOG.GameInfo[], loud?: boolean) => {
    if(getConfig("offline")){
      return;
    }
    // Run update check for each one
    // Optimize for many installs
    const game_ids = [];
    for(const game of games){
      game_ids.push(game.gameId);
    }

    const remotes = await remote.games(false, game_ids);

    for(const game of games){
      checkForUpdates(game, false, false, loud, remotes[game.remote_name]);
    }
  });

  ipcMain.handle("check-update-game", (e, game: GOG.GameInfo, sticky: boolean) => {
    return checkForUpdates(game, sticky);
  });

  ipcMain.handle("update-game", (e, game: GOG.GameInfo) => {
    return checkForUpdates(game, true, true);
  });

}