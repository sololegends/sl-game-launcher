import crypto from "crypto";

type UUIDRandsFunction = () => number[];
type UUIDOptions = {
  random?: number[]
  rands?: UUIDRandsFunction
}


function getRand(): UUIDRandsFunction{
  return function(){
    const rands = new Array(16);
    for(let i = 0, r = 0; i < 16; i++){
      if((i & 0x03) === 0){
        r = Math.random() * 0x100000000;
      }
      rands[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }
    return rands;
  };
}

function bytesToUuid(buf: number[], offset = 0): string{
  const bth = [];
  for(let i = 0; i < 256; ++i){
    bth[i] = (i + 0x100).toString(16).substring(1);
  }

  let i = offset;
  return bth[buf[i++]] + bth[buf[i++]] +
    bth[buf[i++]] + bth[buf[i++]] + "-" +
    bth[buf[i++]] + bth[buf[i++]] + "-" +
    bth[buf[i++]] + bth[buf[i++]] + "-" +
    bth[buf[i++]] + bth[buf[i++]] + "-" +
    bth[buf[i++]] + bth[buf[i++]] +
    bth[buf[i++]] + bth[buf[i++]] +
    bth[buf[i++]] + bth[buf[i++]];
}

export default function UUIDv4(options?: UUIDOptions, buf?: number[], offset = 0): string{
  // Use native impl if possible
  if(crypto.randomUUID){
    return crypto.randomUUID();
  }
  // Yay polyfill
  options = options || {};
  const rands = options.random || (options.rands || getRand())();

  rands[6] = (rands[6] & 0x0f) | 0x40;
  rands[8] = (rands[8] & 0x3f) | 0x80;

  if(buf){
    for(let j = 0; j < 16; j++){
      buf[offset + j] = rands[j];
    }
  }

  return bytesToUuid(rands);
}
