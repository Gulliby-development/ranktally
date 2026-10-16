export class VoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoteError";
  }
}

export class FormatError extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(message);
    this.name = "FormatError";
    this.line = line;
  }
}

export interface Ballot {
  count: number;
  groups: number[][];
}

export interface Election {
  candidates: string[];
  ballots: Ballot[];
}

export interface Outcome {
  winners: string[];
  tie: boolean;
  lines: string[];
  header: string[];
  rows: string[][];
  right: ReadonlySet<number>;
}

export type MethodFn = (election: Election, seats: number) => Outcome;

export function totalBallots(election: Election): number {
  return election.ballots.reduce((total, ballot) => total + ballot.count, 0);
}

export function levels(ballot: Ballot, n: number): number[] {
  const candidateLevels = Array<number>(n).fill(ballot.groups.length);

  for (let level = 0; level < ballot.groups.length; level += 1) {
    for (const candidate of ballot.groups[level]) {
      candidateLevels[candidate] = level;
    }
  }

  return candidateLevels;
}
