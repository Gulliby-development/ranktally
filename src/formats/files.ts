import { type Election, FormatError, VoteError } from "../core/ballots";
import { parseElection } from "./election";

export interface Io {
  readFile(path: string): Uint8Array;
  readStdin(): Uint8Array;
  out(text: string): void;
  err(text: string): void;
}

export function displayPath(path: string): string {
  return path === "-" ? "<stdin>" : path.replace(/\\/g, "/");
}

export function splitLines(text: string): string[] {
  const input = text.startsWith("\uFEFF") ? text.slice(1) : text;
  if (input === "") {
    return [];
  }

  const lines: string[] = [];
  let start = 0;

  while (true) {
    const newline = input.indexOf("\n", start);
    if (newline === -1) {
      if (start < input.length) {
        lines.push(input.slice(start));
      }
      return lines;
    }

    let line = input.slice(start, newline);
    if (line.endsWith("\r")) {
      line = line.slice(0, -1);
    }
    lines.push(line);
    start = newline + 1;
  }
}

export function readText(io: Io, path: string): { display: string; text: string } {
  const display = displayPath(path);
  let bytes: Uint8Array;

  try {
    bytes = path === "-" ? io.readStdin() : io.readFile(path);
  } catch {
    throw new VoteError(`${display}: cannot read the file`);
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new VoteError(`${display}: input is not valid UTF-8`);
  }

  return { display, text };
}

export function loadElection(io: Io, path: string): Election {
  const { display, text } = readText(io, path);
  let election: Election;

  try {
    election = parseElection(splitLines(text));
  } catch (error) {
    if (error instanceof FormatError) {
      const location = error.line === 0 ? display : `${display}:${error.line}`;
      throw new VoteError(`${location}: ${error.message}`);
    }
    throw error;
  }

  if (election.ballots.length === 0) {
    throw new VoteError(`${display}: no ballots`);
  }

  return election;
}
