import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerChannelCommands } from "./commands/channel.js";
import { registerDmCommands } from "./commands/dm.js";
import { registerWorkspaceCommands } from "./commands/workspace.js";
import { APP_CLI_NAME, APP_DESCRIPTION } from "./constants/app.js";

export function createSlackProgram(): Command {
  const program = new Command();

  program
    .name(APP_CLI_NAME)
    .description(APP_DESCRIPTION)
    .version("0.1.0");

  registerAuthCommands(program);
  registerWorkspaceCommands(program);
  registerChannelCommands(program);
  registerDmCommands(program);

  return program;
}

export async function runSlackCli(argv: string[]): Promise<void> {
  const program = createSlackProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("The command failed for an unknown reason.");
    }

    process.exitCode = 1;
  }
}
