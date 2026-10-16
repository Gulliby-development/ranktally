import type { Election, Outcome } from "../core/ballots";
import { duels } from "../core/duels";
import { competitionRanks } from "../core/text";

export function run(election: Election, _seats: number): Outcome {
  const candidateCount = election.candidates.length;
  const pairwise = duels(election);
  const paths = Array.from({ length: candidateCount }, (_, source) =>
    Array.from({ length: candidateCount }, (_, target) =>
      pairwise[source][target] > pairwise[target][source] ? pairwise[source][target] : 0,
    ),
  );

  for (let intermediate = 0; intermediate < candidateCount; intermediate += 1) {
    for (let source = 0; source < candidateCount; source += 1) {
      for (let target = 0; target < candidateCount; target += 1) {
        if (source !== target && source !== intermediate && target !== intermediate) {
          paths[source][target] = Math.max(
            paths[source][target],
            Math.min(paths[source][intermediate], paths[intermediate][target]),
          );
        }
      }
    }
  }

  const wins = Array<number>(candidateCount).fill(0);
  const losses = Array<number>(candidateCount).fill(0);

  for (let source = 0; source < candidateCount; source += 1) {
    for (let target = 0; target < candidateCount; target += 1) {
      if (paths[source][target] > paths[target][source]) {
        wins[source] += 1;
        losses[target] += 1;
      }
    }
  }

  const sortedCandidates = Array.from({ length: candidateCount }, (_, candidate) => candidate).sort(
    (left, right) => losses[left] - losses[right] || left - right,
  );
  const ranks = competitionRanks(sortedCandidates.map((candidate) => losses[candidate]));
  const rows = sortedCandidates.map((candidate, index) => [
    String(ranks[index]),
    election.candidates[candidate],
    String(wins[candidate]),
    String(losses[candidate]),
  ]);
  const winners = sortedCandidates
    .filter((candidate) => losses[candidate] === 0)
    .map((candidate) => election.candidates[candidate]);

  return {
    winners,
    tie: winners.length > 1,
    lines: [],
    header: ["rank", "candidate", "wins", "losses"],
    rows,
    right: new Set([0, 2, 3]),
  };
}
