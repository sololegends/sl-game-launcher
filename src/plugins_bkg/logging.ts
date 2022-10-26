
import { BrowserWindow, IpcMain } from "electron";
import fs from "fs";
import { Globals } from ".";

export default function init(ipcMain: IpcMain, win: BrowserWindow, globals: Globals){

  const logging_dir = globals.app_dir;
  const log_file = logging_dir + "console.log";
  globals.ensureDir(logging_dir);
  if(fs.existsSync(log_file)){
    const stat = fs.statSync(log_file);
    const date = stat.mtime.getFullYear() + "-" + stat.mtime.getMonth() + "-" + stat.mtime.getDate() + "."
      + stat.mtime.getHours() + "-" + stat.mtime.getMinutes() + "-" + stat.mtime.getSeconds();
    fs.renameSync(log_file, log_file.replace("log", date + ".log"));
  }
  const output = fs.createWriteStream(log_file);

  const olog = console.log;
  console.log = function(message: string, ...optionalParams: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
    olog(message, (optionalParams ? optionalParams : ""));
    output.write("\r\n[" + new Date() + "] >> LOG >> " + message + " " + (optionalParams ? optionalParams : ""));
  };

  const owarn = console.warn;
  console.warn = function(message: string, ...optionalParams: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
    owarn(message, (optionalParams ? optionalParams : ""));
    output.write("\r\n[" + new Date() + "] >> WARN >> " + message + " " + (optionalParams ? optionalParams : ""));
  };

  const oerror = console.error;
  console.error = function(message: string, ...optionalParams: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
    oerror(message, (optionalParams ? optionalParams : ""));
    output.write("\r\n[" + new Date() + "] >> ERROR >> " + message + " " + (optionalParams ? optionalParams : ""));
  };
}