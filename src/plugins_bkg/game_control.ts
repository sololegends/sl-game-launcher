
import * as child from "child_process";
import { acquireLock, LAUNCH_GAME_LOCK } from "./tools/locks";
import { BrowserWindow, IpcMain } from "electron";
import { syncGameSave, uploadGameSave } from "./cloud_saves";
import { checkForUpdates } from "./update_check";
import { ensureRemote } from "./game_loader";
import { Globals } from ".";
import { GOG } from "@/types/gog/game_info";
import tk from "tree-kill";
import { updatePlayTime } from "./play_time_tracker";

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

  function procArgs(args?: string){
    const regex = / (?=(?:[^"]|"[^"]*")*$)/gm;
    if(args){
      const args_a = [];
      for(const e of args.split(regex)){
        args_a.push(e.replaceAll("\"", ""));
      }
      return args_a;
    }
    return [];
  }

  async function launchGame(e: unknown, game: GOG.GameInfo){
    const lock = acquireLock(LAUNCH_GAME_LOCK, true, false);
    if(lock === undefined){
      globals.notify({
        type: "warning",
        title: "Cannot launch game!",
        text: "Another game is already running"
      });
      return;
    }
    if(running_game !== undefined && running_game.process !== undefined){
      quitGame();
      runningGameChanged();
    }
    let halt = false;
    const cancel_launch_evt = "cancel-game-launch";
    const haltfn = () => {
      halt = true;
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
    win?.webContents.send("save-game-sync-state", game.name, "Syncing Remote Data");
    game.remote = await ensureRemote(game, false);
    win?.webContents.send("save-game-stopped", game);
    if(halt){
      win?.webContents.send("progress-banner-hide");
      return false;
    }
    // Check for new cloud sync
    const cloud_sync = new Promise<boolean>((resolver)=>{
      syncGameSave(game, resolver);
    });
    await cloud_sync;
    if(halt){
      win?.webContents.send("progress-banner-hide");
      return false;
    }
    await checkForUpdates(game);
    win?.webContents.send("progress-banner-hide");
    ipcMain.off(cancel_launch_evt, haltfn);
    if(halt){
      win?.webContents.send("progress-banner-hide");
      return false;
    }
    const start = new Date().getTime();
    let exec_file = undefined;
    let the_task = undefined;
    for(const i in game.playTasks){
      const task = game.playTasks[i];
      console.log(task);
      if(task.isPrimary){
        exec_file = game.root_dir + "\\" + task.path;
        the_task = task;
        break;
      }
    }
    if(exec_file === undefined){
      return false;
    }
    running_game = {
      info: game
    };
    console.log(
      "Running Game: " + exec_file,
      game.root_dir + (the_task?.workingDir ? "/" + the_task?.workingDir : ""),
      procArgs(the_task?.arguments)
    );
    // ============================================
    // Actually run the game task
    // ============================================
    running_game.process = child.execFile(
      exec_file,
      procArgs(the_task?.arguments),
      {
        cwd: game.root_dir + (the_task?.workingDir ? "/" + the_task?.workingDir : "")
      },
      function(err, data){
        if(err){
          console.error(err);
          return;
        }
        console.log(data.toString());
      });
    console.log("Game started: " + running_game.process.pid);
    running_game.process.addListener("close", (code: number) => {
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