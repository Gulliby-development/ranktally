import { type MethodFn, totalBallots, VoteError } from "../core/ballots";
import { parseOptions } from "../core/options";
import { renderTable, show } from "../core/text";
import { type Io, loadElection } from "../formats/files";

export function run(argv: string[], io: Io, methods: Record<string, MethodFn>): number {
  const parsed = parseOptions(argv, [
    { name: "--seats", kind: "int", default: 1, lo: 1, hi: 11 },
    { name: "--winner-only", kind: "flag" },
  ]);
  const seatsValue = parsed.values["--seats"];
  const winnerOnlyValue = parsed.values["--winner-only"];
  const seats = typeof seatsValue === "number" ? seatsValue : 1;
  const winnerOnly = winnerOnlyValue === true;

  if (parsed.args.length === 0) {
    throw new VoteError("missing METHOD");
  }

  const methodName = parsed.args[0];
  const methodNames = Object.keys(methods);
  const expectedMethods =
    methodNames.length > 1
      ? `${methodNames.slice(0, -1).join(", ")} or ${methodNames[methodNames.length - 1]}`
      : (methodNames[0] ?? "");
  if (!Object.hasOwn(methods, methodName)) {
    throw new VoteError(`unknown method ${show(methodName)} (expected ${expectedMethods})`);
  }

  if (parsed.args.length < 2) {
    throw new VoteError("missing FILE");
  }

  if (parsed.args.length > 2) {
    throw new VoteError("too many arguments");
  }

  const file = parsed.args[1];
  const election = loadElection(io, file);

  if (methodName === "stv" && seats >= election.candidates.length) {
    throw new VoteError(
      `invalid --seats ${show(String(seats))} (expected an integer from 1 to ${election.candidates.length - 1})`,
    );
  }

  const outcome = methods[methodName](election, seats);
  const result =
    methodName === "stv" && seats > 1
      ? `elected: ${outcome.winners.join(", ")}`
      : outcome.winners.length === 1
        ? `winner: ${outcome.winners[0]}`
        : `winners: ${outcome.winners.join(", ")} (tie)`;
  const output = winnerOnly
    ? `${result}\n`
    : `${[
        `method: ${methodName}`,
        `ballots: ${totalBallots(election)}`,
        ...outcome.lines,
        result,
        "",
        ...renderTable(outcome.header, outcome.rows, outcome.right),
      ].join("\n")}\n`;

  io.out(output);
  return outcome.tie ? 1 : 0;
}
