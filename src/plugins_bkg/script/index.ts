

import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { ensureDir, mutateFile, mutatePath } from "../tools/files";
import elevate from "../as_admin/elevate";
import { GOG } from "@/types/gog/game_info";
import Reg from "../as_admin/regedit/windows";
import { Regedit } from "../as_admin/regedit/regedit";
import { win } from "..";
import zip from "node-stream-zip";

const REG_TYPE_MUTATE = {
  string: "REG_SZ",
  dword: "REG_DWORD"
} as Record<string, Regedit.Type>;

type ActionResult = {
  command?: string
  result?: string
}

export type PostScriptResult = {
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
  const data = mutatePath(args.valueData, game);
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

async function action_ensureDirectory(game: GOG.GameInfo, action: GOG.ScriptInstall.ensureDirectory, undo: boolean): Promise<ActionResult>{
  if(undo){
    return {};
  }
  const args = action.arguments;
  if(!args.target){
    return {};
  }
  ensureDir(mutatePath(args.target, game));
  return {};
}

async function action_supportData(game: GOG.GameInfo, action: GOG.ScriptInstall.supportData, undo: boolean): Promise<ActionResult>{
  const args = action.arguments;
  if(!args.source || !args.target){
    return {};
  }
  const src = mutatePath(args.source, game);
  const target = mutatePath(args.target, game);
  try{
    if(undo){
      switch(args.type){
      case "folder": {
        const files = readdirSync(src);
        for(const file of files){
          if(args.overwrite){
            rmSync(target + "/" + file);
          }
        }
        break;
      } case "file": {
        if(args.overwrite){
          rmSync(target);
        }
        break;
      } case "archive": {
        if(args.overwrite){
          rmSync(target);
        }
        break;
      }
      default: break;
      }
    }
    // Copy the whole folder
    switch(args.type){
    case "folder": {
      const files = readdirSync(src);
      for(const file of files){
        copyFileSync(src + "/" + file, target + "/" + file, args.overwrite ? undefined : constants.COPYFILE_EXCL);
        rmSync(src + "/" + file);
      }
      break;
    } case "file": {
    // Mutate the files with args like appDir, userDir, etc
      if(args.mutate){
        writeFileSync(src, mutateFile(readFileSync(src).toString(), game));
      }
      // Copy the file
      copyFileSync(src, target, args.overwrite ? undefined : constants.COPYFILE_EXCL);
      // Remove the source file
      rmSync(src);
      break;
    } case "archive": {
      if(!existsSync(target)){
        mkdirSync(target, {recursive: true});
      }
      const archive = new zip.async({file: src});
      const promise = new Promise<ActionResult>((resolve, reject) => {
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
      promise.then(() => {
        rmSync(src);
      });
      return promise;

      break;
    }
    default: break;
    }
  }catch(e){
    return {
      result: "error: " + (e as object).toString()
    };
  }
  return {};
}

async function action_xmlData(game: GOG.GameInfo, action: GOG.ScriptInstall.xmlData, undo: boolean): Promise<ActionResult>{
  const args = action.arguments;
  if(!args.path || !args.target){
    return {};
  }
  const target = mutatePath(args.target, game);
  // Check the target files exists
  if(!existsSync(target)){
    return {
      result: "error: target xml file doesn't exist"
    };
  }

  // Parse the XML data
  const parser = new DOMParser();
  const xml = parser.parseFromString(readFileSync(target).toString("utf8"), "text/xml");

  function normalizeSlashes(input: string | null): string | null{
    if(input === null){
      return null;
    }
    return input.replaceAll("\\", "/");
  }

  function verifyElement(check: Record<string, string>, element: Node): boolean{
    let found = true;
    // Check containing data
    const children = element.childNodes;
    console.log("Verifying Element [" + element.nodeName + ">>" + element.textContent + "]", check);
    if(children.length < Object.keys(check).length){
      console.log("children length [" + children.length + "] < check length [" + Object.keys(check).length + "]");
      return false;
    }
    for(const key in check){
      for(let i = 0; i < children.length; i++){
        const child = children.item(i);
        if(child.nodeName === key){
          found = found && normalizeSlashes(child.textContent) === normalizeSlashes(mutatePath(check[key], game));
          break;
        }
      }
    }
    console.log("found", found);
    return found;
  }

  function locateElement(xml: Document, element: string, create = true): undefined | Node{
    const path = element.split(".");
    let target = xml as Node;
    for(const ele of path){
      let found = false;
      if(target.hasChildNodes()){
        const children = target.childNodes;
        for(let i = 0; i < children.length; i++){
          const child = children.item(i);
          if(child.nodeName === ele){
            target = child;
            found = true;
            break;
          }
        }
      }
      if(!found){
        if(!create){
          return undefined;
        }
        // Create Element
        const new_ele = xml.createElement(ele);
        target.appendChild(new_ele);
        target = new_ele;
      }
    }
    return target;
  }
  if(undo){
    if(args.type === "insert"){
      if(args.id){
        // Delete by ID
        const id_ele = xml.getElementById(args.id);
        if(id_ele && id_ele.parentNode){
          id_ele.parentNode.removeChild(id_ele);
          return {};
        }
      }
      const node = locateElement(xml, args.path.substring(0, args.path.lastIndexOf(".")), false);
      if(node === undefined){
        console.error("Failed to find node for xmdData script. args:", args);
        return {
          result: "error: Failed to find node for xmdData script: " + args.path
        };
      }
      // Look for matching data elements
      const children = node.childNodes;
      const root_node_name = args.path.substring(args.path.lastIndexOf(".") + 1);
      for(let i = 0; i < children.length; i++){
        const child = children.item(i);
        if(child.nodeName === root_node_name){
          if(verifyElement(args.data, child)){
            if(child.parentNode){
              child.parentNode.removeChild(child);
              break;
            }
          }
        }
      }
      writeFileSync(target, new XMLSerializer().serializeToString(xml));
      return {};
    }
  }
  if(args.type === "insert"){
    const node = locateElement(xml, args.path);
    if(node === undefined){
      console.error("Failed to find node for xmdData script. args:", args);
      return {
        result: "error: Failed to find node for xmdData script: " + args.path
      };
    }
    for(const key in args.data){
      const child_node = xml.createElement(key);
      const innerText = xml.createTextNode(mutatePath(args.data[key], game));
      child_node.appendChild(innerText);
      node.appendChild(child_node);
    }
    // Write the xml back to disk
    writeFileSync(target, new XMLSerializer().serializeToString(xml));
    return {};
  }
  return {};
  // TODO: Add the delete handling
}

async function installAction(game: GOG.GameInfo, action: GOG.ScriptInstallAction, undo: boolean): Promise<ActionResult>{
  if(undo && action.no_uninstall){
    return {};
  }
  switch(action.action){
  // Skip this for now
  case "savePath": break;
  case "setRegistry":
    return await action_setRegistry(game, action, undo);
  case "supportData":
    return await action_supportData(game, action, undo);
  case "ensureDirectory":
    return await action_ensureDirectory(game, action, undo);
  case "xmlData":
    return await action_xmlData(game, action, undo);
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

export function needsElevation(game: GOG.GameInfo, game_id_override?: string): boolean{
  if(game.root_dir === undefined || game.root_dir === "remote" || !existsSync(game.root_dir)){
    return false;
  }

  let script_file = game.root_dir + "/goggame-" + (game_id_override ? game_id_override : game.gameId) + ".script";
  console.debug("Looking for script file: ", script_file);
  if(!existsSync(script_file)){
    script_file = game.root_dir + "/game-data-" + (game_id_override ? game_id_override : game.gameId) + ".script";
  }
  console.debug("Looking for secondary script file: ", script_file);
  if(existsSync(script_file)){
    const script = JSON.parse(readFileSync(script_file).toString()) as GOG.Script;
    for(const action of script.actions){
      if(action.name === "setRegistry"){
        return true;
      }
    }
  }
  return false;
}

export async function processScript(game: GOG.GameInfo, undo = false, game_id_override?: string): Promise<PostScriptResult>{
  if(game.root_dir === undefined || game.root_dir === "remote" || !existsSync(game.root_dir)){
    return {};
  }

  // Check for script file
  let script_file = game.root_dir + "/goggame-" + (game_id_override ? game_id_override : game.gameId) + ".script";
  console.debug("Looking for script file: ", script_file);
  if(!existsSync(script_file)){
    script_file = game.root_dir + "/game-data-" + (game_id_override ? game_id_override : game.gameId) + ".script";
  }
  console.debug("Looking for secondary script file: ", script_file);
  if(existsSync(script_file)){
    // Load the script
    try{
      const script = JSON.parse(readFileSync(script_file).toString()) as GOG.Script;
      console.debug("script file data: ", script);
      // If there are no actions
      if(!script.actions){
        return { };
      }
      try{
        const commands = [] as string[];
        for(const action of script.actions){
          try{
            win()?.webContents.send("progress-banner-init", {
              title: "Evaluating " + (undo ? "un" : "") + "install script: " + action.name,
              indeterminate: true
            });
            const result = await execAction(game, action, undo);
            if(result.command){
              commands.push(result.command);
            }
            win()?.webContents.send("progress-banner-hide");
          }catch(e){
            console.error("Failed to execute script action: ", action, e);
            win()?.webContents.send("progress-banner-hide");
            return { error: "Failed to execute script action: " + action.name };
          }
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
        console.error("Failed to execute script: ", e);
        return { error: "Failed to execute script" };
      }
    }catch(e){
      console.error("Failed to read script as json: ", e);
      return { error: "Failed to read script as json" };
    }
  }
  return {};
}

// For uninstalling
export async function processScriptReverse(game: GOG.GameInfo, game_id_override?: string){
  return processScript(game, true, game_id_override);
}