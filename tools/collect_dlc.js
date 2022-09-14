
/* global require */
const archiver = require("archiver");
const fs = require("fs");

async function main(json_file, root){

  if(!fs.existsSync(json_file)){
    console.error("Failed to find json file [" + json_file + "]");
    return;
  }
  const json_buffer = fs.readFileSync(json_file);
  if(json_buffer === undefined){
    console.error("Failed to read json file [" + json_file + "]");
    return;
  }
  const json = JSON.parse(json_buffer.toString()).files;
  const target = "dlc_collect/";
  if(fs.existsSync(target)){
    fs.rmSync(target, {recursive: true});
  }
  fs.mkdirSync(target);

  // Collect the files
  for(const file of json){
    console.log("Copying file: " + file);
    const folder = target + file.substring(0, file.lastIndexOf("/"));
    if(!fs.existsSync(folder)){
      fs.mkdirSync(folder, {recursive: true});
    }
    fs.copyFileSync(root + file, target + file);
  }

  // Archive it
  const archive_op = archiver.create("zip", {
    zlib: {
      level: 9
    }
  });
  const output = fs.createWriteStream("dlc.zip");
  archive_op.pipe(output);
  archive_op.directory(target, false);
  await archive_op.finalize();
  output.on("finish", () => {
    output.close();
  });

  // Cleanup
  fs.rmSync(target, {recursive: true});
}

/* global process */
const args = process.argv.slice(2);
if(args.length > 1){
  main(args[0], args[1]);
}


/* global exports */
exports.main = main;
Object.defineProperty(exports, "__esModule", { value: true });