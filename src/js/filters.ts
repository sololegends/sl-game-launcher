const ucase_exemption = [
  "is", "in", "if", "up", "to", "of"
];

function betterBytes(bytes: number, format = "B", precision = 1, raw = false, unit_cap: string | undefined = undefined){
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

export default {
  flattenName(name: string): string{
    return name.trim().toLowerCase().replace(/[^-a-z0-9_]/gm, "_");
  },
  procNone: function(value: string | null, key?: string){
    if(value == null || value === "null"){
      if(key && [ "last_accessed", "last_downloaded", "created", "updated" ].includes(key)){
        return "never";
      }return "none";
    }return value;
  },

  formatSize: (bytes: number, format = "B", precision = 1) => {
    const byte_data = betterBytes(bytes, format, precision);
    return byte_data[0] + " " + byte_data[1];
  },

  betterBytes: (bytes: number, format = "B", precision = 1, unit_cap?: string) => {
    return betterBytes(bytes, format, precision, true, unit_cap);
  },

  shrinkNumber: (number: number, precision = 2) => {
    if(typeof number == "string"){
      number = parseInt(number);
    }
    if(isNaN(number)){ return "-"; }
    let neg = false;
    if(number < 0){
      neg = true;
      number = number * -1;
    }else if(number < 1000){
      return number;
    }
    let i = -1;
    const units = [ "k", "m", "b", "t", "q" ];
    do {
      number = number / 1000;
      i++;
    } while (number > 1000);
    return (neg ? "-" : "") + Math.max(number, 0.1).toFixed(precision) + " " + units[i];
  },

  betterSeconds: (seconds: number) =>{
    if(typeof seconds == "string"){
      seconds = parseInt(seconds);
    }
    if(isNaN(seconds)){ return "-"; }
    if(seconds > 86400){
      return (seconds / 86400).toFixed(1) + "d";
    }else if(seconds > 3600){
      return (seconds / 3600).toFixed(1) + "h";
    }else if(seconds > 60){
      return (seconds / 60).toFixed(1) + "m";
    }
    return seconds.toFixed(0) + "s";
  },

  betterMilliseconds: (milliseconds: number)=>{
    if(typeof milliseconds == "string"){
      milliseconds = parseInt(milliseconds);
    }
    if(isNaN(milliseconds)){ return "-"; }
    if(milliseconds > 86400000){
      return (milliseconds / 86400).toFixed(1) + "d";
    }
    if(milliseconds > 3600000){
      return (milliseconds / 3600).toFixed(1) + "h";
    }
    if(milliseconds > 60000){
      return (milliseconds / 60).toFixed(1) + "m";
    }
    if(milliseconds > 1000){
      return milliseconds.toFixed(1) + "s";
    }
    return milliseconds + "ms";
  },

  epochToTimestamp: (val: number | string) => {
    function pad0(val: number){
      return val < 10 ? "0" + val : val;
    }

    if(typeof val == "string"){
      val = parseInt(val);
    }
    if(isNaN(val)){ return "-"; }
    if(val === -1){
      return "never";
    }
    const date = new Date(val);
    return date.getFullYear() + "-" + pad0(date.getMonth() + 1) + "-" + pad0(date.getDate())
        + " " + pad0(date.getHours()) + ":" + pad0(date.getMinutes());
  },

  procKey: (value: string | number | null) => {
    if (value != null && typeof value === "number"){ return value; }
    if (value == null || !(typeof value === "string")){ return ""; }
    value.replaceAll(" - ", " > ");
    const parts = value.split(/[-_]/);
    value = "";
    for(const i in parts){
      parts[i] = parts[i].replaceAll(">", "-");
      if(!ucase_exemption.includes(parts[i].toLowerCase())
        && (parts[i].length < 3 || parts[i].toUpperCase() === "API" || parts[i].toUpperCase() === "AWRAP")){
        value += parts[i].toUpperCase() + " ";
        continue;
      }
      value += parts[i].charAt(0).toUpperCase() + parts[i].slice(1) + " ";
    }

    return value.trim();
  },

  json: (value: Record<string, unknown>, field_filter: Array<string> = []): Record<string, unknown> => {
    const res = {} as typeof value;
    for(const key in value){
      if(!field_filter.includes(key)){
        res[key] = value[key];
      }
    }
    return res;
  },

  shrinkString: (value: string) => {
    if(value.length < 25){
      return value;
    }
    return value.substr(0, 22) + "...";
  },

  retainSpacesHtml: (value: string) => {
    if(value !== undefined && value !== null){
      return value.replace(/ /g, "\xA0");
    }
    return null;
  },
  capitalize: (low_case_string: string): string => {
    if(!low_case_string){
      return "";
    }
    return low_case_string[0].toUpperCase() + low_case_string.slice(1);
  }
};
