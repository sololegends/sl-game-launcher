
import { Add, RedEditResponse, Type } from "regedit";
import elevate from "../elevate";

const DEFAULT_TYPE = "REG_SZ";
const NEEDS_SEPARATOR = "REG_MULTI_SZ";

/**
 * Actually executes registry command, requesting elevation
 *
 * @param command - REG command to execute
 * @returns RedEditResponse - the response resulting form the command's execution
 */
async function exec(command: string): Promise<RedEditResponse>{
  return new Promise<RedEditResponse>((resolve, reject) => {
    // Something
    elevate("reg " + command, (error, stdout, stderr) => {
      if(error){
        return reject({
          success: false,
          stdout: stdout && stdout instanceof Buffer ? stdout?.toString() : stdout,
          stderr: stderr && stderr instanceof Buffer ? stderr?.toString() : stderr
        });
      }
      return resolve({
        success: true,
        stdout: stdout && stdout instanceof Buffer ? stdout?.toString() : stdout,
        stderr: stderr && stderr instanceof Buffer ? stderr?.toString() : stderr
      });
    });
  });
}

export async function Query(){
  // TODO: implement this
  return "NYI";
}

export async function Add(key: string, value: string, type: Type, data: string,
  separator?: string, force?: boolean, bit_64?: boolean){
  let command = "add \"" + key.replaceAll("\"", "\\\"") + "\"";
  // Value
  if(value){
    if(value === ""){
      command += " /ve";
    }else{
      command +=  " /ValueName \"" + value.replaceAll("\"", "\\\"") + "\"";
    }
  }
  // Type
  if(type){
    command += " /t " + type;
  }else if(value){
    command += " /t " + DEFAULT_TYPE;
  }
  // Separator
  if(separator && type === NEEDS_SEPARATOR && separator.length === 1){
    command += " /s " + separator;
  }else if(type === NEEDS_SEPARATOR){
    command += " /s \0";
  }
  // Data
  if(data){
    command += " /d \"" + data.replaceAll("\"", "\\\"") + "\"";
  }
  // Flags
  if(force){
    command += " /f";
  }
  if(bit_64 !== undefined){
    command += " /reg:" + bit_64 ? "64" : "32";
  }
  return exec(command);
}

export async function Delete(){
  // TODO: implement this
  return "NYI";
}

export async function Copy(){
  // TODO: implement this
  return "NYI";
}

export async function Save(){
  // TODO: implement this
  return "NYI";
}

export async function Load(){
  // TODO: implement this
  return "NYI";
}

export async function Unload(){
  // TODO: implement this
  return "NYI";
}

export async function Restore(){
  // TODO: implement this
  return "NYI";
}

export async function Compare(){
  // TODO: implement this
  return "NYI";
}

export async function Export(){
  // TODO: implement this
  return "NYI";
}

export async function Import(){
  // TODO: implement this
  return "NYI";
}

export async function Flags(){
  // TODO: implement this
  return "NYI";
}
