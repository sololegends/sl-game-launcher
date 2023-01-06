
import { existsSync, readdirSync } from "fs";
import elevate from "../elevate";
import { ensureRemote } from "@/plugins_bkg/game_loader";
import { GOG } from "@/types/gog/game_info";
import isInstalled from "@/plugins_bkg/tools/installed_apps";
import {parsePE} from "pe-exe-parser";
import { win } from "@/plugins_bkg";

type RedistInstallResult = {
  error: Error | undefined
  stdout: string | undefined
  stderr: string | undefined
}

async function installRedist(redist_exes: string[]): Promise<RedistInstallResult>{
  return new Promise<RedistInstallResult>((resolve, reject) => {
    win()?.webContents.send("progress-banner-init", {
      title: "Please Wait, Installing Dependencies...",
      indeterminate: true
    });
    // Run the exe, should ask for elevation on run
    elevate(
      redist_exes.join(" & "),
      function(error?: Error, stdout?: string | Buffer, stderr?: string | Buffer){
        win()?.webContents.send("progress-banner-hide");
        const obj = {
          error,
          stdout: stdout && stdout instanceof Buffer ? stdout.toString() : stdout,
          stderr: stderr && stderr instanceof Buffer ? stderr.toString() : stderr
        };
        if(error){
          console.error("Failed to install redistributables: ", obj.error, obj.stdout, obj.stderr);
          reject(obj);
          return;
        }
        resolve(obj);
      });
  });
}

async function isInstalledExe(exe_path: string){
  try{
    const exe_data = (await parsePE(exe_path, {})).metadata();
    if(exe_data.ProductName === undefined || exe_data.ProductVersion === undefined){
      return false;
    }
    return await isInstalled(exe_data.ProductName, exe_data.ProductVersion);
  }catch(e){
    console.error(e);
  }
  return false;
}


async function isInstalledObj(redist: GOG.GameRedist){
  if(redist.name === undefined || redist.version === undefined){
    return false;
  }
  return await isInstalled(redist.name, redist.version);
}

export async function scanAndInstallRedist(game: GOG.GameInfo){
  // Use the remote defined with silent args, if possible
  game.remote = await ensureRemote(game);
  if(game.remote?.redist){
    // Build install set
    const redist_set = [];
    for(const redist of game.remote.redist){
      // * Check if already installed
      const exe_path = game.root_dir + "/" + redist.exe_path;
      if(!(await isInstalledObj(redist)) && !(await isInstalledExe(exe_path))){
        redist_set.push("\"" + exe_path + "\" " + redist.arguments.join(" "));
      }
    }
    if(redist_set.length > 0){
      await installRedist(redist_set);
    }
    return;
  }
  // Fallback to installing, but with guis..
  const redist_folder = game.root_dir + "/" + "__redist";
  // Check if the redist folder even exists
  if(!existsSync(redist_folder)){
    return true;
  }
  // Scan the __redist folder ignoring ISI
  const redist = readdirSync(redist_folder);

  // Iterate through and identify / execute in quiet mode where possible
  const redist_set = [];
  for(const folder of redist){
    if(folder === "ISI"){
      continue;
    }
    // Find exes within the folder
    const exe_folder = redist_folder + "/" + folder;
    const exes = readdirSync(exe_folder);
    for(const exe of exes){
      if(exe.endsWith(".exe")){
        // * Check if already installed
        const exe_path = exe_folder + "/" + exe;
        if(!isInstalledExe(exe_path)){
          redist_set.push("\"" + exe_path + "\"");
        }
      }
    }
  }
  if(redist_set.length > 0){
    await installRedist(redist_set);
  }
}