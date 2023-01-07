
import { appDataDir } from "./config";
import { ensureDir } from "./tools/files";
import fs from "fs";

function processParams(params: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
  for(const i in params){
    if(typeof params[i] === "object"){
      params[i] = JSON.stringify(params[i]);
    }
  }
  return params;
}

export default function init(){

  const logging_dir = appDataDir();
  const log_file = logging_dir + "console.log";
  ensureDir(logging_dir);
  if(fs.existsSync(log_file)){
    fs.renameSync(log_file, log_file.replace("log", "last.log"));
  }
  const output = fs.createWriteStream(log_file);

  const olog = console.log;
  console.log = function(message: string, ...optionalParams: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
    processParams(optionalParams);
    olog.apply(olog, [ message, ...(optionalParams ? optionalParams : []) ]);
    output.write("\r\n[" + new Date() + "] >> LOG >> " + message + " " + (optionalParams ? optionalParams : ""));
  };

  const owarn = console.warn;
  console.warn = function(message: string, ...optionalParams: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
    processParams(optionalParams);
    owarn.apply(owarn, [ message, ...(optionalParams ? optionalParams : []) ]);
    output.write("\r\n[" + new Date() + "] >> WARN >> " + message + " " + (optionalParams ? optionalParams : ""));
  };

  const oerror = console.error;
  console.error = function(message: string, ...optionalParams: any[]){ // eslint-disable-line @typescript-eslint/no-explicit-any
    processParams(optionalParams);
    oerror.apply(oerror, [ message, ...(optionalParams ? optionalParams : []) ]);
    output.write("\r\n[" + new Date() + "] >> ERROR >> " + message + " " + (optionalParams ? optionalParams : ""));
  };
}