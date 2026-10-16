import { type MethodFn, VoteError } from "../core/ballots";
import { parseOptions } from "../core/options";
import { renderTable } from "../core/text";
import { type Io, loadElection } from "../formats/files";

export function run(argv: string[], io: Io, methods: Record<string, MethodFn>): number {
  const parsed = parseOptions(argv, []);

  if (parsed.args.length === 0) {
    throw new VoteError("missing FILE");
  }

  if (parsed.args.length > 1) {
    throw new VoteError("too many arguments");
  }

  const election = loadElection(io, parsed.args[0]);
  const outcomes = Object.entries(methods).map(([name, method]) => ({
    method: name,
    outcome: method(election, 1),
  }));
  const rows = outcomes.map(({ method, outcome }) => [method, outcome.winners.join(", ")]);
  const firstWinner = outcomes[0]?.outcome.winners[0];
  const agrees =
    outcomes.length > 0 &&
    outcomes.every(
      ({ outcome }) => outcome.winners.length === 1 && outcome.winners[0] === firstWinner,
    );
  const output = `${renderTable(["method", "winner"], rows, new Set()).join("\n")}\n`;

  io.out(output);
  return agrees ? 0 : 1;
}
