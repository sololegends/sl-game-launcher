
/* global require */
const fs = require("fs");
const child = require("child_process");

const PREFIX = "Type: files; Name: \"{app}/";
const INNOUNP = "bin/innounp.exe";
const INS_SCRIPT = "install_script.iss";
const INNO_OUT = "output";

async function unpackExe(target, output = INNO_OUT){
  if(fs.existsSync(INNO_OUT)){
    fs.rmSync(INNO_OUT, {recursive: true});
    fs.mkdirSync(INNO_OUT);
  }
  const active_exe = child.execFile(
    INNOUNP,
    [  "-d" + output, "-x", target ],
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

async function readInsScript(script, section = "UninstallDelete"){
  const sect = "[" + section + "]";
  // Read file and break apart by line
  const lines_buffer = fs.readFileSync(script);
  if(lines_buffer === undefined){
    console.error("Failed to read script file [" + script + "]");
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

async function dlcUninstallFromInnoScript(inno_script, output_dir = ""){
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

async function main(exe){
  await unpackExe(exe);
  console.log("DLC ID: " + await dlcUninstallFromInnoScript(INNO_OUT + "/" + INS_SCRIPT));
  // Cleanup
  fs.rmSync(INNO_OUT, {recursive: true});
}


/* global process */
const args = process.argv.slice(2);
if(args.length > 0){
  main(args[0]);
}


/* global exports */
exports.main = main;
exports.readInsScript = readInsScript;
exports.unpackExe = unpackExe;
exports.dlcUninstallFromInnoScript = dlcUninstallFromInnoScript;
Object.defineProperty(exports, "__esModule", { value: true });