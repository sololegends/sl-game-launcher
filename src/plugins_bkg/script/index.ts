

import { existsSync, readFileSync } from "fs";
import { GOG } from "@/types/gog/game_info";
import Reg from "../as_admin/regedit/windows";
import { Regedit } from "regedit";
import { win } from "..";

const REG_TYPE_MUTATE = {
  string: "REG_SZ"
} as Record<string, Regedit.Type>;

async function action_setRegistry(game: GOG.GameInfo, action: GOG.ScriptInstall.setRegistry){
  const args = action.arguments;
  // Mutate the data
  let data = args.valueData;
  data = data.replace("{app}", game.root_dir);
  // Run the registry add fn
  return {
    result: await Reg.Add(args.root + "\\" + args.subkey, args.valueName, REG_TYPE_MUTATE[args.valueType], data)
  };
}

async function installAction(game: GOG.GameInfo, action: GOG.ScriptInstallAction){
  switch(action.action){
  // Skip this for now
  case "savePath": break;
  case "setRegistry":
    return await action_setRegistry(game, action);
  default:
    // Nothing by default
    break;
  }
}

async function execAction(game: GOG.GameInfo, action: GOG.ScriptAction){
  if(action.install){
    await installAction(game, action.install);
  }
}

export async function processScript(game: GOG.GameInfo){
  if(game.root_dir === undefined || game.root_dir === "remote" || existsSync(game.root_dir)){
    return;
  }

  // Check for script file
  const script_file = game.root_dir + "/goggame-" + game.gameId + ".script";
  if(existsSync(script_file)){
    // Load the script
    try{
      const script = JSON.parse(readFileSync(script_file).toString()) as GOG.Script;
      // If there are no actions
      if(!script.actions){
        return;
      }
      for(const action of script.actions){
        win()?.webContents.send("progress-banner-init", {
          title: "Executing install script: " + action.name,
          indeterminate: true
        });
        await execAction(game, action);
        win()?.webContents.send("progress-banner-hide");
      }
    }catch(e){
      console.log("Failed to read script as json: ", e);
      return;
    }
  }
}