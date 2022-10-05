import archiver from "archiver";
import fs from "fs";
import { getFolderSize } from "./files";

export type CompressProgress = {
  total: number
  progress: number
}

export async function compressFolder(input: string, zip_output: string, progress?: (p: CompressProgress) => void, level = 9){
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