import { type Election, levels, type Outcome } from "../core/ballots";
import { competitionRanks } from "../core/text";

export function run(election: Election, _seats: number): Outcome {
  const candidateCount = election.candidates.length;
  const points = Array<number>(candidateCount).fill(0);

  for (const ballot of election.ballots) {
    const candidateLevels = levels(ballot, candidateCount);

    for (let candidate = 0; candidate < candidateCount; candidate += 1) {
      for (let other = 0; other < candidateCount; other += 1) {
        if (candidateLevels[candidate] < candidateLevels[other]) {
          points[candidate] += ballot.count;
        }
      }
    }
  }

  const sortedCandidates = Array.from({ length: candidateCount }, (_, candidate) => candidate).sort(
    (left, right) => points[right] - points[left] || left - right,
  );
  const ranks = competitionRanks(sortedCandidates.map((candidate) => points[candidate]));
  const rows = sortedCandidates.map((candidate, index) => [
    String(ranks[index]),
    election.candidates[candidate],
    String(points[candidate]),
  ]);
  const winners = sortedCandidates
    .filter((_, index) => ranks[index] === 1)
    .map((candidate) => election.candidates[candidate]);

  return {
    winners,
    tie: winners.length > 1,
    lines: [],
    header: ["rank", "candidate", "points"],
    rows,
    right: new Set([0, 2]),
  };
}
