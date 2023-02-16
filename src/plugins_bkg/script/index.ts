

import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import elevate from "../as_admin/elevate";
import { GOG } from "@/types/gog/game_info";
import os from "os";
import Reg from "../as_admin/regedit/windows";
import { Regedit } from "../as_admin/regedit/regedit";
import { win } from "..";
import zip from "node-stream-zip";

const REG_TYPE_MUTATE = {
  string: "REG_SZ",
  dword: "REG_DWORD"
} as Record<string, Regedit.Type>;

function gogPath(path: string, game: GOG.GameInfo){
  return path
    .replace("{app}", game.root_dir)
    .replace("{supportDir}", game.root_dir + "/__support")
    .replace("{deployDir}", game.root_dir + "/__deploy")
    .replace("{redistDir}", game.root_dir + "/__redist")
    .replace("{userdocs}", os.homedir() + "/Documents")
    .replace("{userappdata}", os.homedir() + "/ApData/Roaming");
}

type ActionResult = {
  command?: string
  result?: string
}

type PostScriptResult = {
  error?: string
  stdout?: string
  stderr?: string
}

async function action_setRegistry(game: GOG.GameInfo, action: GOG.ScriptInstall.setRegistry, undo: boolean): Promise<ActionResult>{
  const args = action.arguments;
  if(args.root && args.subkey && !args.valueName){
    if(undo){
      return {
        command: Reg.buildDelete(
          args.root + "\\" + args.subkey,
          undefined,
          true,
          game.osBitness?.includes("64") ? true : false
        )
      };
    }
    // Run the registry add fn
    return {
      command: Reg.buildAdd(
        args.root + "\\" + args.subkey,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        game.osBitness?.includes("64") ? true : false
      )
    };
  }
  if(!args.root || !args.subkey || !args.valueData || !args.valueName || !args.valueType){
    console.warn("Invalid or unsupported setRegistry entry", action);
    return {
      result: "invalid"
    };
  }
  // Mutate the data
  const data = gogPath(args.valueData, game);
  if(undo){
    return {
      command: Reg.buildDelete(
        args.root + "\\" + args.subkey,
        args.valueName,
        true,
        game.osBitness?.includes("64") ? true : false
      )
    };
  }
  // Run the registry add fn
  return {
    command: Reg.buildAdd(
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

async function action_supportData(game: GOG.GameInfo, action: GOG.ScriptInstall.supportData, undo: boolean): Promise<ActionResult>{
  const args = action.arguments;

  if(undo){
    return {};
  }
  if(!args.source || !args.target){
    return {};
  }
  // Copy the whole folder
  const src = gogPath(args.source, game);
  const target = gogPath(args.target, game);
  switch(args.type){
  case "folder": {
    const files = readdirSync(src);
    for(const file of files){
      if(args.overwrite){
        copyFileSync(src + "/" + file, target + "/" + file);
        continue;
      }
      copyFileSync(src + "/" + file, target + "/" + file, constants.COPYFILE_EXCL);
    }
    break;
  } case "file": {
    // Copy the file
    copyFileSync(src, target, args.overwrite ? undefined : constants.COPYFILE_EXCL);
    break;
  } case "archive": {
    if(!existsSync(target)){
      mkdirSync(target, {recursive: true});
    }
    const archive = new zip.async({file: src});
    return new Promise<ActionResult>((resolve, reject) => {
      archive.extract(null, target).then(() => {
        archive.close().then(() => {
          resolve({});
        }).catch((e) => {
          reject({result: e});
        });
      }).catch((e) => {
        reject({result: e});
      });
    });

    break;
  }
  default: break;
  }
  return {};
}

async function installAction(game: GOG.GameInfo, action: GOG.ScriptInstallAction, undo: boolean): Promise<ActionResult>{
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
  return {};
}

async function execAction(game: GOG.GameInfo, action: GOG.ScriptAction, undo: boolean): Promise<ActionResult>{
  if(action.install){
    return await installAction(game, action.install, undo);
  }
  return {};
}

export async function processScript(game: GOG.GameInfo, undo = false, game_id_override?: string): Promise<PostScriptResult>{
  if(game.root_dir === undefined || game.root_dir === "remote" || !existsSync(game.root_dir)){
    return {};
  }

  // Check for script file
  const script_file = game.root_dir + "/goggame-" + (game_id_override ? game_id_override : game.gameId) + ".script";
  console.log("Looking for script file: ", script_file);
  if(existsSync(script_file)){
    // Load the script
    try{
      const script = JSON.parse(readFileSync(script_file).toString()) as GOG.Script;
      console.log("script file data: ", script);
      // If there are no actions
      if(!script.actions){
        return { };
      }
      const commands = [] as string[];
      for(const action of script.actions){
        win()?.webContents.send("progress-banner-init", {
          title: "Evaluating " + (undo ? "un" : "") + "install script: " + action.name,
          indeterminate: true
        });
        const result = await execAction(game, action, undo);
        if(result.command){
          commands.push(result.command);
        }
        win()?.webContents.send("progress-banner-hide");
      }
      if(commands.length > 0){
        win()?.webContents.send("progress-banner-init", {
          title: "Please Wait, Executing post commands...",
          indeterminate: true
        });
        // Run the exe, should ask for elevation on run
        return new Promise<PostScriptResult>((resolve, reject) => {
          elevate(
            commands.join(" & "),
            function(error?: Error, stdout?: string | Buffer, stderr?: string | Buffer){
              win()?.webContents.send("progress-banner-hide");
              const obj = {
                error: JSON.stringify(error),
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
    }catch(e){
      console.log("Failed to read script as json: ", e);
      return { error: "Failed to read script as json" };
    }
  }
  return {};
}

// For uninstalling
export async function processScriptReverse(game: GOG.GameInfo, game_id_override?: string){
  return processScript(game, true, game_id_override);
}