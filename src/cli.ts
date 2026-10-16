import { run as compareRun } from "./commands/compare";
import { run as pairwiseRun } from "./commands/pairwise";
import { run as tallyRun } from "./commands/tally";
import { type MethodFn, VoteError } from "./core/ballots";
import { show } from "./core/text";
import type { Io } from "./formats/files";
import { run as bordaRun } from "./methods/borda";
import { run as pluralityRun } from "./methods/plurality";
import { run as rankedpairsRun } from "./methods/rankedpairs";
import { run as schulzeRun } from "./methods/schulze";
import { run as stvRun } from "./methods/stv";

export const USAGE = [
  "usage: ranktally tally [--seats N] [--winner-only] METHOD FILE",
  "       ranktally compare FILE",
  "       ranktally pairwise [--margins] FILE",
].join("\n");

const methods: Record<string, MethodFn> = {
  plurality: pluralityRun,
  borda: bordaRun,
  schulze: schulzeRun,
  rankedpairs: rankedpairsRun,
  stv: stvRun,
};

type CommandFn = (argv: string[], io: Io) => number;

const commands: Record<string, CommandFn> = {
  tally: (argv, io) => tallyRun(argv, io, methods),
  compare: (argv, io) => compareRun(argv, io, methods),
  pairwise: pairwiseRun,
};

export function main(argv: string[], io: Io): number {
  if (argv.length === 1 && argv[0] === "--help") {
    io.out(`${USAGE}\n`);
    return 0;
  }

  try {
    if (argv.length === 0) {
      throw new VoteError("missing command (tally, compare or pairwise)");
    }

    const commandName = argv[0];
    if (!Object.hasOwn(commands, commandName)) {
      throw new VoteError(`unknown command ${show(commandName)}`);
    }

    return commands[commandName](argv.slice(1), io);
  } catch (error) {
    if (error instanceof VoteError) {
      io.err(`ranktally: ${error.message}\n`);
      return 2;
    }

    throw error;
  }
}
