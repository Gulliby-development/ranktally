import { type Ballot, type Election, FormatError } from "../core/ballots";
import { show } from "../core/text";

export function parseElection(lines: string[]): Election {
  let candidateLine = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (!isIgnored(lines[index])) {
      candidateLine = index;
      break;
    }
  }

  if (candidateLine === -1) {
    throw new FormatError(0, "no candidates line");
  }

  const candidateTokens = trimSpacesTabs(stripComment(lines[candidateLine])).split(/[ \t]+/);
  if (candidateTokens[0] !== "candidates") {
    throw new FormatError(candidateLine + 1, 'expected a "candidates" line first');
  }

  const candidates: string[] = [];
  const candidateIndexes = new Map<string, number>();

  for (const name of candidateTokens.slice(1)) {
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(name)) {
      throw new FormatError(candidateLine + 1, `invalid candidate name ${show(name)}`);
    }

    if (candidateIndexes.has(name)) {
      throw new FormatError(candidateLine + 1, `duplicate candidate ${show(name)}`);
    }

    candidateIndexes.set(name, candidates.length);
    candidates.push(name);
  }

  if (candidates.length < 2) {
    throw new FormatError(candidateLine + 1, "at least 2 candidates are needed");
  }

  if (candidates.length > 12) {
    throw new FormatError(candidateLine + 1, "at most 12 candidates are allowed");
  }

  const ballots: Ballot[] = [];

  for (let index = candidateLine + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isIgnored(line)) {
      continue;
    }

    ballots.push(parseBallot(line, index + 1, candidateIndexes));
  }

  return { candidates, ballots };
}

function parseBallot(
  line: string,
  lineNumber: number,
  candidateIndexes: ReadonlyMap<string, number>,
): Ballot {
  line = stripComment(line);
  const colonIndex = line.indexOf(":");
  let count = 1;
  let ranking = line;

  if (colonIndex !== -1) {
    const countText = trimSpacesTabs(line.slice(0, colonIndex));
    if (!/^[1-9][0-9]{0,5}$/.test(countText)) {
      throw new FormatError(lineNumber, `invalid ballot count ${show(countText)}`);
    }

    count = Number(countText);
    ranking = line.slice(colonIndex + 1);
  }

  const trimmedRanking = trimSpacesTabs(ranking);
  if (trimmedRanking === "") {
    return { count, groups: [] };
  }

  const groups: number[][] = [];
  const used = new Set<string>();

  for (const groupText of trimmedRanking.split(">")) {
    const group: number[] = [];

    for (const nameText of groupText.split("=")) {
      const name = trimSpacesTabs(nameText);

      if (name === "") {
        throw new FormatError(lineNumber, "empty name in ranking");
      }

      const candidateIndex = candidateIndexes.get(name);
      if (candidateIndex === undefined) {
        throw new FormatError(lineNumber, `unknown candidate ${show(name)}`);
      }

      if (used.has(name)) {
        throw new FormatError(lineNumber, `candidate ${show(name)} is ranked twice`);
      }

      used.add(name);
      group.push(candidateIndex);
    }

    groups.push(group);
  }

  return { count, groups };
}

function stripComment(line: string): string {
  for (
    let hashIndex = line.indexOf("#");
    hashIndex !== -1;
    hashIndex = line.indexOf("#", hashIndex + 1)
  ) {
    if (hashIndex === 0 || line[hashIndex - 1] === " " || line[hashIndex - 1] === "\t") {
      return line.slice(0, hashIndex);
    }
  }

  return line;
}

function isIgnored(line: string): boolean {
  const trimmed = trimSpacesTabs(line);
  return trimmed === "" || trimmed.startsWith("#");
}

function trimSpacesTabs(text: string): string {
  return text.replace(/^[ \t]+|[ \t]+$/g, "");
}
