import { expect, test } from "bun:test";
import { main, USAGE } from "../src/cli";
import type { run as compareRun } from "../src/commands/compare";
import { run as pairwiseRun } from "../src/commands/pairwise";
import type { run as tallyRun } from "../src/commands/tally";
import { type MethodFn, VoteError } from "../src/core/ballots";
import type { Io } from "../src/formats/files";

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

type TallyRunContract = Assert<
  Equal<typeof tallyRun, (argv: string[], io: Io, methods: Record<string, MethodFn>) => number>
>;
type CompareRunContract = Assert<
  Equal<typeof compareRun, (argv: string[], io: Io, methods: Record<string, MethodFn>) => number>
>;
type PairwiseRunContract = Assert<Equal<typeof pairwiseRun, (argv: string[], io: Io) => number>>;
type MainContract = Assert<Equal<typeof main, (argv: string[], io: Io) => number>>;
type UsageContract = Assert<typeof USAGE extends string ? true : false>;

const SIMPLE_ELECTION = "candidates A B\nA > B\n";
const METHOD_NAMES = "plurality, borda, schulze, rankedpairs or stv";

interface FakeIoOptions {
  fileText?: string;
  fileBytes?: Uint8Array;
  stdinText?: string;
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
      return options.fileBytes ?? new TextEncoder().encode(options.fileText ?? SIMPLE_ELECTION);
    },
    readStdin() {
      calls.stdinReads += 1;
      if (options.failStdin) {
        throw new Error("stdin reader failed");
      }
      return options.stdinBytes ?? new TextEncoder().encode(options.stdinText ?? SIMPLE_ELECTION);
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

function expectError(argv: string[], message: string): void {
  const { io, calls } = fakeIo();

  expect(main(argv, io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([`ranktally: ${message}\n`]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(0);
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

test("the command run signatures and exact usage contract are public", () => {
  const contracts: [
    TallyRunContract,
    CompareRunContract,
    PairwiseRunContract,
    MainContract,
    UsageContract,
  ] = [true, true, true, true, true];

  expect(contracts).toEqual([true, true, true, true, true]);
  expect(USAGE).toBe(
    "usage: ranktally tally [--seats N] [--winner-only] METHOD FILE\n" +
      "       ranktally compare FILE\n" +
      "       ranktally pairwise [--margins] FILE",
  );
});

test("sole-argument help prints exactly three LF-terminated lines", () => {
  const { io, calls } = fakeIo();

  expect(main(["--help"], io)).toBe(0);
  expect(calls.outTexts).toEqual([`${USAGE}\n`]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(0);
});

test("empty argv reports a missing command", () => {
  expectError([], "missing command (tally, compare or pairwise)");
});

test("help is not special when it is not the sole argument", () => {
  expectError(["--help", "tally"], 'unknown command "--help"');
});

const inheritedCommandCases = [
  { command: "constructor", message: 'unknown command "constructor"' },
  { command: "toString", message: 'unknown command "toString"' },
  { command: "__proto__", message: 'unknown command "__proto__"' },
] as const;

test.each(inheritedCommandCases)(
  "dispatch rejects inherited command $command",
  ({ command, message }) => {
    expectError([command], message);
  },
);

test("unknown command names sanitize Unicode and control characters", () => {
  expectError(["bad\né"], 'unknown command "bad??"');
});

test("the command diagnostic renders the literal ARG token", () => {
  expectError(["ARG"], 'unknown command "ARG"');
});

test("tally reports missing METHOD before considering a file", () => {
  expectError(["tally"], "missing METHOD");
});

test("tally rejects an unknown method before missing FILE", () => {
  expectError(["tally", "bogus"], `unknown method "bogus" (expected ${METHOD_NAMES})`);
});

const inheritedMethodCases = ["constructor", "toString", "__proto__"] as const;

test.each(inheritedMethodCases)("tally rejects inherited method %s", (method) => {
  expectError(["tally", method], `unknown method "${method}" (expected ${METHOD_NAMES})`);
});

test("tally sanitizes Unicode in an unknown method name", () => {
  expectError(["tally", "vøte"], `unknown method "v?te" (expected ${METHOD_NAMES})`);
});

test("tally reports missing FILE after validating METHOD", () => {
  expectError(["tally", "plurality"], "missing FILE");
});

test("tally rejects extra positional arguments before reading", () => {
  expectError(["tally", "plurality", "votes.txt", "extra"], "too many arguments");
});

test("tally accepts equals-form seats and an interleaved winner-only flag", () => {
  const { io, calls } = fakeIo();

  expect(main(["tally", "--seats=2", "--winner-only", "plurality", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["winner: A\n"]);
  expect(calls.outTexts).toHaveLength(1);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
  expect(calls.stdinReads).toBe(0);
});

test("a valid repeated seats value replaces an invalid earlier value", () => {
  const { io, calls } = fakeIo();

  expect(
    main(["tally", "--seats=0", "--seats", "1", "--winner-only", "plurality", "votes.txt"], io),
  ).toBe(0);
  expect(calls.outTexts).toEqual(["winner: A\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});

test("options may follow positionals and the lone hyphen remains the stdin path", () => {
  const { io, calls } = fakeIo({ stdinText: SIMPLE_ELECTION });

  expect(main(["tally", "plurality", "-", "--winner-only"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["winner: A\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
});

const wrongCommandOptionCases = [
  { argv: ["tally", "--margins"], message: 'unknown option "--margins"' },
  { argv: ["compare", "--seats=1"], message: 'unknown option "--seats=1"' },
  { argv: ["pairwise", "--winner-only"], message: 'unknown option "--winner-only"' },
] as const;

test.each(wrongCommandOptionCases)(
  "commands reject options owned by another command",
  ({ argv, message }) => {
    expectError([...argv], message);
  },
);

const unknownOptionCases = [
  { option: "--help", message: 'unknown option "--help"' },
  { option: "--", message: 'unknown option "--"' },
  { option: "-x", message: 'unknown option "-x"' },
  { option: "--winner-only=true", message: 'unknown option "--winner-only=true"' },
] as const;

test.each(unknownOptionCases)(
  "tally rejects unknown option form $option",
  ({ option, message }) => {
    expectError(["tally", option], message);
  },
);

test("a terminal integer option reports that it needs a value", () => {
  expectError(["tally", "--seats"], "--seats needs a value");
});

test("integer options consume a dash-prefixed next token as the value", () => {
  expectError(
    ["tally", "--seats", "--winner-only", "plurality", "votes.txt"],
    'invalid --seats "--winner-only" (expected an integer from 1 to 11)',
  );
});

const invalidSeatsCases = [
  { value: "0", message: 'invalid --seats "0" (expected an integer from 1 to 11)' },
  { value: "12", message: 'invalid --seats "12" (expected an integer from 1 to 11)' },
  { value: "-0", message: 'invalid --seats "-0" (expected an integer from 1 to 11)' },
  { value: "+3", message: 'invalid --seats "+3" (expected an integer from 1 to 11)' },
  { value: "007", message: 'invalid --seats "007" (expected an integer from 1 to 11)' },
  {
    value: "not-a-number",
    message: 'invalid --seats "not-a-number" (expected an integer from 1 to 11)',
  },
] as const;

test.each(invalidSeatsCases)(
  "invalid seats value $value is rejected before reading",
  ({ value, message }) => {
    expectError(["tally", `--seats=${value}`, "plurality", "votes.txt"], message);
  },
);

test("the integer diagnostic renders the literal VALUE token", () => {
  expectError(
    ["tally", "--seats=VALUE", "plurality", "votes.txt"],
    'invalid --seats "VALUE" (expected an integer from 1 to 11)',
  );
});

test("unknown options encountered during scanning precede deferred integer validation", () => {
  expectError(
    ["tally", "--seats=0", "--bogus", "plurality", "votes.txt"],
    'unknown option "--bogus"',
  );
});

test("a later missing integer value precedes deferred validation of an earlier value", () => {
  expectError(["tally", "--seats=0", "--seats"], "--seats needs a value");
});

test("deferred integer validation precedes tally positional checks", () => {
  expectError(["tally", "--seats=0"], 'invalid --seats "0" (expected an integer from 1 to 11)');
});

test("compare reports missing FILE", () => {
  expectError(["compare"], "missing FILE");
});

test("compare rejects extra arguments before reading", () => {
  expectError(["compare", "votes.txt", "extra"], "too many arguments");
});

test("pairwise reports missing FILE", () => {
  expectError(["pairwise"], "missing FILE");
});

test("pairwise rejects extra arguments before reading", () => {
  expectError(["pairwise", "votes.txt", "extra"], "too many arguments");
});

test("the original Windows path reaches Io while diagnostics normalize its slashes", () => {
  const { io, calls } = fakeIo({ fileText: "not candidates" });

  expect(main(["tally", "plurality", "C:\\votes\\e.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([
    'ranktally: C:/votes/e.txt:1: expected a "candidates" line first\n',
  ]);
  expect(calls.filePaths).toEqual(["C:\\votes\\e.txt"]);
  expect(calls.stdinReads).toBe(0);
});

test("commands read stdin for exactly the hyphen path", () => {
  const { io, calls } = fakeIo({ stdinText: SIMPLE_ELECTION });

  expect(main(["tally", "plurality", "-", "--winner-only"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["winner: A\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
});

test("a file reader failure becomes the exact diagnostic without output", () => {
  const { io, calls } = fakeIo({ failFile: true });

  expect(main(["tally", "plurality", "votes.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: votes.txt: cannot read the file\n"]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
  expect(calls.stdinReads).toBe(0);
});

test("a stdin reader failure uses the stdin display path", () => {
  const { io, calls } = fakeIo({ failStdin: true });

  expect(main(["pairwise", "-"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: <stdin>: cannot read the file\n"]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
});

test("invalid UTF-8 from a file is rejected without partial output", () => {
  const { io, calls } = fakeIo({ fileBytes: new Uint8Array([0x63, 0xff]) });

  expect(main(["tally", "plurality", "votes.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: votes.txt: input is not valid UTF-8\n"]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});

test("the specified malformed UTF-8 stdin bytes reach the real shared decoding path", () => {
  const { io, calls } = fakeIo({
    stdinBytes: new Uint8Array([
      0x63, 0x61, 0x6e, 0x64, 0x69, 0x64, 0x61, 0x74, 0x65, 0x73, 0x20, 0x41, 0x20, 0x42, 0x0a,
      0x41, 0xff, 0x0a,
    ]),
  });

  expect(main(["tally", "plurality", "-"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: <stdin>: input is not valid UTF-8\n"]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
});

test("empty election input reports no candidates without a line number", () => {
  const { io, calls } = fakeIo({ fileText: "" });

  expect(main(["pairwise", "votes.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: votes.txt: no candidates line\n"]);
});

test("comments and blank lines without a declaration report no candidates", () => {
  const { io, calls } = fakeIo({ fileText: "  # comment\n \t\n# another comment\n" });

  expect(main(["pairwise", "votes.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: votes.txt: no candidates line\n"]);
});

test("a declaration with no ballot line reports no ballots", () => {
  const { io, calls } = fakeIo({ fileText: "candidates A B\n" });

  expect(main(["tally", "plurality", "votes.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: votes.txt: no ballots\n"]);
});

const electionFormatCases = [
  {
    name: "a non-candidates first line",
    fileText: "not candidates",
    message: 'votes.txt:1: expected a "candidates" line first',
  },
  {
    name: "an invalid candidate name",
    fileText: "candidates A café\nA",
    message: 'votes.txt:1: invalid candidate name "caf?"',
  },
  {
    name: "a duplicate candidate",
    fileText: "candidates A A\nA",
    message: 'votes.txt:1: duplicate candidate "A"',
  },
  {
    name: "too few candidates",
    fileText: "candidates A\nA",
    message: "votes.txt:1: at least 2 candidates are needed",
  },
  {
    name: "too many candidates",
    fileText: "candidates A B C D E F G H I J K L M\nA",
    message: "votes.txt:1: at most 12 candidates are allowed",
  },
  {
    name: "an invalid zero ballot count",
    fileText: "candidates A B\n0: A",
    message: 'votes.txt:2: invalid ballot count "0"',
  },
  {
    name: "a ballot count with a leading zero",
    fileText: "candidates A B\n01: A",
    message: 'votes.txt:2: invalid ballot count "01"',
  },
  {
    name: "a ballot count over six digits",
    fileText: "candidates A B\n1000000: A",
    message: 'votes.txt:2: invalid ballot count "1000000"',
  },
  {
    name: "an empty ranking group",
    fileText: "candidates A B\nA > > B",
    message: "votes.txt:2: empty name in ranking",
  },
  {
    name: "an unknown ballot candidate",
    fileText: "candidates A B\nA > X",
    message: 'votes.txt:2: unknown candidate "X"',
  },
  {
    name: "an unknown Unicode ballot candidate",
    fileText: "candidates A B\nA > café",
    message: 'votes.txt:2: unknown candidate "caf?"',
  },
  {
    name: "a candidate repeated on a ballot",
    fileText: "candidates A B\nA > A",
    message: 'votes.txt:2: candidate "A" is ranked twice',
  },
] as const;

test.each(electionFormatCases)(
  "CLI preserves the format error for $name",
  ({ fileText, message }) => {
    const { io, calls } = fakeIo({ fileText });

    expect(main(["tally", "plurality", "votes.txt"], io)).toBe(2);
    expect(calls.outTexts).toEqual([]);
    expect(calls.errTexts).toEqual([`ranktally: ${message}\n`]);
    expect(calls.filePaths).toEqual(["votes.txt"]);
    expect(calls.stdinReads).toBe(0);
  },
);

test("ballot format errors preserve their original source line number", () => {
  const { io, calls } = fakeIo({ fileText: "candidates A B\n\n# ignored\nA > X\n" });

  expect(main(["pairwise", "votes.txt"], io)).toBe(2);
  expect(calls.errTexts).toEqual(['ranktally: votes.txt:4: unknown candidate "X"\n']);
  expect(calls.outTexts).toEqual([]);
});

test("file loading errors precede the candidate-dependent STV seat check", () => {
  const { io, calls } = fakeIo({ fileText: "not candidates" });

  expect(main(["tally", "--seats=11", "stv", "votes.txt"], io)).toBe(2);
  expect(calls.errTexts).toEqual(['ranktally: votes.txt:1: expected a "candidates" line first\n']);
  expect(calls.filePaths).toEqual(["votes.txt"]);
  expect(calls.outTexts).toEqual([]);
});

const invalidCandidateSeatCases = [
  { seats: "2", message: 'invalid --seats "2" (expected an integer from 1 to 1)' },
  { seats: "11", message: 'invalid --seats "11" (expected an integer from 1 to 1)' },
] as const;

test.each(invalidCandidateSeatCases)(
  "STV rejects seats $seats after loading two candidates",
  ({ seats, message }) => {
    const { io, calls } = fakeIo({ fileText: SIMPLE_ELECTION });

    expect(main(["tally", `--seats=${seats}`, "stv", "votes.txt"], io)).toBe(2);
    expect(calls.outTexts).toEqual([]);
    expect(calls.errTexts).toEqual([`ranktally: ${message}\n`]);
    expect(calls.filePaths).toEqual(["votes.txt"]);
  },
);

test("a valid non-STV seats value is ignored when there are only two candidates", () => {
  const { io, calls } = fakeIo();

  expect(main(["tally", "--seats=11", "--winner-only", "plurality", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["winner: A\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});

test("candidate, ballot-count and name-length upper boundaries are accepted", () => {
  const { io, calls } = fakeIo({
    fileText:
      "candidates ABCDEFGHIJKLMNOPQRST B C D E F G H I J K L\n999999: ABCDEFGHIJKLMNOPQRST > B\n",
  });

  expect(main(["tally", "--winner-only", "plurality", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["winner: ABCDEFGHIJKLMNOPQRST\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});

test("STV elects exactly 11 seats when 12 candidates are available", () => {
  const { io, calls } = fakeIo({
    fileText: "candidates A B C D E F G H I J K L\n1: A\n",
  });

  expect(main(["tally", "--seats=11", "--winner-only", "stv", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["elected: A, B, C, D, E, F, G, H, I, J, K\n"]);
  expect(calls.errTexts).toEqual([]);
});

test("one leading BOM, CRLF and an unterminated last ballot are normalized", () => {
  const { io, calls } = fakeIo({
    fileBytes: new TextEncoder().encode("\uFEFFcandidates A B\r\nA > B"),
  });

  expect(main(["tally", "--winner-only", "plurality", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["winner: A\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});

test("direct command validation propagates VoteError without writing output", () => {
  const { io, calls } = fakeIo();
  const error = caughtVoteError(() => pairwiseRun([], io));

  expect(error.message).toBe("missing FILE");
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(0);
});

test("main writes one VoteError diagnostic and returns status two", () => {
  const { io, calls } = fakeIo();

  expect(main(["tally"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: missing METHOD\n"]);
  expect(calls.errTexts).toHaveLength(1);
});
