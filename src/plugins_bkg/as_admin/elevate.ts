import sudo from "sudo-prompt";

export type ElevateCallback = (
	error?: Error,
	stdout?: string | Buffer,
	stderr?: string | Buffer
) => void;

export function elevateFile(file: string, args: string[], callback: ElevateCallback){
  const options = {
    name: "SL Game Launcher"
  };

  sudo.exec(file + " " + args.join(" "), options, callback);
}

export default function(command: string, callback: ElevateCallback){
  const options = {
    name: "SL Game Launcher"
  };
  console.log("running command with elevation: ", command);
  sudo.exec(command, options, callback);
}