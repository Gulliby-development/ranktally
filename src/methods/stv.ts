import type { Ballot, Election, Outcome } from "../core/ballots";
import { totalBallots } from "../core/ballots";
import { Fraction } from "../core/fraction";

interface Allocation {
  ballotIndex: number;
  candidate: number;
}

function allocate(ballot: Ballot, remaining: boolean[]): number | null {
  for (const group of ballot.groups) {
    const available = group.filter((candidate) => remaining[candidate]);

    if (available.length > 0) {
      return available.length === 1 ? available[0] : null;
    }
  }

  return null;
}

export function run(election: Election, seats: number): Outcome {
  const candidateCount = election.candidates.length;
  const total = totalBallots(election);
  const quota = Math.floor(total / (seats + 1)) + 1;
  const remaining = Array<boolean>(candidateCount).fill(true);
  const weights = election.ballots.map((ballot) => Fraction.of(ballot.count));
  const winners: number[] = [];
  const rows: string[][] = [];
  let round = 1;

  while (winners.length < seats) {
    const votes = Array.from({ length: candidateCount }, () => Fraction.of(0));
    const allocations: Allocation[] = [];

    for (let ballotIndex = 0; ballotIndex < election.ballots.length; ballotIndex += 1) {
      const candidate = allocate(election.ballots[ballotIndex], remaining);

      if (candidate !== null) {
        votes[candidate] = votes[candidate].plus(weights[ballotIndex]);
        allocations.push({ ballotIndex, candidate });
      }
    }

    const snapshot = [
      String(round),
      "",
      ...votes.map((vote, candidate) => (remaining[candidate] ? vote.toFixed2() : "-")),
    ];
    const needed = seats - winners.length;
    let remainingCount = 0;

    for (const candidateRemains of remaining) {
      if (candidateRemains) {
        remainingCount += 1;
      }
    }

    if (remainingCount === needed) {
      const fillOrder = Array.from({ length: candidateCount }, (_, candidate) => candidate)
        .filter((candidate) => remaining[candidate])
        .sort((left, right) => {
          const voteOrder = votes[right].compare(votes[left]);
          return voteOrder === 0 ? left - right : voteOrder;
        });

      winners.push(...fillOrder);
      snapshot[1] = `fill ${fillOrder.map((candidate) => election.candidates[candidate]).join(", ")}`;
      rows.push(snapshot);
      break;
    }

    let mostCandidate = -1;

    for (let candidate = 0; candidate < candidateCount; candidate += 1) {
      if (
        remaining[candidate] &&
        (mostCandidate === -1 || votes[candidate].compare(votes[mostCandidate]) > 0)
      ) {
        mostCandidate = candidate;
      }
    }

    if (mostCandidate !== -1 && votes[mostCandidate].compare(Fraction.of(quota)) >= 0) {
      winners.push(mostCandidate);
      snapshot[1] = `elect ${election.candidates[mostCandidate]}`;
      rows.push(snapshot);

      const surplus = votes[mostCandidate].minus(Fraction.of(quota));
      const transfer = surplus.dividedBy(votes[mostCandidate]);

      for (const allocation of allocations) {
        if (allocation.candidate === mostCandidate) {
          weights[allocation.ballotIndex] = weights[allocation.ballotIndex].times(transfer);
        }
      }

      remaining[mostCandidate] = false;
    } else {
      let fewestCandidate = -1;

      for (let candidate = 0; candidate < candidateCount; candidate += 1) {
        if (
          remaining[candidate] &&
          (fewestCandidate === -1 || votes[candidate].compare(votes[fewestCandidate]) <= 0)
        ) {
          fewestCandidate = candidate;
        }
      }

      if (fewestCandidate !== -1) {
        snapshot[1] = `eliminate ${election.candidates[fewestCandidate]}`;
        rows.push(snapshot);
        remaining[fewestCandidate] = false;
      }
    }

    round += 1;
  }

  return {
    winners: winners.map((candidate) => election.candidates[candidate]),
    tie: false,
    lines: [`seats: ${seats}`, `quota: ${quota}`],
    header: ["round", "action", ...election.candidates],
    rows,
    right: new Set([0, ...Array.from({ length: candidateCount }, (_, index) => index + 2)]),
  };
}
