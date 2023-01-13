import crypto from "crypto";

// For AES, this is always 16
const IV_LENGTH = 16;

function prepKey(key: string, salt: string){
  return crypto.pbkdf2Sync(key, salt, 1024, 32, "sha256");
}
export function randomString(length: number): string{
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()[]{};:'.,></?";
  const charactersLength = characters.length;
  for ( let i = 0; i < length; i++ ){
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export function encrypt(text: string, key: string, salt: string): string{
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", prepKey(key, salt), iv);
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([ encrypted, cipher.final() ]);
  return iv.toString("base64") + ":" + encrypted.toString("base64");
}

export function decrypt(text: string, key: string, salt: string): string | undefined{
  const parts = text.split(":");
  if(parts.length < 2){
    return undefined;
  }
  const iv = Buffer.from(parts[0], "base64");
  const encrypted = Buffer.from(parts[1], "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", prepKey(key, salt), iv);
  let decrypted = decipher.update(encrypted);

  decrypted = Buffer.concat([ decrypted, decipher.final() ]);
  return decrypted.toString();
}

export default{
  decrypt,
  encrypt,
  randomString
};