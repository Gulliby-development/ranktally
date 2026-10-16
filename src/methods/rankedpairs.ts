import type { Election, Outcome } from "../core/ballots";
import { duels } from "../core/duels";
import { competitionRanks } from "../core/text";

interface Victory {
  source: number;
  target: number;
  winningVotes: number;
  opposingVotes: number;
}

export function run(election: Election, _seats: number): Outcome {
  const candidateCount = election.candidates.length;
  const pairwise = duels(election);
  const victories: Victory[] = [];

  for (let source = 0; source < candidateCount; source += 1) {
    for (let target = 0; target < candidateCount; target += 1) {
      if (pairwise[source][target] > pairwise[target][source]) {
        victories.push({
          source,
          target,
          winningVotes: pairwise[source][target],
          opposingVotes: pairwise[target][source],
        });
      }
    }
  }

  victories.sort((left, right) => {
    if (left.winningVotes !== right.winningVotes) {
      return left.winningVotes > right.winningVotes ? -1 : 1;
    }
    if (left.opposingVotes !== right.opposingVotes) {
      return left.opposingVotes < right.opposingVotes ? -1 : 1;
    }
    return left.source - right.source || left.target - right.target;
  });

  const locked = Array.from({ length: candidateCount }, () =>
    Array<boolean>(candidateCount).fill(false),
  );

  const reaches = (from: number, to: number): boolean => {
    if (from === to) {
      return false;
    }

    const visited = Array<boolean>(candidateCount).fill(false);
    const pending = [from];
    visited[from] = true;

    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined) {
        continue;
      }

      for (let next = 0; next < candidateCount; next += 1) {
        if (!locked[current][next] || visited[next]) {
          continue;
        }
        if (next === to) {
          return true;
        }
        visited[next] = true;
        pending.push(next);
      }
    }

    return false;
  };

  for (const victory of victories) {
    if (!reaches(victory.target, victory.source)) {
      locked[victory.source][victory.target] = true;
    }
  }

  const wins = Array<number>(candidateCount).fill(0);
  const losses = Array<number>(candidateCount).fill(0);

  for (let source = 0; source < candidateCount; source += 1) {
    for (let target = 0; target < candidateCount; target += 1) {
      if (reaches(source, target)) {
        wins[source] += 1;
        losses[target] += 1;
      }
    }
  }

  const sortedCandidates = Array.from({ length: candidateCount }, (_, candidate) => candidate).sort(
    (left, right) => {
      if (losses[left] !== losses[right]) {
        return losses[left] - losses[right];
      }
      return left - right;
    },
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
