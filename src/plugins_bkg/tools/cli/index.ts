import { CLI } from "./cli";

export default {
  commands: {} as Record<string, CLI.Argument>,
  option(flag: string, description?: string, has_data?: boolean){
    this.commands[flag] = {
      description,
      has_data
    };
    return this;
  },
  processCommands(args: string[]): CLI.ProcessedArgs{
    const processed = {} as  CLI.ProcessedArgs;
    let flag = undefined as string | undefined;
    for(const arg of args){
      if (arg.startsWith("--") || arg.startsWith("-")){
        // Handle boolean flag
        if(flag !== undefined){
          processed[flag] = true;
        }
        flag = arg.substring(arg.startsWith("--") ? 2 : 1);
      } else if(flag !== undefined){
        processed[flag] = arg;
        flag = undefined;
      }
    }
    return processed;
  }
};