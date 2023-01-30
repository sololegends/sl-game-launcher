
import {parsePE, PE_Metadata} from "pe-exe-parser";
import archiver from "archiver";
import child from "child_process";
import fs from "fs";
import {getRemoteGamesList} from "../src/plugins_bkg/game_loader_fns";
import {GOG} from "../src/types/gog/game_info";
import initConfig from "../src/plugins_bkg/config";
import zip from "node-stream-zip";

// TYPES
type ZipLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

type CLIOptions = {
  output?: string
  clear?: boolean
  nopack?: boolean
  merge_data?: boolean
  merge_info?: boolean
  zip_level?: ZipLevel

  [key: string]: string | boolean | ZipLevel | undefined
}
type PathComponents = {
  dir: string
  file: string
  full: string
}
type PackProperties = {
  unpack_folder: string
  output_folder: string
  pack_root: string
  inno_script: string
  version?: string
  iter_id?: number
  is_dlc?: boolean
}
type RunFormat= "game-info" | "inno-script"
type InnoSections = {
  Source: string
  DestDir: string
  Output: string
  [key: string]: string
}
interface UninstallData{
  game_id?: string
  file_name: string
  content?: GOG.DLCUninstall
}
interface UninstallDataAll extends UninstallData{
  game_id: string
  file_name: string
  content: GOG.DLCUninstall
}
// END TYPES


// My stuffs
const FORMAT = "game-info";
// Const FORMAT = "inno-script";

function ensureEmptyDir(dir: string){
  if(fs.existsSync(dir)){
    fs.rmSync(dir, {recursive: true, force: true});
  }
  fs.mkdirSync(dir, {recursive: true});
}
function ensureDir(dir: string){
  if(!fs.existsSync(dir)){
    fs.mkdirSync(dir, {recursive: true});
  }
}
function removeDir(dir: string){
  console.log("removing dir:", dir);
  if(fs.existsSync(dir)){
    fs.rmSync(dir, {recursive: true, force: true});
    console.log("Removed dir: ", dir);
  }
}

function extractPathComponents(path: string): PathComponents{
  // Normalize the path
  path = path.replace("\\", "/");
  if(path.includes("/")){
    // Extract folder from file
    return {
      dir: path.substring(0, path.lastIndexOf("/")),
      file: path.substring(path.lastIndexOf("/") + 1),
      full: path
    };
  }
  return {
    dir: "",
    file: path,
    full: path
  };
}

async function getGameRemoteData(): Promise<GOG.GameInfo[]>{
  if(fs.existsSync("remotes.json")){
    const stats = fs.statSync("remotes.json") as fs.Stats;
    if(stats.mtimeMs > new Date().getTime() - 86400000){
      return JSON.parse(fs.readFileSync("remotes.json").toString("utf8"));
    }
  }
  const remotes = await getRemoteGamesList(false, false);
  fs.writeFileSync("remotes.json", JSON.stringify(remotes, null, 2));
  return remotes;
}

async function extractInstallerScript(target: string, game_data: PackProperties): Promise<void>{
  const bin = "bin/innounp.exe";
  const args = [ "-v", "-d" + game_data.unpack_folder, "-x", target, "install_script.iss" ];
  console.log("Extracting installer script");
  const active_exe = child.execFile(
    bin,
    args,
    function(err, data){
      if(err){
        console.error(err);
        return;
      }
      console.log(data.toString());
    });

  return new Promise<void>((resolver) => {
    active_exe.on("close", () => {
      resolver();
    });
  });
}

async function unpackExe(target: string, game_data: PackProperties, format: RunFormat): Promise<void>{
  let bin = "bin/innounp.exe";
  let args = [ "-v", "-a",  "-d" + game_data.unpack_folder, "-e", target ];
  if(format === "game-info"){
    bin = "bin/innoextract.exe";
    args = [ "-s", "-g", "-d", game_data.output_folder, target ];
  }
  console.log("Extracting installer files");
  const active_exe = child.execFile(
    bin,
    args,
    function(err, data){
      if(err){
        console.error(err);
        return;
      }
      console.log(data.toString());
    });

  const promise2 = new Promise<void>((resolver) => {
    active_exe.on("close", () => {
      resolver();
    });
  });
  await promise2;
}

function getFileSize(file: string): number{
  const stat = fs.statSync(file);
  return stat.size;
}

function getFileList(root: string, current_folder?: string): string[]{
  if(current_folder === undefined){
    current_folder = root;
  }
  let paths = [] as string[];
  const files = fs.readdirSync(current_folder);
  for(const file of files){
    const stat = fs.statSync(current_folder + "/" + file);
    if(stat.isDirectory()){
      paths = [ ...paths, ...getFileList(root, current_folder + "/" + file) ];
      continue;
    }
    if(current_folder === root){
      paths.push(file);
      continue;
    }
    paths.push(current_folder.replace(root + "/", "") + "/" + file);
  }
  return paths;
}

function getFolderSize(folder: string): number{
  if(folder.endsWith("\\") || folder.endsWith("/")){
    folder = folder.substring(0, folder.length - 1);
  }
  if(!fs.existsSync(folder)){
    return 0;
  }
  const dir_stat = fs.statSync(folder);
  let accumulator = 0;
  if(dir_stat.isDirectory()){
    const files = fs.readdirSync(folder);
    for(const i in files){
      accumulator += getFolderSize(folder + "/" + files[i]);
    }
    return accumulator;
  }
  return dir_stat.size;
}

function parseInnoSetupFileLine(line: string){
  const sections_raw = line.split(";");
  // Process into the distinct sections
  const sections = {} as InnoSections;
  for(const sect of sections_raw){
    if(sect.trim() === ""){
      continue;
    }
    const parts = sect.split(":");
    sections[parts[0].trim()] = parts[1].trim();
  }
  sections.Source = sections.Source.replaceAll("\"", "");
  sections.DestDir = sections.DestDir.replaceAll("\"", "");
  if(sections.BeforeInstall){
    sections.Output = sections.BeforeInstall.split("', '")[1];
    sections.Output = sections.Output.split("', ")[0];
    sections.Output = sections.Output.replaceAll("\\", "/");
  }else{
    console.debug("No BeforeInstall: ", line);
  }
  return sections;
}

function innoSetupKeyVal(lines: string[]): Record<string, string>{
  const map = {} as Record<string, string>;
  for(const line of lines){
    const parts = line.split("=");
    map[parts[0]] = parts[1];
  }
  return map;
}

async function readInsScript(inno_script: string, section = "UninstallDelete"): Promise<string[]>{
  const sect = "[" + section + "]";
  // Read file and break apart by line
  const lines_buffer = fs.readFileSync(inno_script);
  if(lines_buffer === undefined){
    console.error("Failed to read inno_script file [" + inno_script + "]");
    return [];
  }
  const lines = lines_buffer.toString().split(/[\n\r]+/g);
  let collect = false;
  const collection = [];
  for(const line of lines){
    if(collect){
      if(line.startsWith("[")){
        break;
      }
      collection.push(line);
      continue;
    }
    if(line === sect){
      collect = true;
    }
  }
  return collection;
}

function readGameInfo(game_directory: string): GOG.GameInfo | undefined{
  const file_list = fs.readdirSync(game_directory);
  for(const file of file_list){
    if(file.endsWith(".info")){
      console.log("info file: " + game_directory + "/" + file);
      return JSON.parse(fs.readFileSync(game_directory + "/" + file).toString()) as GOG.GameInfo;
    }
  }
  return undefined;
}

async function uninstallFromFileList(folder: string, output_dir = "", note = ""): Promise<UninstallData>{
  const game_id = readGameInfo(folder)?.gameId;

  // Get the full file list, relative path to the output
  const final_files = getFileList(folder);

  const file_name = "dlc-" + game_id + "-" + note + "-uninstall.json";
  // If there are fewer than 5 files, just return the object itself
  if(final_files.length < 5){
    return {
      game_id,
      file_name,
      content: {files: final_files} as GOG.DLCUninstall
    };
  }
  const fsw = fs.createWriteStream(output_dir + "/" + file_name);
  fsw.write(JSON.stringify({files: final_files}, null, 2));
  fsw.close();
  return {
    game_id,
    file_name
  };
}

async function redistFromInnoScript(inno_script: string, game_folder: string): Promise<GOG.GameRedist[]>{
  const FILENAME = "Filename: \"{app}/";
  const PARAMS = "Parameters: \"";
  const redists = await readInsScript(inno_script, "Run");
  const final_redist = [];
  for(const redist of redists){
    if(redist.startsWith(FILENAME)){
      const fn_split = redist.split(FILENAME);
      if(fn_split.length < 2){
        continue;
      }
      const exe = fn_split[1].split("\";")[0].replaceAll("\\", "/").trim();
      const param_split = redist.split(PARAMS);
      if(param_split.length < 2){
        continue;
      }
      const params = param_split[1].split("\";")[0].replaceAll("\\", "/").trim().split(" ");
      // Get the file versions
      let exe_data = {} as PE_Metadata;
      try{
        exe_data = await (await parsePE(game_folder + "/" + exe)).metadata();
      }catch(e){
        // Nothing here
      }
      final_redist.push({
        name: exe_data?.ProductName,
        version: exe_data?.ProductVersion,
        exe_path: exe,
        arguments: params
      });
    }
  }
  return final_redist;
}

async function dlcUninstallFromInnoScript(
  inno_script: string, output_dir = "", note = "", PREFIX = "Type: files; Name: \"{app}/"
): Promise<UninstallData>{
  const files = await readInsScript(inno_script);
  const final_files = [];
  let game_id = "nnnnnnnnnnnn";
  for(const file of files){
    if(file.startsWith(PREFIX)){
      const f = file.replace(PREFIX, "").replace("\";", "").replaceAll("\\", "/").trim();
      final_files.push(f);
      if(f.endsWith(".hashdb")){
        final_files.push(f.replace(".hashdb", ".ico"));
        game_id = f.replace(".hashdb", "").replace("goggame-", "");
      }
    }
  }
  const file_name = "dlc-" + game_id + "-" + note + "-uninstall.json";
  const fsw = fs.createWriteStream(output_dir + "/" + file_name);
  fsw.write(JSON.stringify({files: final_files}, null, 2));
  fsw.close();
  return {
    game_id,
    file_name
  };
}

async function compressFolder(input: string, zip_output: string, level = 9 as ZipLevel): Promise<string>{
  const archive_op = archiver.create("zip", {
    zlib: { level }
  });
  console.debug("zip_output", zip_output);
  const zip_output_s = fs.createWriteStream(zip_output);

  const promise = new Promise<string>((resolver) => {
    zip_output_s.on("close", () => {
      console.debug("Compression complete!");
      zip_output_s.close();
      resolver(zip_output);
    });
  });
  archive_op.pipe(zip_output_s);
  archive_op.directory(input, false);
  return await archive_op.finalize().then(() => {
    return promise;
  });
}

async function processInnoInstallFiles(inno_script: string, unpacked_folder: string, output: string): Promise<number>{
  const files = await readInsScript(inno_script, "Files");
  console.debug("files.length", files.length);
  let aggrigate = 0;
  for(const file of files){
    // Skip installer temp files
    if(file.includes("deleteafterinstall") || file.includes("scriptinterpreter.exe") || file.includes("commonappdata")){
      continue;
    }
    const data = parseInnoSetupFileLine(file);
    if(data.Output === undefined){
      continue;
    }
    // Copy that file from extracted data to temp output dir
    fs.mkdirSync(output, {recursive: true});
    const target = output + "/" + data.Output;
    const folder = target.substring(0, target.lastIndexOf("/"));
    if(!fs.existsSync(folder)){
      fs.mkdirSync(folder, {recursive: true});
    }
    aggrigate += fs.statSync(unpacked_folder + "/" + data.Source).size;
    fs.copyFileSync(unpacked_folder + "/" + data.Source, target);
  }
  console.debug("aggrigate size: ", aggrigate);
  return aggrigate;
}

async function getDlcUninstall(props: PackProperties, note: string, format = "game-info" as RunFormat): Promise<undefined | UninstallData>{
  if(format === "inno-script"){
    return await dlcUninstallFromInnoScript(props.inno_script, props.unpack_folder, note);
  }
  if(format === "game-info"){
    return await uninstallFromFileList(props.output_folder, props.pack_root, note);
  }
  return undefined;
}

async function processGameFiles(data: PackProperties, format = "game-info"){
  if(format === "game-info"){
    // Remove the tmp folder and commonappdata folders
    if(fs.existsSync(data.output_folder + "/tmp")){
      fs.rmSync(data.output_folder + "/tmp", {recursive: true});
    }
    if(fs.existsSync(data.output_folder + "/commonappdata")){
      fs.rmSync(data.output_folder + "/commonappdata", {recursive: true});
    }
    // Move the app contents to the main game folder
    // Get file list
    const files = getFileList(data.output_folder, data.output_folder + "/app");
    for(const file of files){
      // Ensure directory
      ensureDir(extractPathComponents(file.replace("app", data.output_folder)).dir);
      fs.copyFileSync(data.output_folder + "/" + file, file.replace("app", data.output_folder));
    }
    // Clean up the app dir
    fs.rmSync(data.output_folder + "/app", {recursive: true});
    if(fs.existsSync(data.output_folder + "/__redist/ISI")){
      fs.rmSync(data.output_folder + "/__redist/ISI", {recursive: true});
    }
    if(data.is_dlc){
      if(fs.existsSync(data.output_folder + "/webcache.zip")){
        fs.rmSync(data.output_folder + "/webcache.zip");
      }
    }else if(fs.existsSync(data.output_folder + "/webcache.zip")){
      const webcache = new zip.async({file: data.output_folder + "/webcache.zip"});
      const resources = await webcache.entryData("resources.json");
      const resource = JSON.parse(resources.toString());
      let image = resource["images\\logo2x"];
      if(image === undefined){
        image = resource["images\\logo"];
      }
      if(image){
        const img_data = await webcache.entryData(image);
        const ext = image.substr(image.lastIndexOf(".") + 1);
        fs.writeFileSync(data.output_folder + "/logo." + ext, img_data);
        fs.writeFileSync(data.pack_root + "/logo." + ext, img_data);
        await webcache.close();
      }
    }
    return;
  }
  if(format === "inno-script"){
    const {inno_script, unpack_folder, output_folder} = data;
    await processInnoInstallFiles(inno_script, unpack_folder, output_folder);
  }
}

async function getSlug(props: PackProperties, format = "game-info" as RunFormat): Promise<string>{
  let slug = "error" as string | undefined;
  if(format === "inno-script"){
    const setup = await readInsScript(props.inno_script, "Setup");
    const app_Data = innoSetupKeyVal(setup);
    slug = app_Data.AppName.toLowerCase();
  }else if (format === "game-info"){
    slug = readGameInfo(props.output_folder)?.name.toLowerCase();
  }
  if(slug === undefined){
    return "unknown_slug";
  }
  slug = slug.replaceAll(/[^-a-z0-9_]/g, "_");
  while(slug.includes("__")){
    slug = slug.replaceAll("__", "_");
  }while(slug.endsWith("_")){
    slug = slug.substring(0, slug.length - 1);
  }
  return slug;
}

async function getVersion(game_exe: string, props: PackProperties, format = "game-info" as RunFormat){
  if(props.version && props.iter_id){
    return {
      version: props.version,
      iter_id: props.iter_id
    };
  }
  const slug = await getSlug(props, format);
  console.log(game_exe, slug, props);
  const regex = new RegExp("setup_(" + slug + ")_(.*?)_(\\((64|32)bit\\)_){0,1}\\(([0-9]+)\\).exe", "g");
  let m;
  let version = undefined;
  let iter_id = undefined;
  while ((m = regex.exec(game_exe)) !== null){
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex){
      regex.lastIndex++;
    }

    // The result can be accessed through the `m`-variable.
    m.forEach((match, groupIndex) => {
      if(groupIndex === 2){
        version = match;
      }
      if(groupIndex === 5){
        iter_id = match;
      }
      console.log(`Found match, group ${groupIndex}: ${match}`);
    });
  }
  return {
    version,
    iter_id: iter_id ? parseInt(iter_id) : iter_id
  };
}

async function mergeGameInfo(new_info: GOG.RemoteGameData): Promise<GOG.RemoteGameData>{
  await initConfig();
  // Try and find the remote data
  const remotes = await getGameRemoteData();
  let old_info = undefined;
  // Find the game
  for(const game of remotes){
    if(game.remote && game.remote.slug === new_info.slug){
      old_info = game.remote;
      delete old_info.folder;
    }
  }
  if(old_info === undefined){
    console.log("Failed to find remote match for ", new_info);
    fs.writeFileSync("new_info." + new_info.slug + ".json", JSON.stringify(new_info, null, 2));
    return new_info;
  }
  // Load old game info
  // Check if it exists
  if(fs.existsSync("game-data.json")){
    // Load the old info file instead
    old_info = JSON.parse(fs.readFileSync("game-data.json").toString());
  }
  console.log("Old data loaded for merge...");
  // Add version block if not present
  if(old_info.versions === undefined){
    old_info.versions = {};
  }
  // Make new version block
  const version_block = {
    dl_size: old_info.dl_size,
    install_size: old_info.install_size,
    version: old_info.version,
    iter_id: old_info.iter_id,
    download: old_info.download,
    dlc: old_info.dlc,
    redist: old_info.redist
  };
  // Ad the version block to the old info
  old_info.versions[old_info.version] = version_block;
  // Inject the new data
  old_info.dl_size = new_info.dl_size;
  old_info.install_size = new_info.install_size;
  old_info.version = new_info.version;
  old_info.iter_id = new_info.iter_id;
  old_info.download = new_info.download;
  old_info.dlc = new_info.dlc;
  old_info.redist = new_info.redist;
  console.log("Data merged!", old_info);
  return old_info;
}

async function repackGame(game_exe: string, output_dir: string, options: CLIOptions): Promise<GOG.RemoteGameData>{
  const path = extractPathComponents(game_exe);
  // Unpack the game exe
  const unpack_folder = output_dir + "/game_exe_unpack_folder";
  const game_folder = output_dir + "/game_files";
  const inno_script = unpack_folder + "/install_script.iss";
  const props = {
    unpack_folder,
    output_folder: game_folder,
    pack_root: output_dir,
    inno_script
  };

  // Make the repack dir empty
  fs.rmSync(output_dir, {recursive: true});

  ensureEmptyDir(unpack_folder);
  ensureEmptyDir(game_folder);
  await unpackExe(path.full, props, FORMAT);
  if(FORMAT === "game-info"){
    await extractInstallerScript(game_exe, props);
  }
  // Process the file list
  await processGameFiles(props, FORMAT);
  // Build the redist block
  // Check for install script and the redist within
  let redist = [] as GOG.GameRedist[];
  if(fs.existsSync(props.unpack_folder + "/install_script.iss")){
    redist = await redistFromInnoScript(props.unpack_folder + "/install_script.iss", game_folder);
  }
  // Get the install size metric
  const install_size = await getFolderSize(game_folder);
  // Compress game data
  const zip_name = path.file.replace("setup_", "").replace(".exe", ".zip");
  const zip_output = output_dir + "/" + zip_name;
  if(!options.nopack){
    await compressFolder(game_folder, zip_output, options.zip_level);
  }
  const dl_size = await getFileSize(zip_output);
  const slug = await getSlug(props, FORMAT);
  const version_data = await getVersion(game_exe, props, FORMAT);
  // Clean up left overs
  if(!options.nocleanup){
    removeDir(unpack_folder);
    removeDir(game_folder);
  }

  return {
    logo: "logo.jpg",
    logo_format: "image/jpg",
    version: version_data.version,
    iter_id: version_data.iter_id,
    slug,
    dl_size,
    install_size,
    download: [
      zip_name
    ],
    dlc: [],
    redist
  };
}

async function repackDLC(dlc_exe: string, output_dir: string, options: CLIOptions): Promise<GOG.RemoteGameDLCBuilding>{
  const path = extractPathComponents(dlc_exe);
  // Unpack the game exe
  const unpack_folder = output_dir + "/dlc_exe_unpack_folder";
  const inno_script = unpack_folder + "/install_script.iss";
  const dlc_folder = output_dir + "/dlc_files";
  const props = {
    unpack_folder,
    output_folder: dlc_folder,
    inno_script,
    pack_root: output_dir,
    is_dlc: true
  };
  ensureEmptyDir(unpack_folder);
  ensureEmptyDir(dlc_folder);
  await unpackExe(path.full, props, FORMAT);
  // Process the file list
  await processGameFiles(props, FORMAT);
  // Get the install size metric
  const install_size = await getFolderSize(dlc_folder);
  // Compress game data
  const zip_name = path.file.replace("setup_", "").replace(".exe", ".zip");
  const zip_output = output_dir + "/" + zip_name;
  if(!options.nopack){
    await compressFolder(dlc_folder, zip_output, options.zip_level);
  }
  const dl_size = await getFileSize(zip_output);

  // Make uninstall script
  const version_data = await getVersion(dlc_exe, props, FORMAT);
  const {game_id, file_name, content} = await getDlcUninstall(props, version_data.iter_id + "", FORMAT) as UninstallDataAll;
  console.log("game_id: ", game_id);
  const uninstall_json = content ? content : file_name;
  const slug = await getSlug(props, FORMAT);

  // Clean up left overs
  if(!options.nocleanup){
    removeDir(unpack_folder);
    removeDir(dlc_folder);
  }

  return {
    slug,
    gameId: game_id,
    version: version_data.version,
    iter_id: version_data.iter_id,
    dl_size,
    install_size,
    download: [
      zip_name
    ],
    uninstall: uninstall_json
  };
}

async function main(game_exe: string, dlc_folder: string, options_arr: string[]){
  const options = {
    zip_level: 8
  } as CLIOptions;
  if(options_arr){
    for(const part of options_arr){
      const key_val = part.split("=");
      if(key_val.length === 1){
        options[key_val[0]] = true;
        continue;
      }
      options[key_val[0]] = key_val[1];
    }
  }
  if(options){
    console.debug(options);
  }
  const output_dir = options.output || "game_repacked";
  if(options.clear){
    console.log("Clearing exe/bin and DLC");
    // Removing DLC folder
    if(dlc_folder !== "NONE"){
      if(dlc_folder === "default"){
        dlc_folder = "proc/dlc";
      }
      const dlcs = fs.readdirSync(dlc_folder);
      for(const dlc of dlcs){
        console.log(dlc);
        if(!dlc.endsWith(".exe") && !dlc.endsWith(".bin")){
          continue;
        }
        console.log("Removing: ", dlc_folder + "/" + dlc);
        fs.rmSync(dlc_folder + "/" + dlc);
      }
    }
    if(game_exe !== "NONE"){
      console.log("Removing exe/bin");
      const pathing = extractPathComponents(game_exe);
      const start = pathing.file.replace(".exe", "");
      const files = fs.readdirSync(pathing.dir);
      for(const file of files){
        if(file.startsWith(start)){
          console.log(pathing.dir + "/" + file);
          fs.rmSync(pathing.dir + "/" + file);
        }
      }
    }
    console.log("Removing packaging folder");
    removeDir(output_dir);
    return;
  }

  // Process the main game
  let game = game_exe === "NONE" ? {} as GOG.RemoteGameData : await repackGame(game_exe, output_dir, options);
  const dlc = [] as GOG.RemoteGameDLCBuilding[];
  if(dlc_folder !== "NONE"){
    const dlc_files = fs.readdirSync(dlc_folder);
    console.log(dlc_files);
    for(const dlc_file of dlc_files){
      if(dlc_file.endsWith(".exe")){
        dlc.push(await repackDLC(dlc_folder + "/" + dlc_file, output_dir, options));
      }
    }
    if(dlc.length > 0){
      game.dlc = dlc as GOG.RemoteGameDLC[];
    }
  }
  // Do we merge data
  if(options.merge_data || options.merge_info){
    game = await mergeGameInfo(game);
  }
  if(game_exe !== "NONE" || dlc_folder !== "NONE"){
    // Write game file
    fs.writeFileSync(output_dir + "/game-data.json", JSON.stringify(game, null, 2));
  }else {
    console.log("No actions taken");
  }
}
/* global process */
const args = process.argv.slice(2);
main(args[0], args.length >= 2 ? args[1] : "proc/dlc", args.slice(2));

/* global exports */
exports.main = main;
Object.defineProperty(exports, "__esModule", { value: true });