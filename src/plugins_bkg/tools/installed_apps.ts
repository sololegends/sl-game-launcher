// REG query string
// STR: reg QUERY HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall /s /t REG_SZ /v Display*e*

import { Query } from "../as_admin/regedit/windows";
import semver from "semver";

export type Software = {
	name: string
	version: string
};

export type SoftwareCallback = (software: Software[]) => void

function parseSoftware(str_data: string): Software[]{
  const split_s = str_data.split(new RegExp(/HKEY_LOCAL_MACHINE.*[\r\n]+/));
  const software = [] as Software[];
  for(const item of split_s){
    const key_split = item.split(new RegExp(/[\r\n]+/));
    const obj = {} as Software;
    for(const ele of key_split){
      const trimmed = ele.trim();
      if(trimmed.startsWith("DisplayName") || trimmed.startsWith("DisplayVersion")){
        const dat = trimmed.split("REG_SZ");
        const key = dat[0].trim().replace("Display", "").toLowerCase() as keyof Software;
        obj[key] = dat[1].trim();
        if(key === "name" && obj[key].startsWith("Microsoft Visual C++")){
          obj[key] = obj[key].split(" - ")[0];
        }
      }
    }
    if(obj.version !== undefined){
      software.push(obj);
    }
  }
  return software;
}

// Checks if version2 is greater or equal to version1
function versionEqualOrGreater(version1: string, version2: string): boolean{
  const ver1 = semver.coerce(version1);
  const ver2 = semver.coerce(version2);
  if(ver1 == null || ver2 == null){
    return false;
  }
  return semver.satisfies(ver1, ">=" + ver2);
}

export async function getInstalled(callback?: SoftwareCallback): Promise<Software[]>{
  // * Get the list of installed apps
  const key = "HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall";
  const result = await Query(
    key,
    "Display*e*",
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    "REG_SZ",
    undefined,
    true
  );
  const result_32 = await Query(
    key,
    "Display*e*",
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    "REG_SZ",
    undefined,
    false
  );
  const final_software = [] as Software[];
  if(result.success && result.stdout !== undefined){
    final_software.push(...parseSoftware(result.stdout));
  }
  if(result_32.success && result_32.stdout !== undefined){
    final_software.push(...parseSoftware(result_32.stdout));
  }

  //* Parse list
  if(callback){
    callback(final_software);
  }
  return final_software;
}


export default async function isInstalled(name: string, version: string, callback?: (result: boolean) => void){
  if(name.startsWith("Microsoft Visual C++")){
    name = name.split(" - ")[0];
  }
  // * Get the list of installed apps
  const software = await getInstalled();
  //* Check for the requested app + version
  for(const app of software){
    if(app.name === name && versionEqualOrGreater(app.version, version)){
      if(callback){
        callback(true);
      }
      return true;
    }
  }
  if(callback){
    callback(false);
  }
  return false;
}
