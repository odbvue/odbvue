export function getArgs(): Record<string, string | null> {
  return parseArgs();
}

function parseArgs(argv: string[] = process.argv): Record<string, string | null> {
  const args: Record<string, string | null> = {};
  
  const argsToProcess = argv.slice(2);
  
  for (let i = 0; i < argsToProcess.length; i++) {
    const arg = argsToProcess[i];
    
    if (arg.startsWith('-')) {
      let key: string;
      
      if (arg.startsWith('--')) {
        key = arg.substring(2);
      } 
      else {
        key = arg.substring(1);
      }
      
      const nextArg = argsToProcess[i + 1];
      
      if (nextArg && !nextArg.startsWith('-')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = null;
      }
    }
  }
  
  return args;
}
