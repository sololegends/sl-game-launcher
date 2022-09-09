
import * as child from "child_process";
import { BrowserWindow, IpcMain } from "electron";
import { Globals } from ".";
import { GOG } from "@/types/gog/game_info";
import tk from "tree-kill";

// GAME CONTROL
let running_game = undefined as undefined | GOG.RunningGame;

export default function init(ipcMain: IpcMain, win: BrowserWindow, globals: Globals){

  function runningGameChanged(){
    win?.webContents.send("game-running-changed", running_game?.info);
  }

  function quitGame(){
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

  function launchGame(e: unknown, game: GOG.GameInfo){
    if(running_game !== undefined && running_game.process !== undefined){
      quitGame();
      runningGameChanged();
    }
    let exec_file = undefined;
    for(const i in game.playTasks){
      const task = game.playTasks[i];
      console.log(task);
      if(task.isPrimary){
        exec_file = game.root_dir + "\\" + task.path;
        break;
      }
    }
    if(exec_file === undefined){
      return false;
    }
    running_game = {
      info: game
    };
    console.log("Running Game: " + exec_file);
    running_game.process = child.execFile(
      exec_file,
      {
        cwd: game.root_dir
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