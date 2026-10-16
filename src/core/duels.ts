import { type Election, levels } from "./ballots";

export function duels(election: Election): number[][] {
  const candidateCount = election.candidates.length;
  const counts = Array.from({ length: candidateCount }, () =>
    Array<number>(candidateCount).fill(0),
  );

  for (const ballot of election.ballots) {
    const ballotLevels = levels(ballot, candidateCount);

    for (let preferred = 0; preferred < candidateCount; preferred += 1) {
      for (let other = 0; other < candidateCount; other += 1) {
        if (ballotLevels[preferred] < ballotLevels[other]) {
          counts[preferred][other] += ballot.count;
        }
      }
    }
  }

  return counts;
}

export function condorcetWinner(d: number[][]): number | null {
  for (let candidate = 0; candidate < d.length; candidate += 1) {
    let beatsEveryOther = true;

    for (let other = 0; other < d.length; other += 1) {
      if (candidate !== other && d[candidate][other] <= d[other][candidate]) {
        beatsEveryOther = false;
        break;
      }
    }

    if (beatsEveryOther) {
      return candidate;
    }
  }

  return null;
}

export function condorcetLoser(d: number[][]): number | null {
  for (let candidate = 0; candidate < d.length; candidate += 1) {
    let losesToEveryOther = true;

    for (let other = 0; other < d.length; other += 1) {
      if (candidate !== other && d[other][candidate] <= d[candidate][other]) {
        losesToEveryOther = false;
        break;
      }
    }

    if (losesToEveryOther) {
      return candidate;
    }
  }

  return null;
}
