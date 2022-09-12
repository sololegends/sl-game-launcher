"use strict";

const colors = {
  hexToRGB: function(hex_color){
    const hex_color_validation = /^[#]?[0-9A-F]{3}$|^[#]?[0-9A-F]{6}$/gi;
    if(hex_color_validation.test(hex_color)){
      hex_color = hex_color.replace("#", "");
      // Pad out the hex to a full 6 char code
      if(hex_color.length === 3){
        let tmp = "";
        for(let i = 0; i < hex_color.length; i++){
          tmp += hex_color[i] + hex_color[i];
        }
        hex_color = tmp;
      }
      // Split into parts
      const r = colors.hexToInt(hex_color.substr(0, 2));
      const g = colors.hexToInt(hex_color.substr(2, 2));
      const b = colors.hexToInt(hex_color.substr(4, 2));

      return [ r, g, b, 255 ];
    }else{
      return [ 0, 0, 0, 255 ];
    }
  },
  rgbToHEX: function(rgb_color){
    let hex = "#";
    // Validation
    if(typeof rgb_color === "object"){
      for(const rgb in rgb_color){
        if(rgb_color[rgb] >= 0 && rgb_color[rgb] <= 255){
          let tmp_hex = rgb_color[rgb].toString(16);
          if(tmp_hex.length < 2){
            tmp_hex = "0" + tmp_hex;
          }
          hex += tmp_hex;
        }else{
          console.error("Failed to convert RGB to HEX, invalid RGB value '" + rgb_color[rgb] + "'");
          return;
        }
      }
      return hex;
    }else{
      console.error("Failed to convert RGB to HEX, invalid RGB array");
    }
  },
  hexToInt: function(hex){
    const hex_validation = /^[0-9A-F].*$/gi;
    let result = 0;
    hex = hex.toUpperCase();
    if(hex.length <= 8 && hex_validation.test(hex)){
      for(let i = hex.length - 1; i >= 0; i--){
        let hex_int = 1;
        switch(hex[i]){
        case "0":hex_int = 0;break;
        case "1":hex_int = 1;break;
        case "2":hex_int = 2;break;
        case "3":hex_int = 3;break;
        case "4":hex_int = 4;break;
        case "5":hex_int = 5;break;
        case "6":hex_int = 6;break;
        case "7":hex_int = 7;break;
        case "8":hex_int = 8;break;
        case "9":hex_int = 9;break;
        case "A":hex_int = 10;break;
        case "B":hex_int = 11;break;
        case "C":hex_int = 12;break;
        case "D":hex_int = 13;break;
        case "E":hex_int = 14;break;
        case "F":hex_int = 15;break;
        default:hex_int = 0;break;
        }
        result += hex_int * Math.pow(16, hex.length - 1 - i);
      }
    }else{
      console.warn("Not a proper HEX String '" + hex + "' : HEX Length: " + hex.length);
    }
    return result;
  },
  brightenColor: function(color){
    const rgb = colors.hexToRGB(color);
    if(rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0){
      return color;
    }

    rgb[0] += 16;
    rgb[1] += 16;
    rgb[2] += 16;

    return colors.rgbToHEX(rgb);
  }
};

/* global exports */
exports.colors = colors;
exports.hexToRGB = colors.hexToRGB;
exports.rgbToHEX = colors.rgbToHEX;
exports.hexToInt = colors.hexToInt;
exports.brightenColor = colors.brightenColor;
Object.defineProperty(exports, "__esModule", { value: true });