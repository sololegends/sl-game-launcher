
import * as child from "child_process";
import { acquireLock, LAUNCH_GAME_LOCK, releaseLock } from "./tools/locks";
import { BrowserWindow, IpcMain } from "electron";
import { syncGameSave, uploadGameSave } from "./cloud_saves";
import { checkForUpdates } from "./update_check";
import { Globals } from ".";
import { GOG } from "@/types/gog/game_info";
import tk from "tree-kill";
import { updatePlayTime } from "./play_time_tracker";
import { updateLastPlayed } from "./recent_play_tracker";

// GAME CONTROL
let running_game = undefined as undefined | GOG.RunningGame;

export default function init(ipcMain: IpcMain, win: BrowserWindow, globals: Globals){

  function runningGameChanged(){
    win?.webContents.send("game-running-changed", running_game?.info);
  }

  function quitGame(){
    win?.webContents.send("game-running-stopped");
    if(running_game !== undefined && running_game.process !== undefined && !running_game.process.killed){
      console.log("Quitting Game");
      if(running_game.process.pid){
        tk(running_game.process.pid, "SIGKILL", function(err){
          if(err){
            console.log(err);
            globals.notify({
              type: "error",
              title: "Failed to kill game!",
              text: running_game?.info.name
            });
          }
        });
        return;
      }
      running_game = undefined;
    }
    running_game = undefined;
    runningGameChanged();
  }

  function procArgs(args?: string | string[]){
    const regex = / (?=(?:[^"]|"[^"]*")*$)/gm;
    if(args){
      if(Array.isArray(args)){
        return args;
      }
      if(!args.includes("\"")){
        return [args];
      }
      const args_a = [];
      for(const e of args.split(regex)){
        args_a.push(e.replaceAll("\"", ""));
      }
      return args_a;
    }
    return [];
  }

  async function launchGame(e: unknown, game: GOG.GameInfo, play_task?: GOG.PlayTasks){
    const lock = await acquireLock(LAUNCH_GAME_LOCK, true, false);
    if(lock === undefined){
      globals.notify({
        type: "warning",
        title: "Cannot launch game!",
        text: "Another game is already running"
      });
      releaseLock(LAUNCH_GAME_LOCK);
      return;
    }
    if(running_game !== undefined && running_game.process !== undefined){
      quitGame();
      runningGameChanged();
    }
    const cancel_launch_evt = "cancel-game-launch";
    const haltfn = () => {
      lock.abort();
      win?.webContents.send("progress-banner-init", {
        title: "Canceling Launch",
        indeterminate: true,
        color: "primary"
      });
    };
    ipcMain.on(cancel_launch_evt, haltfn);
    win?.webContents.send("progress-banner-init", {
      title: "Launching Game",
      indeterminate: true,
      color: "warning",
      cancel_event: cancel_launch_evt
    });
    if(lock.aborted()){
      releaseLock(LAUNCH_GAME_LOCK);
      win?.webContents.send("progress-banner-hide");
      return false;
    }
    // Check for new cloud sync
    console.log("checking save game sync status");
    const cloud_sync = new Promise<boolean>((resolver)=>{
      syncGameSave(game, resolver);
    }).catch(()=>{
      console.log("Failed to sync game save file");
    });
    await cloud_sync;
    console.log("save game sync complete", lock);
    if(lock.aborted()){
      releaseLock(LAUNCH_GAME_LOCK);
      win?.webContents.send("progress-banner-hide");
      return false;
    }
    win?.webContents.send("save-game-sync-state", game.name, "Checking for Updates");
    console.log("checking for updates");
    await checkForUpdates(game, true, false);
    win?.webContents.send("save-game-stopped", game);
    win?.webContents.send("progress-banner-hide");
    ipcMain.off(cancel_launch_evt, haltfn);
    if(lock.aborted()){
      releaseLock(LAUNCH_GAME_LOCK);
      win?.webContents.send("progress-banner-hide");
      return false;
    }
    console.log("Getting playtask");
    const start = new Date().getTime();
    let the_task = play_task;
    if(the_task === undefined){
      for(const i in game.playTasks){
        const task = game.playTasks[i];
        console.log(task);
        if(task.isPrimary){
          the_task = task;
          break;
        }
      }
    }
    if(the_task === undefined){
      return false;
    }
    running_game = {
      info: game
    };
    console.log(
      "Running Game: " + game.root_dir + "\\" + the_task.path,
      game.root_dir + (the_task?.workingDir ? "/" + the_task?.workingDir : ""), the_task?.arguments,
      procArgs(the_task?.arguments)
    );
    // ============================================
    // Actually run the game task
    // ============================================
    running_game.process = child.execFile(
      game.root_dir + "\\" + the_task.path,
      procArgs(the_task?.arguments),
      {
        cwd: game.root_dir + (the_task?.workingDir ? "/" + the_task?.workingDir : ""),
        maxBuffer: undefined
      },
      function(err, data){
        if(err){
          console.error(err);
          return;
        }
        console.log(data.toString());
      });
    if(running_game.process.pid === undefined){
      releaseLock(LAUNCH_GAME_LOCK);
      running_game = undefined;
      console.log("Failed to launch game", game);
      quitGame();
      return false;
    }
    console.log("Game started: " + running_game.process.pid);
    updateLastPlayed(game);
    running_game.process.addListener("close", (code: number) => {
      releaseLock(LAUNCH_GAME_LOCK);
      console.log("Game exited with code: " + code);
      running_game = undefined;
      updatePlayTime(game, (new Date().getTime() - start) / 1000);
      uploadGameSave(game);
      quitGame();
    });

    runningGameChanged();
    return true;
  }

  ipcMain.handle("run-game", launchGame);

  ipcMain.on("quit-game", quitGame);

  ipcMain.handle("running-game", () => {
    return running_game;
  });

  ipcMain.on("game-running-changed", (e, value) => {
    win?.webContents.send("game-running-changed", value);
  });
}