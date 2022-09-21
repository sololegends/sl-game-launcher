/* global require */
const child = require("child_process");
const fs = require("fs");
const archiver = require("archiver");

// My stuffs
const FORMAT = "game-info";
// Const FORMAT = "inno-script";

function ensureEmptyDir(dir){
  if(fs.existsSync(dir)){
    fs.rmSync(dir, {recursive: true, force: true}, (err) =>{
      console.log(err);
    });
  }
  fs.mkdirSync(dir, {recursive: true});
}
function ensureDir(dir){
  if(!fs.existsSync(dir)){
    fs.mkdirSync(dir, {recursive: true});
  }
}
function removeDir(dir){
  console.log("removing dir:", dir);
  if(fs.existsSync(dir)){
    fs.rmSync(dir, {recursive: true, force: true}, (err) =>{
      console.log(err);
    });
    console.log("Removed dir: ", dir);
  }
}

function extractPathComponents(path){
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

async function unpackExe(target, game_data, format){
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

  const promise2 = new Promise((resolver) => {
    active_exe.on("close", () => {
      resolver();
    });
  });
  await promise2;
}

function getFileSize(file){
  const stat = fs.statSync(file);
  return stat.size;
}

function getFileList(root, current_folder){
  if(current_folder === undefined){
    current_folder = root;
  }
  let paths = [];
  const files = fs.readdirSync(current_folder);
  for(const file of files){
    const stat = fs.statSync(current_folder + "/" + file);
    if(stat.isDirectory()){
      paths = [ ...paths, ...getFileList(root, current_folder + "/" + file) ];
      continue;
    }
    paths.push(current_folder.replace(root + "/", "") + "/" + file);
  }
  return paths;
}

function getFolderSize(folder){
  if(folder.endsWith("\\") || folder.endsWith("/")){
    folder = folder.substring(0, folder.length - 1);
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

function parseInnoSetupFileLine(line){
  const sections_raw = line.split(";");
  // Process into the distinct sections
  const sections = {};
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

function innoSetupKeyVal(lines){
  const map = {};
  for(const line of lines){
    const parts = line.split("=");
    map[parts[0]] = parts[1];
  }
  return map;
}

async function readInsScript(inno_script, section = "UninstallDelete"){
  const sect = "[" + section + "]";
  // Read file and break apart by line
  const lines_buffer = fs.readFileSync(inno_script);
  if(lines_buffer === undefined){
    console.error("Failed to read inno_script file [" + inno_script + "]");
    return;
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

function readGameInfo(game_directory){
  const file_list = fs.readdirSync(game_directory);
  for(const file of file_list){
    if(file.endsWith(".info")){
      console.log("info file: " + game_directory + "/" + file);
      return JSON.parse(fs.readFileSync(game_directory + "/" + file));
    }
  }
}

async function uninstallFromFileList(folder, output_dir = ""){
  const game_id = readGameInfo(folder).gameId;

  // Get the full file list, relative path to the output
  const final_files = getFileList(folder);

  const fsw = fs.createWriteStream(output_dir + "/dlc-" + game_id + "-uninstall.json");
  fsw.write(JSON.stringify({files: final_files}, null, 2));
  fsw.close();
  return game_id;
}

async function dlcUninstallFromInnoScript(inno_script, output_dir = "", PREFIX = "Type: files; Name: \"{app}/"){
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
  const fsw = fs.createWriteStream(output_dir + "dlc-" + game_id + "-uninstall.json");
  fsw.write(JSON.stringify({files: final_files}, null, 2));
  fsw.close();
  return game_id;
}

async function compressFolder(input, zip_output, level = 9){
  const archive_op = archiver.create("zip", {
    zlib: { level }
  });
  console.debug("zip_output", zip_output);
  const zip_output_s = fs.createWriteStream(zip_output);

  const promise = new Promise((resolver) => {
    zip_output_s.on("close", () => {
      console.debug("Compression complete!");
      zip_output_s.close();
      resolver(zip_output);
    });
  });
  archive_op.pipe(zip_output_s);
  archive_op.directory(input, false, {store: false});
  return await archive_op.finalize().then(() => {
    return promise;
  });
}

async function processInnoInstallFiles(inno_script, unpacked_folder, output){
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

async function getDlcUninstall(props, format = "game-info"){
  if(format === "inno-script"){
    return await dlcUninstallFromInnoScript(props.inno_script, props.unpack_folder);
  }
  if(format === "game-info"){
    return await uninstallFromFileList(props.output_folder, props.pack_root);
  }
  return undefined;
}

async function processGameFiles(data, format = "game-info"){
  if(format === "game-info"){
    // Remove the tmp folder and commonappdata folders
    fs.rmSync(data.output_folder + "/tmp", {recursive: true});
    fs.rmSync(data.output_folder + "/commonappdata", {recursive: true});
    // Move the app contents to the main game folder
    // Get file list
    const files = getFileList(data.output_folder, data.output_folder + "/app");
    for(const file of files){
      // Ensure directory
      ensureDir(extractPathComponents(data.output_folder + "/" + file).dir);
      fs.copyFileSync(data.output_folder + "/" + file, file.replace("app", data.output_folder));
    }
    // Clean up the app dir
    fs.rmSync(data.output_folder + "/app", {recursive: true});
    if(data.is_dlc){
      if(fs.existsSync(data.output_folder + "/webcache.zip")){
        fs.rmSync(data.output_folder + "/webcache.zip");
      }
      if(fs.existsSync(data.output_folder + "/__redist/ISI/scriptinterpreter.exe")){
        fs.rmSync(data.output_folder + "/__redist/ISI/scriptinterpreter.exe");
      }
    }
    return;
  }
  if(format === "inno-script"){
    const {inno_script, unpacked_folder, output_folder} = data;
    await processInnoInstallFiles(inno_script, unpacked_folder, output_folder);
  }
}

async function getSlug(props, format = "game-info"){
  let slug = "error";
  if(format === "inno-script"){
    const setup = await readInsScript(props.inno_script, "Setup");
    const app_Data = innoSetupKeyVal(setup);
    slug = app_Data.AppName.toLowerCase();
  }else if (format === "game-info"){
    slug = readGameInfo(props.output_folder)?.name.toLowerCase();
  }
  slug = slug.replaceAll(/[^a-z0-9_]/g, "_");
  while(slug.includes("__")){
    slug = slug.replaceAll("__", "_");
  }
  return slug;
}

async function repackGame(game_exe, output_dir, options){
  const path = extractPathComponents(game_exe);
  // Unpack the game exe
  const unpack_folder = output_dir + "/game_exe_unpack_folder";
  const game_folder = output_dir + "/game_files";
  const inno_script = unpack_folder + "/install_script.iss";
  const props = {
    unpack_folder,
    output_folder: game_folder,
    inno_script
  };

  ensureEmptyDir(unpack_folder);
  ensureEmptyDir(game_folder);
  await unpackExe(path.full, props, FORMAT);
  // Process the file list
  await processGameFiles(props, FORMAT);
  // Get the install size metric
  const install_size = await getFolderSize(game_folder);
  // Compress game data
  const zip_name = path.file.replace("setup_", "").replace(".exe", ".zip");
  const zip_output = output_dir + "/" + zip_name;
  if(!options.nopack){
    await compressFolder(game_folder, zip_output);
  }
  const dl_size = await getFileSize(zip_output);
  const slug = await getSlug(props, FORMAT);

  // Clean up left overs
  if(!options.nocleanup){
    removeDir(unpack_folder);
    removeDir(game_folder);
  }

  return {
    logo: "logo.jpg",
    logo_format: "image/jpg",
    slug,
    dl_size,
    install_size,
    download: [
      zip_name
    ]
  };
}

async function repackDLC(dlc_exe, output_dir, options){
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
    await compressFolder(dlc_folder, zip_output);
  }
  const dl_size = await getFileSize(zip_output);

  // Make uninstall script
  const game_id = await getDlcUninstall(props, FORMAT);
  console.log("game_id: ", game_id);
  const uninstall_json = "dlc-" + game_id + "-uninstall.json";
  const slug = await getSlug(props, FORMAT);

  // Clean up left overs
  if(!options.nocleanup){
    removeDir(unpack_folder);
    removeDir(dlc_folder);
  }

  return {
    slug,
    gameId: game_id,
    dl_size,
    install_size,
    download: [
      zip_name
    ],
    uninstall: uninstall_json
  };
}

async function main(game_exe, dlc_folder, options_arr){
  const options = {};
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
  if(options.clear){
    console.log("Clearing exe/bin and DLC");
    // Removing DLC folder
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
    removeDir("game_repacked");
    return;
  }

  // Process the main game
  const game = game_exe === "NONE" ? {} : await repackGame(game_exe, "game_repacked", options);
  game.dlc = [];
  if(dlc_folder !== "NONE"){
    const dlc_files = fs.readdirSync(dlc_folder);
    console.log(dlc_files);
    for(const dlc_file of dlc_files){
      if(dlc_file.endsWith(".exe")){
        game.dlc.push(await repackDLC(dlc_folder + "/" + dlc_file, "game_repacked", options));
      }
    }
  }
  if(game_exe !== "NONE" || dlc_folder !== "NONE"){
    // Write game file
    fs.writeFileSync("game_repacked/game-data.json", JSON.stringify(game, null, 2));
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