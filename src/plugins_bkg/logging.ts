
import { appDataDir } from "./config";
import { ensureDir } from "./tools/files";
import fs from "fs";
import { IpcMain } from "electron";
import { win } from ".";

function processParams(params: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
  for(const i in params){
    if(typeof params[i] === "object"){
      if(params[i].message && params[i].stack){
        params[i] = params[i].message + "\n" + params[i].stack;
        continue;
      }
      params[i] = JSON.stringify(params[i]);
    }
  }
  return params;
}

export default function init(ipcMain: IpcMain){

  let do_event_logging = false;

  const logging_dir = appDataDir();
  const log_file = logging_dir + "console.log";
  ensureDir(logging_dir);
  if(fs.existsSync(log_file)){
    fs.renameSync(log_file, log_file.replace("log", "last.log"));
  }
  const output = fs.createWriteStream(log_file);

  const odebug = console.debug;
  console.debug = function(message: string, ...optionalParams: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
    processParams(optionalParams);
    odebug.apply(console, [ message, ...(optionalParams ? optionalParams : []) ]);
    const built_message = "\r\n[" + new Date().toISOString() + "] >> DEBUG >> " + message + " " + (optionalParams ? optionalParams : "");
    output.write(built_message);
    if(do_event_logging){
      win()?.webContents.send("logging-event", built_message);
    }
  };

  const olog = console.log;
  console.log = function(message: string, ...optionalParams: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
    processParams(optionalParams);
    olog.apply(console, [ message, ...(optionalParams ? optionalParams : []) ]);
    const built_message = "\r\n[" + new Date().toISOString() + "] >> LOG   >> " + message + " " + (optionalParams ? optionalParams : "");
    output.write(built_message);
    if(do_event_logging){
      win()?.webContents.send("logging-event", built_message);
    }
  };

  const owarn = console.warn;
  console.warn = function(message: string, ...optionalParams: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
    processParams(optionalParams);
    owarn.apply(console, [ message, ...(optionalParams ? optionalParams : []) ]);
    const built_message = "\r\n[" + new Date().toISOString() + "] >> WARN  >> " + message + " " + (optionalParams ? optionalParams : "");
    output.write(built_message);
    if(do_event_logging){
      win()?.webContents.send("logging-event", built_message);
    }
  };

  const oerror = console.error;
  console.error = function(message: string, ...optionalParams: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
    processParams(optionalParams);
    oerror.apply(console, [ message, ...(optionalParams ? optionalParams : []) ]);
    const built_message = "\r\n[" + new Date().toISOString() + "] >> ERROR >> " + message + " " + (optionalParams ? optionalParams : "");
    output.write(built_message);
    if(do_event_logging){
      win()?.webContents.send("logging-event", built_message);
    }
  };

  // Listen for logging enabling
  ipcMain.on("logging-enable-events", () => {
    do_event_logging = true;
  });
  ipcMain.on("logging-disable-events", () => {
    do_event_logging = true;
  });
  ipcMain.handle("logging-existing-logs", () => {
    return fs.readFileSync(log_file).toString();
  });
}