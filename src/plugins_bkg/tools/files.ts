
import fs from "fs";
import { glob } from "glob";

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