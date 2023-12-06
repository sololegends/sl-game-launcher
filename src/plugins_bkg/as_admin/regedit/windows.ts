
import * as child from "child_process";
import elevate, { ElevateCallback } from "../elevate";
import { Regedit } from "./regedit";

const DEFAULT_TYPE = "REG_SZ";
const NEEDS_SEPARATOR = "REG_MULTI_SZ";
export const HKLM = "HKEY_LOCAL_MACHINE" as Regedit.Machine;
export const HKCU = "HKEY_CURRENT_USER" as Regedit.Machine;
export const HKCC = "HKEY_CURRENT_CONFIG" as Regedit.Machine;
export const HKU = "HKEY_USERS" as Regedit.Machine;
export const HKCR = "HKEY_CLASSES_ROOT" as Regedit.Machine;

/**
 * Actually executes registry command, requesting elevation
 *
 * @param command - REG command to execute
 * @returns RedEditResponse - the response resulting form the command's execution
 */
async function exec(command: string, as_admin = true): Promise<Regedit.RedEditResponse>{
  return new Promise<Regedit.RedEditResponse>((resolve, reject) => {
    const callback = (error: child.ExecException | Error | string | null, stdout: string | Buffer, stderr: string | Buffer) => {
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
    };
    if(!as_admin){
      child.exec(command, callback);
      return;
    }
    // Something
    try{
      elevate(command, callback as ElevateCallback);
    }catch(e){
      callback("Elevation failed", "", "Elevation failed");
    }
  });
}

export function needsAdmin(key: string): boolean{
  key = key.toUpperCase();
  return key.startsWith("HKLM") || key.startsWith("HKCR") || key.startsWith("HKU")
  || key.startsWith(HKLM) || key.startsWith(HKCR) || key.startsWith(HKU);
}

function valueCheck(value?: string): string{
  let command = "";
  if(value){
    if(value === ""){
      command += " /ve";
    }else{
      command +=  " /v \"" + value.replaceAll("\"", "\\\"") + "\"";
    }
  }
  return command;
}

function separatorCheck(separator?: string, type?: Regedit.Type): string{
  let command = "";
  if(separator && type === NEEDS_SEPARATOR && separator.length === 1){
    command += " /s " + separator;
  }else if(type === NEEDS_SEPARATOR){
    command += " /s \0";
  }
  return command;
}

function b64Check(bit_64?: boolean){
  return bit_64 !== undefined ? " /reg:" + (bit_64 ? "64" : "32") : "";
}

export function buildQuery(key: string, value?: string, query_subkeys?: boolean,
  data?: string, target?: "key_names" | "data", case_sensitive?: boolean, exact?: boolean,
  type?: Regedit.Type, separator?: string, bit_64?: boolean): string{

  let command = "reg query \"" + key.replaceAll("\"", "\\\"") + "\"";
  // Value
  command += valueCheck(value);

  // Query SunKeys
  if(query_subkeys){
    command += " /s";
  }

  // Data
  if(data){
    command += " /f " + data;
    if(target === "key_names"){
      command += " /k";
    }
    if(target === "data"){
      command += " /d";
    }
    if(case_sensitive){
      command += " /c";
    }
    if(exact){
      command += " /e";
    }
  }

  // Type
  if(type){
    command += " /t " + type;
  }

  // Separator
  command += separatorCheck(separator, type);

  command += b64Check(bit_64);
  return command;
}

export async function KeyExists(key: string, bit_64?: boolean): Promise<boolean>{
  const result = await exec(
    buildQuery(key, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, bit_64),
    false);
  return result.success;
}

export async function Query(key: string, value?: string, query_subkeys?: boolean,
  data?: string, target?: "key_names" | "data", case_sensitive?: boolean, exact?: boolean,
  type?: Regedit.Type, separator?: string, bit_64?: boolean): Promise<Regedit.RedEditResponse>{

  return exec(buildQuery(key, value, query_subkeys, data, target, case_sensitive, exact, type, separator, bit_64), needsAdmin(key));
}

export function buildAdd(key: string, value: string | undefined, type?: Regedit.Type, data?: string,
  separator?: string, force?: boolean, bit_64?: boolean): string{
  let command = "reg add \"" + key.replaceAll("\"", "\\\"") + "\"";
  // Value
  command += valueCheck(value);

  // Type
  if(type){
    command += " /t " + type;
  }else if(value){
    command += " /t " + DEFAULT_TYPE;
  }
  // Separator
  command += separatorCheck(separator, type);

  // Data
  if(data){
    if(data.endsWith("\\")){
      data += "\\";
    }
    command += " /d \"" + data.replaceAll("\"", "\\\"") + "\"";
  }
  // Flags
  if(force){
    command += " /f";
  }
  command += b64Check(bit_64);

  return command;
}

export async function Add(key: string, value: string | undefined, type: Regedit.Type, data: string,
  separator?: string, force?: boolean, bit_64?: boolean): Promise<Regedit.RedEditResponse>{
  return exec(buildAdd(key, value, type, data, separator, force, bit_64), needsAdmin(key));
}

export function buildDelete(key: string, value?: string, force?: boolean, bit_64?: boolean): string{
  let command = "reg delete \"" + key.replaceAll("\"", "\\\"") + "\"";
  // Value
  if(value === undefined){
    command += " /va";
  }else{
    command += valueCheck(value);
  }

  // Flags
  if(force){
    command += " /f";
  }
  command += b64Check(bit_64);

  return command;
}

export async function Delete(key: string, value?: string, force?: boolean, bit_64?: boolean){
  return exec(buildDelete(key, value, force, bit_64), needsAdmin(key));
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

export function buildExport(key: string, export_file: string, overwrite_file = false, bit_64?: boolean): string{
  let command = "reg export \"" + key.replaceAll("\"", "\\\"") + "\" \"" + export_file + "\"";

  if(overwrite_file){
    command += " /y";
  }

  command += b64Check(bit_64);
  return command;
}

export async function Export(key: string, export_file: string, overwrite_file = false, bit_64?: boolean): Promise<Regedit.RedEditResponse>{
  return exec(buildExport(key, export_file, overwrite_file, bit_64), needsAdmin(key));
}


export function buildImport(import_file: string, bit_64?: boolean): string{
  let command = "reg import \"" + import_file + "\"";

  command += b64Check(bit_64);

  return command;
}

export async function Import(import_file: string, bit_64?: boolean, needs_admin = false): Promise<Regedit.RedEditResponse>{
  return exec(buildImport(import_file, bit_64), needs_admin);
}

export async function Flags(){
  // TODO: implement this
  return "NYI";
}


const export_data = {
  // Variables
  HKLM,
  HKCU,
  HKCC,
  HKU,
  HKCR,

  // Helpers
  needsAdmin,

  // Functions
  KeyExists,
  buildQuery,
  Query,
  buildAdd,
  Add,
  buildDelete,
  Delete,
  Copy,
  Save,
  Load,
  Unload,
  Restore,
  Compare,
  buildExport,
  Export,
  buildImport,
  Import,
  Flags
};

export default export_data;
