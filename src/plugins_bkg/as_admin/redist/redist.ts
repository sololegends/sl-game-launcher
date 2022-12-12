
import * as child from "child_process";
import { existsSync, readdirSync } from "fs";
import { notify, win } from "@/plugins_bkg";
import { GOG } from "@/types/gog/game_info";
import { ipcMain } from "electron";
import tk from "tree-kill";

const SILENT_ARGS = {
  "vcredist_x64.exe": [ "/quiet", "/install", "/norestart" ],
  "vcredist_x86.exe": [ "/quiet", "/install", "/norestart" ],
  "DXSETUP.exe": [ "/quiet", "/norestart" ],
  "dotNet.*": [ "/quiet", "/norestart" ],

  // Just every general one ¯\_(ツ)_/¯
  "default": [ "/quiet", "/q", "/silent", "/verysilent", "/s", "/S", "/norestart" ]
} as Record<string, string[]>;


type RedistInstallResult = {
	exe: string
	code: number
}

function getSilentArgs(exe_file: string){
  if(SILENT_ARGS[exe_file]){
    return SILENT_ARGS[exe_file];
  }
  for(const match in SILENT_ARGS){
    if(exe_file.match(match)){
      return SILENT_ARGS[match];
    }
  }
  return SILENT_ARGS.default;
}

async function installRedist(exe_path: string, exe_file: string): Promise<RedistInstallResult>{
  // TODO: Get the system and install accordingly
  // Get the solent args, or default
  const args = getSilentArgs(exe_file);
  return new Promise<RedistInstallResult>((resolve, reject) => {
    win()?.webContents.send("progress-banner-init", {
      title: "Installing Dependency: " + exe_file,
      indeterminate: true,
      cancel_event: "redist-ins-cancel"
    });
    // Run the exe, should ask for elevation on run
    const active_ins = child.execFile(
      exe_path,
      args,
      function(err, data){
        if(err){
          console.error(err);
          return;
        }
        console.log(data.toString());
      });
    ipcMain.on("redist-ins-cancel", () => {
      if(active_ins.pid){
        tk(active_ins.pid, "SIGKILL", function(err){
          if(err){
            console.log(err);
            notify({
              type: "error",
              title: "Failed to kill install!"
            });
          }
        });
      }
    });
    active_ins.addListener("error", (code: number) => {
      console.log("Redist error installed with code: " + code);
    });
    active_ins.addListener("close", (code: number) => {
      win()?.webContents.send("progress-banner-hide");
      if(code === 0 || code === 3010 || code === 5100){
        resolve({exe: exe_file, code});
        return;
      }
      reject({exe: exe_file, code});
    });
  });
}

export async function scanAndInstallRedist(game: GOG.GameInfo){
  const redist_folder = game.root_dir + "/" + "__redist";
  // Check if the redist folder even exists
  if(!existsSync(redist_folder)){
    return true;
  }
  // Scan the __redist folder ignoring ISI
  const redist = readdirSync(redist_folder);

  // Iterate through and identify / execute in quiet mode where possible
  for(const folder of redist){
    if(folder === "ISI"){
      continue;
    }
    // Find exes within the folder
    const exe_folder = redist_folder + "/" + folder;
    const exes = readdirSync(exe_folder);
    for(const exe of exes){
      await installRedist(exe_folder + "/" + exe, exe);
    }
  }
}