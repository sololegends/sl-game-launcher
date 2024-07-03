
import fs from "fs";
import os from "os";
import { GOG } from "@/types/gog/game_info";
import { glob } from "glob";

export function ensureDir(dir: string){
  if(!fs.existsSync(dir)){
    fs.mkdirSync(dir, {recursive: true});
  }
}

export function mutatePath(path: string, game: GOG.GameInfo){
  if(path.startsWith("~")){
    return os.homedir()  + path.substring(1);
  }else if(path.startsWith("./")){
    return game.root_dir  + path.substring(1);
  }else if(path.startsWith("{steam}/")){
    // TODO: Find steam dir
    return game.root_dir  + path.substring(1);
  }
  return path
    .replace("{app}", game?.root_dir)
    .replace("{appDir}", game?.root_dir)
    .replace("{supportDir}", game?.root_dir + "/__support")
    .replace("{deployDir}", game?.root_dir + "/__deploy")
    .replace("{redistDir}", game?.root_dir + "/__redist")
    .replace("{user}", os.homedir())
    .replace("{userdocs}", os.homedir() + "/Documents")
    .replace("{userpics}", os.homedir() + "/Pictures")
    .replace("{userlocal}", os.homedir() + "/AppData/Local")
    .replace("{userlocallow}", os.homedir() + "/AppData/LocalLow")
    .replace("{userappdata}", os.homedir() + "/AppData/Roaming");
}

export function mutateFile(path: string, game: GOG.GameInfo){
  if(path.startsWith("~")){
    path = os.homedir()  + path.substring(1);
  }else if(path.startsWith("./")){
    path = game.root_dir  + path.substring(1);
  }else if(path.startsWith("{steam}/")){
    // TODO: Find steam dir
    path = game.root_dir  + path.substring(1);
  }
  return path
    .replaceAll("{app}", game?.root_dir)
    .replaceAll("{appDir}", game?.root_dir)
    .replaceAll("{supportDir}", game?.root_dir + "/__support")
    .replaceAll("{deployDir}", game?.root_dir + "/__deploy")
    .replaceAll("{redistDir}", game?.root_dir + "/__redist")
    .replaceAll("{user}", os.homedir())
    .replaceAll("{userdocs}", os.homedir() + "/Documents")
    .replaceAll("{userpics}", os.homedir() + "/Pictures")
    .replaceAll("{userlocal}", os.homedir() + "/AppData/Local")
    .replaceAll("{userlocallow}", os.homedir() + "/AppData/LocalLow")
    .replaceAll("{userappdata}", os.homedir() + "/AppData/Roaming");
}

export function normalizeFolder(path: string): string{
  return path.replaceAll(/[&|;:$()]/g, "");
}

export function getFolderSize(folder: string): number{
  if(folder.endsWith("\\") || folder.endsWith("/")){
    folder = folder.substring(0, folder.length - 1);
  }
  const dir_stat = fs.statSync(folder);
  let accumulator = 0;
  if(dir_stat.isDirectory()){
    const files = fs.readdirSync(folder);
    for(const i in files){
      accumulator += getFolderSize(folder + "/" + files[i]);
    }
    return accumulator;
  }
  return dir_stat.size;
}

export function globAsync(input: string): Promise<string[]>{
  return new Promise<string[]>((resolver) => {
    const globber = glob(input, {
      stat: true,
      dot: true
    }, (e) => {
      if(e){
        console.log(e);
        resolver([]);
      }
    } );
    globber.on("end", () => {
      resolver(globber.found);
    });
  });
}