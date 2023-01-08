
import { createClient, WebDAVClient, WebDAVClientOptions } from "webdav";
import { DownloaderHelper } from "node-downloader-helper";
import { ensureDir } from "./tools/files";
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
  if(getConfig("offline") === true){
    return undefined;
  }
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

export type URLReturn = {
  url: string
  auth: string
}

export function handlePassURL(url: string): URLReturn{
  // Extract the credentials
  const at_idx = url.lastIndexOf("@");
  const proto_idx = url.indexOf(":") + 3;
  const proto = url.substring(0, proto_idx);
  const creds = url.substring(proto_idx, at_idx);
  const user = creds.substring(0, creds.indexOf(":"));
  const pass = encodeURIComponent(creds.substring(creds.indexOf(":") + 1));
  return {
    url: proto + url.substring(at_idx),
    auth: "Basic " + Buffer.from(user + ":" + pass).toString("base64")
  };
}

/**
 * NOTE: The download has to be started, and event bound BEFORE starting.
 * @param _dl_link - Link to the file to download
 * @param file_name - Name of the save file
 */
export function downloadFile(_dl_link: string, file_name: string): DownloaderHelper{
  const dl_link = handlePassURL(_dl_link);
  const gog_path = getConfig("gog_path");
  const tmp_download = gog_path + "\\.temp\\";
  ensureDir(tmp_download);

  return new DownloaderHelper(dl_link.url, tmp_download, {
    headers: {
      "Authorization": dl_link.auth
    },
    fileName: file_name,
    resumeIfFileExists: false,
    removeOnStop: true,
    removeOnFail: true,
    progressThrottle: 500
  });
}

export default function init(){
  // None
}