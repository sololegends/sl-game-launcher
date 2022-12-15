

import { constants, copyFileSync, existsSync, readdirSync, readFileSync } from "fs";
import { GOG } from "@/types/gog/game_info";
import os from "os";
import Reg from "../as_admin/regedit/windows";
import { Regedit } from "regedit";
import { win } from "..";

const REG_TYPE_MUTATE = {
  string: "REG_SZ"
} as Record<string, Regedit.Type>;

function gogPath(path: string, game: GOG.GameInfo){
  return path
    .replace("{app}", game.root_dir)
    .replace("{supportDir}", game.root_dir + "/__support")
    .replace("{userdocs}", os.homedir() + "/Documents");
}

async function action_setRegistry(game: GOG.GameInfo, action: GOG.ScriptInstall.setRegistry, undo: boolean){
  const args = action.arguments;
  if(!args.root || !args.subkey || !args.valueData || !args.valueName || !args.valueType){
    return {
      result: "invalid"
    };
  }
  // Mutate the data
  const data = gogPath(args.valueData, game);
  if(undo){
    return {
      result: await Reg.Delete(
        args.root + "\\" + args.subkey,
        args.valueName,
        true,
        game.osBitness?.includes("64") ? true : false
      )
    };
  }
  // Run the registry add fn
  return {
    result: await Reg.Add(
      args.root + "\\" + args.subkey,
      args.valueName,
      REG_TYPE_MUTATE[args.valueType],
      data,
      undefined,
      true,
      game.osBitness?.includes("64") ? true : false
    )
  };
}

async function action_supportData(game: GOG.GameInfo, action: GOG.ScriptInstall.supportData, undo: boolean){
  const args = action.arguments;

  if(undo){


    return;
  }
  switch(args.type){
  case "folder": {
    // Copy the whole folder
    const src = gogPath(args.source, game);
    const target = gogPath(args.target, game);
    const files = readdirSync(src);
    for(const file of files){
      if(args.overwrite){
        copyFileSync(src + "/" + file, target + "/" + file);
        continue;
      }
      copyFileSync(src + "/" + file, target + "/" + file, constants.COPYFILE_EXCL);
    }
    break;
  } case "file":
    // Copy the file
    // CopyFileSync(args.source, args.target);
    break;
  default: break;
  }
}

async function installAction(game: GOG.GameInfo, action: GOG.ScriptInstallAction, undo: boolean){
  switch(action.action){
  // Skip this for now
  case "savePath": break;
  case "setRegistry":
    return await action_setRegistry(game, action, undo);
  case "supportData":
    return await action_supportData(game, action, undo);
  default:
    // Nothing by default
    break;
  }
}

async function execAction(game: GOG.GameInfo, action: GOG.ScriptAction, undo: boolean){
  if(action.install){
    await installAction(game, action.install, undo);
  }
}

export async function processScript(game: GOG.GameInfo, undo = false){
  if(game.root_dir === undefined || game.root_dir === "remote" || !existsSync(game.root_dir)){
    return;
  }

  // Check for script file
  const script_file = game.root_dir + "/goggame-" + game.gameId + ".script";
  console.log("Looking for script file: ", script_file);
  if(existsSync(script_file)){
    // Load the script
    try{
      const script = JSON.parse(readFileSync(script_file).toString()) as GOG.Script;
      console.log("script file data: ", script);
      // If there are no actions
      if(!script.actions){
        return;
      }
      for(const action of script.actions){
        win()?.webContents.send("progress-banner-init", {
          title: "Executing " + (undo ? "un" : "") + "install script: " + action.name,
          indeterminate: true
        });
        await execAction(game, action, undo);
        win()?.webContents.send("progress-banner-hide");
      }
    }catch(e){
      console.log("Failed to read script as json: ", e);
      return;
    }
  }
}

// For uninstalling
export async function processScriptReverse(game: GOG.GameInfo){
  return processScript(game, true);
}