import { expect, test } from "bun:test";
import { main } from "../src/cli";
import { type Election, FormatError } from "../src/core/ballots";
import { parseElection } from "../src/formats/election";
import { type Io, loadElection } from "../src/formats/files";

function fakeIo(fileText: string) {
  const calls = {
    outTexts: [] as string[],
    errTexts: [] as string[],
    filePaths: [] as string[],
    stdinReads: 0,
  };
  const io: Io = {
    readFile(path) {
      calls.filePaths.push(path);
      return new TextEncoder().encode(fileText);
    },
    readStdin() {
      calls.stdinReads += 1;
      return new Uint8Array();
    },
    out(text) {
      calls.outTexts.push(text);
    },
    err(text) {
      calls.errTexts.push(text);
    },
  };
  return { io, calls };
}

function caughtError(lines: string[]): FormatError {
  try {
    parseElection(lines);
  } catch (error) {
    if (error instanceof FormatError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected parseElection to throw a FormatError");
}

const EXPECTED_PLURALITY = [
  "method: plurality",
  "ballots: 10",
  "winner: Ann",
  "",
  "rank  candidate  votes  share%",
  "   1  Ann            4    40.0",
  "   2  Bob            3    30.0",
  "   3  Cy             2    20.0",
  "",
].join("\n");

test("a comment after a ranking leaves its ballot content unchanged", () => {
  expect(parseElection(["candidates A B C", "A > B # early voters"])).toEqual({
    candidates: ["A", "B", "C"],
    ballots: [{ count: 1, groups: [[0], [1]] }],
  });
});

test("a trailing comment is removed from the candidates line", () => {
  expect(parseElection(["candidates A B # candidate list"])).toEqual({
    candidates: ["A", "B"],
    ballots: [],
  });
});

test("counted and blank ballots retain their counts before comments", () => {
  expect(parseElection(["candidates A B", "4: A # count note", "7:   # abstained"])).toEqual({
    candidates: ["A", "B"],
    ballots: [
      { count: 4, groups: [[0]] },
      { count: 7, groups: [] },
    ],
  });
});

test("a tab immediately before the hash starts a comment", () => {
  expect(parseElection(["candidates A B", "B\t# tab note"])).toEqual({
    candidates: ["A", "B"],
    ballots: [{ count: 1, groups: [[1]] }],
  });
});

test("the first qualifying hash discards all later suffix content", () => {
  expect(parseElection(["candidates A B", "A > B # first: note # another hash"])).toEqual({
    candidates: ["A", "B"],
    ballots: [{ count: 1, groups: [[0], [1]] }],
  });
  const error = caughtError(["candidates A B", "A#B # comment: ignored # suffix"]);
  expect(error.line).toBe(2);
  expect(error.message).toBe('unknown candidate "A#B"');
});

test("glued hashes and a no-break space do not start comments", () => {
  const gluedName = caughtError(["candidates A B", "A#B"]);
  expect(gluedName.message).toBe('unknown candidate "A#B"');

  const gluedColon = caughtError(["candidates A B", "1:#A"]);
  expect(gluedColon.message).toBe('unknown candidate "#A"');

  const noBreakSpace = caughtError(["candidates A B", "A\u00a0# comment"]);
  expect(noBreakSpace.message).toBe('unknown candidate "A?#?comment"');

  const { io, calls } = fakeIo("candidates A B\n1: A#B\n");
  expect(main(["tally", "plurality", "votes.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(['ranktally: votes.txt:2: unknown candidate "A#B"\n']);
});

test("an error in ranking text before a comment keeps its physical line number", () => {
  const error = caughtError(["candidates A B", "", "A > X # note"]);
  expect(error.line).toBe(3);
  expect(error.message).toBe('unknown candidate "X"');
});

test("comment-only lines still count toward later ballot error line numbers", () => {
  const error = caughtError(["candidates A B", "A", "# ignored", "  # also ignored", "B > X"]);
  expect(error.line).toBe(5);
  expect(error.message).toBe('unknown candidate "X"');
});

test("an invalid count with a comment shows only the count text", () => {
  const error = caughtError(["candidates A B", "0: X # this is not part of the count"]);
  expect(error.line).toBe(2);
  expect(error.message).toBe('invalid ballot count "0"');
});

test("the worked plurality tally matches the same election without comments", () => {
  const commented = [
    "# club vote",
    "candidates Ann Bob Cy # three people",
    "4: Ann > Bob   # the early voters",
    "3: Bob > Cy > Ann # rest",
    "2: Cy",
    "1: # abstained",
  ].join("\n");
  const uncommented = [
    "candidates Ann Bob Cy",
    "4: Ann > Bob",
    "3: Bob > Cy > Ann",
    "2: Cy",
    "1:",
  ].join("\n");
  const commentedRun = fakeIo(commented);
  const plainRun = fakeIo(uncommented);

  expect(main(["tally", "plurality", "votes.txt"], commentedRun.io)).toBe(0);
  expect(commentedRun.calls.outTexts).toEqual([EXPECTED_PLURALITY]);
  expect(commentedRun.calls.errTexts).toEqual([]);
  expect(main(["tally", "plurality", "votes.txt"], plainRun.io)).toBe(0);
  expect(plainRun.calls.outTexts).toEqual(commentedRun.calls.outTexts);
  expect(plainRun.calls.errTexts).toEqual([]);
});

test("CRLF election input supports trailing comments", () => {
  const { io } = fakeIo("candidates A B # candidates\r\n2: B # ballots\r\n");
  const election = loadElection(io, "votes.txt");
  expect(election).toEqual({
    candidates: ["A", "B"],
    ballots: [{ count: 2, groups: [[1]] }],
  } satisfies Election);
});

test("full-line comments after candidates leave the election with no ballots", () => {
  const { io, calls } = fakeIo("candidates A B\n# first\n  # second\n");
  expect(main(["tally", "plurality", "votes.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: votes.txt: no ballots\n"]);
});
