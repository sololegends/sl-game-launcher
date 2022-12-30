
import { getFolderSize, globAsync } from "./files";
import zip, { ZipEntry } from "node-stream-zip";
import archiver from "archiver";
import fs from "fs";

export type CompressProgress = {
  total: number
  progress: number
}


export async function compressGlob(
  input: string,
  zip_output: string,
  progress?: (p: CompressProgress) => void,
  level = 9){
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
  let total_size = 0;

  const files = await globAsync(input);
  for(const f of files){
    total_size += fs.statSync(f).size;
  }
  if(progress){
    archive_op.on("progress", (p: archiver.ProgressData) =>{
      progress({
        total: total_size,
        progress: p.fs.processedBytes
      });
    });
  }
  archive_op.pipe(zip_output_s);
  for(const f of files){
    archive_op.file(f, {
      name: f.substring(f.replaceAll("\\", "/").lastIndexOf("/") + 1)
    });
  }
  return await archive_op.finalize().then(() => {
    return promise;
  });
}

export async function compressFolder(
  input: string,
  zip_output: string,
  progress?: (p: CompressProgress) => void,
  level = 9){
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
  const total_size = getFolderSize(input);
  if(progress){
    archive_op.on("progress", (p: archiver.ProgressData) =>{
      progress({
        total: total_size,
        progress: p.fs.processedBytes
      });
    });
  }
  archive_op.pipe(zip_output_s);
  archive_op.directory(input, false);
  return await archive_op.finalize().then(() => {
    return promise;
  });
}

export async function compressFile(
  input: string,
  zip_output: string,
  progress?: (p: CompressProgress) => void,
  level = 9){
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
  const total_size = fs.statSync(input).size;
  if(progress){
    archive_op.on("progress", (p: archiver.ProgressData) =>{
      progress({
        total: total_size,
        progress: p.fs.processedBytes
      });
    });
  }
  const entry_data = {
    name: input.substring(input.replaceAll("\\\\", "/").lastIndexOf("/") + 1)
  };
  console.log("File compression: ", entry_data);
  archive_op.pipe(zip_output_s);
  archive_op.file(input, entry_data);
  return await archive_op.finalize().then(() => {
    return promise;
  });
}

export async function decompressFolder(
  input: string,
  output: string,
  progress?: (p: CompressProgress) => void
){

  const archive = new zip.async({file: input});
  const total = fs.statSync(input).size;
  const pg = progress ? progress :  () => {
    // Nothing here
  };

  let extracted = 0;
  archive.on("extract", (entry: ZipEntry) => {
    extracted += entry.compressedSize;
    pg({total: total, progress: extracted});
  });
  // Do the output
  await archive.extract(null, output);
  await archive.close();
}

export async function decompressFile(
  input: string,
  output: string,
  progress?: (p: CompressProgress) => void
){
  return decompressFolder(input, output.substring(0, output.replaceAll("\\\\", "/").lastIndexOf("/")), progress);
}