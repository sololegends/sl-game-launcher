import sudo from "sudo-prompt";

export type ElevateCallback = (
	error?: Error | undefined,
	stdout?: string | Buffer | undefined,
	stderr?: string | Buffer | undefined
) => void;

export default function(command: string, callback: ElevateCallback){
  const options = {
    name: "SL Game Launcher"
  };

  sudo.exec(command, options, callback);
}