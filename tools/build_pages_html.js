
/* global require */
const fs = require("fs");
function betterBytes(bytes, format = "B", precision = 1, raw = false, unit_cap){
  if(typeof bytes == "string"){
    bytes = parseInt(bytes);
  }
  if(isNaN(bytes)){ return raw ? [ -1, -1 ] : [ "-", "-" ]; }
  let neg = false;
  if(bytes < 0){
    neg = true;
    bytes = bytes * -1;
  }
  let multiple = 1024;
  let i = 0;
  let units = [ "B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB" ];
  switch(format.replace("ps", "")){
  // Bits
  case "b":
    bytes = bytes * 8;
    multiple = 1000;
    units = [ "b", "Kb", "Mb", "Gb", "Tb", "Pb", "Eb", "Zb", "Yb" ];
    break;
  // I Bits
  case "ib":
    bytes = bytes * 8;
    units = [ "ib", "Kib", "Mib", "Gib", "Tib", "Pib", "Eib", "Zib", "Yib" ];
    break;
  // I Bites
  case "iB":
    units = [ "iB", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB" ];
    break;
  // Bytes
  case "B": default:
    multiple = 1000;
  }
  while (bytes >= multiple){
    bytes = bytes / multiple;
    i++;
    if(unit_cap !== undefined && units[i] === unit_cap){
      break;
    }
  }
  if(raw){
    return [ (neg ? "-" : "") + Math.max(bytes, 0).toFixed(precision), multiple ** (i) ];
  }
  return [ (neg ? "-" : "") + Math.max(bytes, 0).toFixed(precision), units[i] + (format.endsWith("ps") ? "/s" : "") ];
}

function formatSize(bytes, format = "B", precision = 1){
  const byte_data = betterBytes(bytes, format, precision);
  return byte_data[0] + " " + byte_data[1];
}

if(process.argv.length < 3){
  console.error("Failed to get folder to build ith..");
  return;
}
let dest = "index.html";
if(process.argv.length >= 4){
  dest = process.argv[3];
}

function buildRow(path){
  const stat = fs.statSync(path);
  return `<tr>
	<td><div class="icon ${stat.isDirectory() ? "dir" : "file"}"></div></td>
	<td><a href="${path}">${path}</a></td>
	<td>${new Date(stat.mtimeMs).toISOString().replace("T", " ")}</td>
	<td>${stat.isDirectory() ? " - " : formatSize(stat.size)}</td>
</tr>`;
}

/* global process */
const folder = process.argv[2];
const paths = fs.readdirSync(folder);
const folders = [];
const files = [];
let data = "";

console.log(paths);

// Build data sets
for(const path of paths){
  const stat = fs.statSync(path);
  if(stat.isDirectory()){
    folders.push(folder + "/" + path);
    continue;
  }
  files.push(folder + "/" + path);
}
// Generate the HTML using the template
for(const path of [ ...folders.sort(), ...files.sort() ]){
  data += buildRow(path);
}
// Load the template
const template = fs.readFileSync("templates/file_list.html").toString();

// Inject into the template
fs.writeFileSync(dest, template.replace("{#DATA}", data));