
import * as child from "child_process";
import { IpcMain, shell } from "electron";
import fs from "fs";
import {  getOS } from "./config";

function openFolderCommand(){
  switch (process.platform){
  case "darwin" : return "finder";
  case "win32" : return "explorer.exe";
  case "linux" : return "";
  default : return "";
  }
}

export default function init(ipcMain: IpcMain){

  // Play task saving
  ipcMain.on("open-file", (e, path: string) =>{
    path = path.replaceAll("[&|;:$()]+", "");
    const os = getOS();
    switch(os){
    case "windows": path = path.replaceAll("/", "\\"); break;
    case "linux": path = path.replaceAll("\\", "/"); break;
    default: break;
    }
    console.log("Opening path:", path);
    if(fs.existsSync(path)){
      shell.openPath(path);
    }
  });

  // Play task saving
  ipcMain.on("open-link", (e, path: string) =>{
    path = path.replaceAll("[&|;:$()]+", "").replaceAll("\\", "/");
    console.log("Opening link:", path);
    shell.openExternal(path);
  });


  ipcMain.on("open-folder", (e, path: string) => {
    path = path.replaceAll("[&|;:$()]+", "");
    const os = getOS();
    switch(os){
    case "windows": path = path.replaceAll("/", "\\"); break;
    case "linux": path = path.replaceAll("\\", "/"); break;
    default: break;
    }
    console.log("Opening path:", path);
    if(fs.existsSync(path)){
      child.exec(openFolderCommand() + " \"" + path + "\"");
    }
  });

}