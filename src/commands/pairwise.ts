import { totalBallots, VoteError } from "../core/ballots";
import { condorcetLoser, condorcetWinner, duels } from "../core/duels";
import { parseOptions } from "../core/options";
import { fixed1, renderTable } from "../core/text";
import { type Io, loadElection } from "../formats/files";

export function run(argv: string[], io: Io): number {
  const parsed = parseOptions(argv, [
    { name: "--margins", kind: "flag" },
    { name: "--percent", kind: "flag" },
  ]);

  if (parsed.args.length === 0) {
    throw new VoteError("missing FILE");
  }

  if (parsed.args.length > 1) {
    throw new VoteError("too many arguments");
  }

  const election = loadElection(io, parsed.args[0]);
  const counts = duels(election);
  const margins = parsed.values["--margins"] === true;
  const percent = parsed.values["--percent"] === true;
  const total = totalBallots(election);
  const rows = election.candidates.map((candidate, candidateIndex) => [
    candidate,
    ...election.candidates.map((_, otherIndex) => {
      if (candidateIndex === otherIndex) {
        return ".";
      }

      const value = margins
        ? counts[candidateIndex][otherIndex] - counts[otherIndex][candidateIndex]
        : counts[candidateIndex][otherIndex];
      const magnitude = percent ? fixed1(100 * Math.abs(value), total) : String(Math.abs(value));
      return value < 0 && magnitude !== "0.0" ? `-${magnitude}` : magnitude;
    }),
  ]);
  const right = new Set(election.candidates.map((_, index) => index + 1));
  const winner = condorcetWinner(counts);
  const loser = condorcetLoser(counts);
  const table = renderTable(["vs", ...election.candidates], rows, right);
  const output = [
    ...table,
    "",
    `condorcet winner: ${winner === null ? "none" : election.candidates[winner]}`,
    `condorcet loser: ${loser === null ? "none" : election.candidates[loser]}`,
  ].join("\n");

  io.out(`${output}\n`);
  return winner === null ? 1 : 0;
}
