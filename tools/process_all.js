/* global require */
const fs = require("fs");
const archiver = require("archiver");

// My stuffs
const {dlcUninstallFromInnoScript, readInsScript, unpackExe} = require("./dlc_from_exe");

const OUTPUT_DEFAULT = "all_output/";
const TEMP = "temp_install";
const EXE_FOLDER_DEFAULT = "exes";
const INS_SCRIPT = "install_script.iss";

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

async function main(exe_list, EXE_FOLDER = EXE_FOLDER_DEFAULT, OUTPUT = OUTPUT_DEFAULT){
  const json_output = [];
  // Loop!
  for(const exe of exe_list){
    const name = exe.replace("setup_", "").replace(".exe", ".zip");
    // Extract the installer
    if(fs.existsSync(TEMP)){
      fs.rmSync(TEMP, {recursive: true});
    }
    await unpackExe(EXE_FOLDER + "/" + exe, TEMP);
    const script = TEMP + "/" + INS_SCRIPT;
    const files = await readInsScript(script, "Files");
    // Loop through files supposed to be installed
    const output = OUTPUT + name.replace(".zip", "");
    const zip_output = OUTPUT + name;
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
      const target = output + data.Output;
      const folder = target.substring(0, target.lastIndexOf("/"));
      if(!fs.existsSync(folder)){
        fs.mkdirSync(folder, {recursive: true});
      }
      fs.copyFileSync(TEMP + "/" + data.Source, target);
    }
    // Generate the dlc uninstall data
    const game_id = await dlcUninstallFromInnoScript(script, OUTPUT);

    // Compress the dlc package
    const archive_op = archiver.create("zip", {
      zlib: {
        level: 9
      }
    });
    const zip_output_s = fs.createWriteStream(zip_output);
    archive_op.pipe(zip_output_s);
    archive_op.directory(output, false);
    await archive_op.finalize();
    zip_output_s.on("finish", () => {
      zip_output_s.close();
    });

    // Build the dlc insert frag
    const setup = await readInsScript(script, "Setup");
    const app_Data = innoSetupKeyVal(setup);
    let slug = app_Data.AppName.toLowerCase();
    slug = slug.replaceAll(/[^a-z0-9_]/g, "_");
    while(slug.includes("__")){
      slug = slug.replaceAll("__", "_");
    }
    const frag = {
      slug,
      gameId: game_id,
      download: [
        name
      ],
      uninstall: "dlc-" + game_id + "-uninstall.json"
    };
    json_output.push(frag);
    fs.writeFileSync(OUTPUT + slug + ".frag.json", JSON.stringify(frag, null, 2));
    // Cleanup
    fs.rmSync(output, {recursive: true});
    fs.rmSync(TEMP, {recursive: true});
  }
  return json_output;
}

/* global process */
// Const args = process.argv.slice(2);
// If(args.length > 0){
//   Main(fs.readdirSync(args[0]));
// }

/* global exports */
exports.main = main;
exports.process_dlc = main;
Object.defineProperty(exports, "__esModule", { value: true });