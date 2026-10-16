import { expect, test } from "bun:test";
import { type Election, VoteError } from "../src/core/ballots";
import { displayPath, type Io, loadElection, readText, splitLines } from "../src/formats/files";

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

type IoContract = Assert<
  Equal<
    Io,
    {
      readFile(path: string): Uint8Array;
      readStdin(): Uint8Array;
      out(text: string): void;
      err(text: string): void;
    }
  >
>;
type DisplayPathContract = Assert<Equal<typeof displayPath, (path: string) => string>>;
type SplitLinesContract = Assert<Equal<typeof splitLines, (text: string) => string[]>>;
type ReadTextContract = Assert<
  Equal<typeof readText, (io: Io, path: string) => { display: string; text: string }>
>;
type LoadElectionContract = Assert<Equal<typeof loadElection, (io: Io, path: string) => Election>>;

interface FakeIoOptions {
  fileBytes?: Uint8Array;
  stdinBytes?: Uint8Array;
  failFile?: boolean;
  failStdin?: boolean;
}

function fakeIo(options: FakeIoOptions = {}) {
  const calls = {
    filePaths: [] as string[],
    stdinReads: 0,
    outTexts: [] as string[],
    errTexts: [] as string[],
  };
  const io: Io = {
    readFile(path) {
      calls.filePaths.push(path);
      if (options.failFile) {
        throw new Error("file reader failed");
      }
      return options.fileBytes ?? new Uint8Array();
    },
    readStdin() {
      calls.stdinReads += 1;
      if (options.failStdin) {
        throw new Error("stdin reader failed");
      }
      return options.stdinBytes ?? new Uint8Array();
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

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function caughtVoteError(action: () => unknown): VoteError {
  try {
    action();
  } catch (error) {
    if (error instanceof VoteError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected a VoteError");
}

function expectNoOutput(calls: ReturnType<typeof fakeIo>["calls"]): void {
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([]);
}

test("formats exports match the injectable loading contracts", () => {
  const contractAssertions: [
    IoContract,
    DisplayPathContract,
    SplitLinesContract,
    ReadTextContract,
    LoadElectionContract,
  ] = [true, true, true, true, true];

  expect(contractAssertions).toEqual([true, true, true, true, true]);
});

const displayPathCases = [
  { name: "maps standard input to its diagnostic label", path: "-", expected: "<stdin>" },
  {
    name: "replaces Windows separators without resolving the path",
    path: "C:\\votes\\e.txt",
    expected: "C:/votes/e.txt",
  },
  {
    name: "leaves relative dot segments untouched",
    path: "./votes/../e.txt",
    expected: "./votes/../e.txt",
  },
  {
    name: "preserves spaces without diagnostic quoting",
    path: "my votes/election file.txt",
    expected: "my votes/election file.txt",
  },
  { name: "leaves forward slashes untouched", path: "votes/e.txt", expected: "votes/e.txt" },
] as const;

test.each(displayPathCases)("displayPath $name", ({ path, expected }) => {
  expect(displayPath(path)).toBe(expected);
});

const splitLineCases: Array<{ name: string; text: string; expected: string[] }> = [
  { name: "empty text", text: "", expected: [] },
  { name: "one initial BOM only", text: "\uFEFF", expected: [] },
  { name: "one unterminated line", text: "A", expected: ["A"] },
  { name: "one terminal line feed", text: "A\n", expected: ["A"] },
  { name: "a terminal empty line after two line feeds", text: "A\n\n", expected: ["A", ""] },
  { name: "a single empty line", text: "\n", expected: [""] },
  { name: "CRLF between lines", text: "A\r\nB", expected: ["A", "B"] },
  { name: "a lone carriage return", text: "A\r", expected: ["A\r"] },
  { name: "one CR is removed from a pair before LF", text: "A\r\r\n", expected: ["A\r"] },
  { name: "one leading BOM is skipped", text: "\uFEFFA\nB", expected: ["A", "B"] },
  {
    name: "a second leading BOM remains in the first line",
    text: "\uFEFF\uFEFFA",
    expected: ["\uFEFFA"],
  },
  { name: "an internal BOM remains", text: "A\n\uFEFFB", expected: ["A", "\uFEFFB"] },
  {
    name: "only one CR is removed from a longer CR run",
    text: "A\r\r\r\nB",
    expected: ["A\r\r", "B"],
  },
  { name: "mixed LF and CRLF", text: "A\nB\r\nC", expected: ["A", "B", "C"] },
  { name: "a final unterminated CR remains", text: "A\nB\r", expected: ["A", "B\r"] },
];

test.each(splitLineCases)("splitLines handles $name", ({ text, expected }) => {
  expect(splitLines(text)).toEqual(expected);
});

test("readText reads a file using its original Windows path and retains a BOM", () => {
  const { io, calls } = fakeIo({
    fileBytes: new Uint8Array([
      0xef, 0xbb, 0xbf, 0x63, 0x61, 0x6e, 0x64, 0x69, 0x64, 0x61, 0x74, 0x65, 0x73, 0x20, 0x41,
      0x20, 0x42,
    ]),
  });

  expect(readText(io, "C:\\votes\\e.txt")).toEqual({
    display: "C:/votes/e.txt",
    text: "\uFEFFcandidates A B",
  });
  expect(calls.filePaths).toEqual(["C:\\votes\\e.txt"]);
  expect(calls.stdinReads).toBe(0);
  expectNoOutput(calls);
});

test("readText uses only stdin for the exact hyphen path", () => {
  const { io, calls } = fakeIo({ stdinBytes: new Uint8Array([0x41]) });

  expect(readText(io, "-")).toEqual({ display: "<stdin>", text: "A" });
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
  expectNoOutput(calls);
});

test("readText decodes a valid multibyte UTF-8 character", () => {
  const { io, calls } = fakeIo({ fileBytes: new Uint8Array([0x63, 0x61, 0x66, 0xc3, 0xa9]) });

  expect(readText(io, "votes/e.txt")).toEqual({ display: "votes/e.txt", text: "café" });
  expect(calls.filePaths).toEqual(["votes/e.txt"]);
  expect(calls.stdinReads).toBe(0);
  expectNoOutput(calls);
});

test("readText returns line endings unchanged for splitLines to normalize later", () => {
  const { io, calls } = fakeIo({ fileBytes: utf8("A\r\nB\r") });

  expect(readText(io, "votes/e.txt").text).toBe("A\r\nB\r");
  expectNoOutput(calls);
});

test("readText converts a file-reader failure to the exact VoteError", () => {
  const { io, calls } = fakeIo({ failFile: true });
  const error = caughtVoteError(() => readText(io, "my votes/e.txt"));

  expect(error).toBeInstanceOf(VoteError);
  expect(error.message).toBe("my votes/e.txt: cannot read the file");
  expect(calls.filePaths).toEqual(["my votes/e.txt"]);
  expect(calls.stdinReads).toBe(0);
  expectNoOutput(calls);
});

test("readText converts a stdin-reader failure to the exact VoteError", () => {
  const { io, calls } = fakeIo({ failStdin: true });
  const error = caughtVoteError(() => readText(io, "-"));

  expect(error).toBeInstanceOf(VoteError);
  expect(error.message).toBe("<stdin>: cannot read the file");
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
  expectNoOutput(calls);
});

const invalidUtf8Cases = [
  { name: "a lone invalid byte", bytes: new Uint8Array([0xff]), path: "votes/e.txt" },
  {
    name: "a truncated multibyte sequence",
    bytes: new Uint8Array([0xe2, 0x82]),
    path: "votes/e.txt",
  },
  { name: "an overlong encoding", bytes: new Uint8Array([0xc0, 0xaf]), path: "votes/e.txt" },
] as const;

test.each(invalidUtf8Cases)(
  "readText rejects $name with fatal UTF-8 decoding",
  ({ bytes, path }) => {
    const { io, calls } = fakeIo({ fileBytes: bytes });
    const error = caughtVoteError(() => readText(io, path));

    expect(error).toBeInstanceOf(VoteError);
    expect(error.message).toBe("votes/e.txt: input is not valid UTF-8");
    expect(calls.filePaths).toEqual([path]);
    expect(calls.stdinReads).toBe(0);
    expectNoOutput(calls);
  },
);

test("loadElection exercises fatal stdin decoding with the specified literal malformed bytes", () => {
  const { io, calls } = fakeIo({
    stdinBytes: new Uint8Array([
      0x63, 0x61, 0x6e, 0x64, 0x69, 0x64, 0x61, 0x74, 0x65, 0x73, 0x20, 0x41, 0x20, 0x42, 0x0a,
      0x41, 0xff, 0x0a,
    ]),
  });
  const error = caughtVoteError(() => loadElection(io, "-"));

  expect(error).toBeInstanceOf(VoteError);
  expect(error.message).toBe("<stdin>: input is not valid UTF-8");
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
  expectNoOutput(calls);
});

test("loadElection reports a decode error before a grammar error", () => {
  const { io, calls } = fakeIo({ fileBytes: new Uint8Array([0x41, 0x0a, 0xff]) });
  const error = caughtVoteError(() => loadElection(io, "votes/e.txt"));

  expect(error.message).toBe("votes/e.txt: input is not valid UTF-8");
  expect(calls.filePaths).toEqual(["votes/e.txt"]);
  expectNoOutput(calls);
});

test("valid UTF-8 with an undeclared Unicode name reaches the format diagnostic", () => {
  const { io, calls } = fakeIo({ fileBytes: utf8("candidates A B\nCafé") });
  const error = caughtVoteError(() => loadElection(io, "votes/e.txt"));

  expect(error.message).toBe('votes/e.txt:2: unknown candidate "Caf?"');
  expect(calls.filePaths).toEqual(["votes/e.txt"]);
  expectNoOutput(calls);
});

test("loadElection removes one BOM and CRLF while accepting an unterminated final ballot", () => {
  const { io, calls } = fakeIo({
    fileBytes: utf8("\uFEFFcandidates A B\r\n2: B > A"),
  });

  expect(loadElection(io, "votes/e.txt")).toEqual({
    candidates: ["A", "B"],
    ballots: [{ count: 2, groups: [[1], [0]] }],
  });
  expect(calls.filePaths).toEqual(["votes/e.txt"]);
  expect(calls.stdinReads).toBe(0);
  expectNoOutput(calls);
});

test("loadElection reports no candidates for an empty file without a line number", () => {
  const { io, calls } = fakeIo({ fileBytes: utf8("") });
  const error = caughtVoteError(() => loadElection(io, "votes/e.txt"));

  expect(error.message).toBe("votes/e.txt: no candidates line");
  expect(calls.filePaths).toEqual(["votes/e.txt"]);
  expectNoOutput(calls);
});

test("loadElection reports no candidates for comments and blank lines only", () => {
  const { io, calls } = fakeIo({ fileBytes: utf8("  # comment\n \t\n# another comment\n") });
  const error = caughtVoteError(() => loadElection(io, "votes/e.txt"));

  expect(error.message).toBe("votes/e.txt: no candidates line");
  expect(calls.filePaths).toEqual(["votes/e.txt"]);
  expectNoOutput(calls);
});

test("loadElection rejects a valid declaration with no ballot line", () => {
  const { io, calls } = fakeIo({ fileBytes: utf8("candidates A B\n") });
  const error = caughtVoteError(() => loadElection(io, "votes/e.txt"));

  expect(error.message).toBe("votes/e.txt: no ballots");
  expect(calls.filePaths).toEqual(["votes/e.txt"]);
  expectNoOutput(calls);
});

test("loadElection accepts a counted blank ballot as a ballot", () => {
  const { io, calls } = fakeIo({ fileBytes: utf8("candidates A B\n1:\n") });

  expect(loadElection(io, "votes/e.txt")).toEqual({
    candidates: ["A", "B"],
    ballots: [{ count: 1, groups: [] }],
  });
  expectNoOutput(calls);
});

test("loadElection qualifies ballot errors with the original source line", () => {
  const { io, calls } = fakeIo({
    fileBytes: utf8("candidates A B\n\n# ignored\n\t\nA > X\nB > B"),
  });
  const error = caughtVoteError(() => loadElection(io, "votes/e.txt"));

  expect(error.message).toBe('votes/e.txt:5: unknown candidate "X"');
  expect(calls.filePaths).toEqual(["votes/e.txt"]);
  expectNoOutput(calls);
});

test("loadElection reports the first malformed ballot and ignores later failures", () => {
  const { io, calls } = fakeIo({ fileBytes: utf8("candidates A B\nA > X\nB > B") });
  const error = caughtVoteError(() => loadElection(io, "votes/e.txt"));

  expect(error.message).toBe('votes/e.txt:2: unknown candidate "X"');
  expectNoOutput(calls);
});

test("loadElection reports a declaration error before the no-ballot check", () => {
  const { io, calls } = fakeIo({ fileBytes: utf8("candidates A") });
  const error = caughtVoteError(() => loadElection(io, "votes/e.txt"));

  expect(error.message).toBe("votes/e.txt:1: at least 2 candidates are needed");
  expectNoOutput(calls);
});

test("loadElection normalizes only displayed Windows path separators", () => {
  const { io, calls } = fakeIo({ fileBytes: utf8("not candidates") });
  const error = caughtVoteError(() => loadElection(io, "C:\\votes\\e.txt"));

  expect(error.message).toBe('C:/votes/e.txt:1: expected a "candidates" line first');
  expect(calls.filePaths).toEqual(["C:\\votes\\e.txt"]);
  expect(calls.stdinReads).toBe(0);
  expectNoOutput(calls);
});

test("loadElection reports stdin format errors with the stdin display label", () => {
  const { io, calls } = fakeIo({ stdinBytes: utf8("candidates A B\nA > X") });
  const error = caughtVoteError(() => loadElection(io, "-"));

  expect(error.message).toBe('<stdin>:2: unknown candidate "X"');
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
  expectNoOutput(calls);
});
