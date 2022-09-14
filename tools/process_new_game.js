/* global require */
const fs = require("fs");
const archiver = require("archiver");

// My stuffs
const {readInsScript, unpackExe} = require("./dlc_from_exe");
const {process_dlc} = require("./process_all");

const OUTPUT = "all_output";
const TEMP = "temp_install";
const EXE_FOLDER = "new_game";
const INS_SCRIPT = "install_script.iss";

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

async function getGameId(inno_script){
  const PREFIX = "Type: files; Name: \"{app}/";
  const files = await readInsScript(inno_script);
  let game_id = "nnnnnnnnnnnn";
  for(const file of files){
    if(file.startsWith(PREFIX)){
      const f = file.replace(PREFIX, "").replace("\";", "").replaceAll("\\", "/").trim();
      if(f.endsWith(".hashdb")){
        game_id = f.replace(".hashdb", "").replace("goggame-", "");
      }
    }
  }
  return game_id;
}

async function main(exe){
  exe = exe.replace(EXE_FOLDER + "/", "");
  // Get the exe list
  const exe_list = fs.readdirSync(EXE_FOLDER);
  exe_list.splice(exe_list.indexOf(exe), 1);
  console.log(exe_list);
  const name = exe.replace("setup_", "").replace(".exe", ".zip");
  // Extract the installer
  if(fs.existsSync(TEMP)){
    fs.rmSync(TEMP, {recursive: true});
    fs.mkdirSync(TEMP, {recursive: true});
  }
  await unpackExe(EXE_FOLDER + "/" + exe, TEMP);
  const script = TEMP + "/" + INS_SCRIPT;
  const files = await readInsScript(script, "Files");
  // Loop through files supposed to be installed
  const output = OUTPUT + "/" + name.replace(".zip", "");
  const zip_output = OUTPUT + "/" + name;
  if(fs.existsSync(output)){
    fs.rmSync(output, {recursive: true});
  }
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
    fs.copyFileSync(TEMP + "/" + data.Source, target);
  }
  // Generate the dlc uninstall data
  const game_id = await getGameId(script);

  // Compress the dlc package
  const archive_op = archiver.create("zip", {
    zlib: {
      level: 9
    }
  });
  const install_size = getFolderSize(output);
  const zip_output_s = fs.createWriteStream(zip_output);
  archive_op.pipe(zip_output_s);
  archive_op.directory(output, false);
  await archive_op.finalize();
  zip_output_s.on("finish", () => {
    zip_output_s.close();
  });

  // Build the game remote data
  const setup = await readInsScript(script, "Setup");
  const app_Data = innoSetupKeyVal(setup);
  let slug = app_Data.AppName.toLowerCase();
  slug = slug.replaceAll(/[^a-z0-9_]/g, "_");
  while(slug.includes("__")){
    slug = slug.replaceAll("__", "_");
  }
  const stat = fs.statSync(zip_output);
  // Process the DLC
  const dlc = await process_dlc(exe_list, EXE_FOLDER);

  const frag = {
    logo: "logo.jpg",
    logo_format: "image/jpg",
    dl_size: stat.size,
    install_size,
    slug,
    gameId: game_id,
    download: [
      name
    ],
    dlc
  };
  fs.writeFileSync(OUTPUT + "/game-data.json", JSON.stringify(frag, null, 2));
  // Cleanup
  if(fs.existsSync(output)){
    fs.rmSync(output, {recursive: true});
  }
  if(fs.existsSync(TEMP)){
    fs.rmSync(TEMP, {recursive: true});
  }
}

/* global process */
const args = process.argv.slice(2);
main(args[0]);

/* global exports */
exports.main = main;
Object.defineProperty(exports, "__esModule", { value: true });