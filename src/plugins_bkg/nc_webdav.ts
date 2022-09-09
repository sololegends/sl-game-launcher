
import { createClient, WebDAVClient, WebDAVClientOptions } from "webdav";
import { getConfig } from "./config";
import { GOG } from "@/types/gog/game_info";


// Next cloud Web Dav connection
let nc_client = undefined as undefined | WebDAVClient;

export function webDavConfig(){
  return getConfig("webdav") as GOG.WebDavConfig;
}

export function mutateFolder(folder: string){
  const nc_cfg = webDavConfig();
  // Return  folder;
  return  "/files/" + nc_cfg.user + "/" + folder;
}

export async function initWebDav(options: WebDAVClientOptions = {}, force = false): Promise<WebDAVClient | undefined>{
  if(nc_client !== undefined && !force){
    return nc_client;
  }
  const web_dav_cfg = webDavConfig();
  nc_client = createClient(web_dav_cfg.url + "/remote.php/dav", {
    ...options,
    username: web_dav_cfg.user,
    password: web_dav_cfg.pass
  });
  const folder_found = await nc_client.exists(mutateFolder(web_dav_cfg.folder));
  if(!folder_found){
    return undefined;
  }
  return nc_client;
}

export default function init(){
  // Init
}