import { type Election, type Outcome, totalBallots } from "../core/ballots";
import { competitionRanks, fixed1 } from "../core/text";

export function run(election: Election, _seats: number): Outcome {
  const candidateCount = election.candidates.length;
  const votes = Array<number>(candidateCount).fill(0);

  for (const ballot of election.ballots) {
    const firstGroup = ballot.groups[0];

    if (firstGroup?.length === 1) {
      votes[firstGroup[0]] += ballot.count;
    }
  }

  const total = totalBallots(election);
  const sortedCandidates = Array.from({ length: candidateCount }, (_, candidate) => candidate).sort(
    (left, right) => votes[right] - votes[left] || left - right,
  );
  const ranks = competitionRanks(sortedCandidates.map((candidate) => votes[candidate]));
  const rows = sortedCandidates.map((candidate, index) => [
    String(ranks[index]),
    election.candidates[candidate],
    String(votes[candidate]),
    fixed1(100 * votes[candidate], total),
  ]);
  const winners = sortedCandidates
    .filter((_, index) => ranks[index] === 1)
    .map((candidate) => election.candidates[candidate]);

  return {
    winners,
    tie: winners.length > 1,
    lines: [],
    header: ["rank", "candidate", "votes", "share%"],
    rows,
    right: new Set([0, 2, 3]),
  };
}
