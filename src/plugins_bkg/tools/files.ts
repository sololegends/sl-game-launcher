
import fs from "fs";

export function ensureDir(dir: string){
  if(!fs.existsSync(dir)){
    fs.mkdirSync(dir, {recursive: true});
  }
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
