
import { BrowserWindow, IpcMain } from "electron";
import { GOG } from "@/types/gog/game_info";


export default function init(ipcMain: IpcMain, win: BrowserWindow){
  console.log("Steam Interface module loaded, but not created");
}