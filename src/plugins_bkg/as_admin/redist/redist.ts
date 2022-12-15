
import { existsSync, readdirSync } from "fs";
import elevate from "../elevate";
import { ensureRemote } from "@/plugins_bkg/game_loader";
import { GOG } from "@/types/gog/game_info";
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

export async function scanAndInstallRedist(game: GOG.GameInfo){
  // Use the remote defined with silent args, if possible
  game.remote = await ensureRemote(game);
  if(game.remote?.redist){
    // Build install set
    const redist_set = [];
    for(const redist of game.remote.redist){
      redist_set.push("\"" + game.root_dir + "/" + redist.exe_path + "\" " + redist.arguments.join(" "));
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
        redist_set.push("\"" + exe_folder + "/" + exe + "\"");
      }
    }
  }
  if(redist_set.length > 0){
    await installRedist(redist_set);
  }
}