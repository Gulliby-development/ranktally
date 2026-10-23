import { expect, test } from "bun:test";
import { main } from "../src/cli";
import { run as pairwiseRun } from "../src/commands/pairwise";
import { VoteError } from "../src/core/ballots";
import type { Io } from "../src/formats/files";

const LUNCH = `# lunch vote
candidates Pizza Ramen Sushi Tacos Salad

7: Tacos > Ramen
7: Salad > Ramen = Sushi > Tacos
5: Pizza > Sushi > Salad > Tacos > Ramen
8: Ramen > Sushi > Tacos > Pizza > Salad
4: Pizza
5: Pizza > Tacos > Ramen
3: Pizza
7: Sushi > Tacos > Salad = Ramen
1:
`;

interface FakeIoOptions {
  stdinText?: string;
  failFile?: boolean;
  failStdin?: boolean;
}

function fakeIo(fileText = "", options: FakeIoOptions = {}) {
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
      return new TextEncoder().encode(fileText);
    },
    readStdin() {
      calls.stdinReads += 1;
      if (options.failStdin) {
        throw new Error("stdin reader failed");
      }
      return new TextEncoder().encode(options.stdinText ?? "");
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

test("pairwise prints the supplied lunch margins table exactly", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["pairwise", "--margins", "lunch.txt"], io)).toBe(1);
  expect(calls.outTexts).toEqual([
    "vs     Pizza  Ramen  Sushi  Tacos  Salad\n" +
      "Pizza      .    -12     -5    -12     11\n" +
      "Ramen     12      .      8     -9      8\n" +
      "Sushi      5     -8      .     15     13\n" +
      "Tacos     12      9    -15      .     15\n" +
      "Salad    -11     -8    -13    -15      .\n" +
      "\n" +
      "condorcet winner: none\n" +
      "condorcet loser: Salad\n",
  ]);
  expect(calls.outTexts).toHaveLength(1);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["lunch.txt"]);
  expect(calls.stdinReads).toBe(0);
});

test("pairwise displays weighted raw counts in candidate order with dot diagonals", () => {
  const { io, calls } = fakeIo("candidates A B C\n3: C > A > B\n2: A > B > C\n4: C > B > A\n");

  expect(main(["pairwise", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual([
    "vs  A  B  C\n" +
      "A   .  5  2\n" +
      "B   4  .  2\n" +
      "C   7  7  .\n" +
      "\n" +
      "condorcet winner: C\n" +
      "condorcet loser: B\n",
  ]);
  expect(calls.outTexts).toHaveLength(1);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});

test("pairwise margins preserve positive, negative and zero values", () => {
  const { io, calls } = fakeIo("candidates A B C\n2: A > B\n2: B > A\n");

  expect(main(["pairwise", "--margins", "votes.txt"], io)).toBe(1);
  expect(calls.outTexts).toEqual([
    "vs   A   B  C\n" +
      "A    .   0  4\n" +
      "B    0   .  4\n" +
      "C   -4  -4  .\n" +
      "\n" +
      "condorcet winner: none\n" +
      "condorcet loser: C\n",
  ]);
  expect(calls.outTexts).toHaveLength(1);
  expect(calls.errTexts).toEqual([]);
});

test("pairwise reports no strict winner or loser for a Condorcet cycle", () => {
  const { io, calls } = fakeIo("candidates A B C\nA > B > C\nB > C > A\nC > A > B\n");

  expect(main(["pairwise", "cycle.txt"], io)).toBe(1);
  expect(calls.outTexts).toEqual([
    "vs  A  B  C\n" +
      "A   .  2  1\n" +
      "B   1  .  2\n" +
      "C   2  1  .\n" +
      "\n" +
      "condorcet winner: none\n" +
      "condorcet loser: none\n",
  ]);
  expect(calls.errTexts).toEqual([]);
});

test("blank ballots leave every pair tied and report neither Condorcet result", () => {
  const { io, calls } = fakeIo("candidates A B\n5:\n");

  expect(main(["pairwise", "blank.txt"], io)).toBe(1);
  expect(calls.outTexts).toEqual([
    "vs  A  B\n" +
      "A   .  0\n" +
      "B   0  .\n" +
      "\n" +
      "condorcet winner: none\n" +
      "condorcet loser: none\n",
  ]);
  expect(calls.errTexts).toEqual([]);
});

test("pairwise reads standard input for the hyphen path only", () => {
  const { io, calls } = fakeIo("", { stdinText: "candidates A B\n2: B > A\n" });

  expect(main(["pairwise", "-"], io)).toBe(0);
  expect(calls.outTexts).toEqual([
    "vs  A  B\n" +
      "A   .  0\n" +
      "B   2  .\n" +
      "\n" +
      "condorcet winner: B\n" +
      "condorcet loser: A\n",
  ]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
});

test("pairwise checks missing and extra FILE before reading", () => {
  const missing = fakeIo("candidates A B\n1: A\n");

  expect(main(["pairwise"], missing.io)).toBe(2);
  expect(missing.calls.outTexts).toEqual([]);
  expect(missing.calls.errTexts).toEqual(["ranktally: missing FILE\n"]);
  expect(missing.calls.filePaths).toEqual([]);
  expect(missing.calls.stdinReads).toBe(0);

  const extra = fakeIo("candidates A B\n1: A\n");

  expect(main(["pairwise", "votes.txt", "extra"], extra.io)).toBe(2);
  expect(extra.calls.outTexts).toEqual([]);
  expect(extra.calls.errTexts).toEqual(["ranktally: too many arguments\n"]);
  expect(extra.calls.filePaths).toEqual([]);
  expect(extra.calls.stdinReads).toBe(0);
});

test("pairwise option errors precede positional validation and file access", () => {
  const { io, calls } = fakeIo("candidates A B\n1: A\n");

  expect(main(["pairwise", "--winner-only"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(['ranktally: unknown option "--winner-only"\n']);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(0);
});

test("direct pairwise command propagates its VoteError without writing output", () => {
  const { io, calls } = fakeIo("candidates A B\n1: A\n");

  const error = caughtVoteError(() => pairwiseRun([], io));

  expect(error.message).toBe("missing FILE");
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(0);
});

test("pairwise converts file read failure to a diagnostic without partial output", () => {
  const { io, calls } = fakeIo("", { failFile: true });

  expect(main(["pairwise", "votes.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: votes.txt: cannot read the file\n"]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
  expect(calls.stdinReads).toBe(0);
});

const LUNCH_PERCENT =
  "vs     Pizza  Ramen  Sushi  Tacos  Salad\n" +
  "Pizza      .   36.2   36.2   36.2   53.2\n" +
  "Ramen   61.7      .   42.6   31.9   42.6\n" +
  "Sushi   46.8   25.5      .   57.4   42.6\n" +
  "Tacos   61.7   51.1   25.5      .   57.4\n" +
  "Salad   29.8   25.5   14.9   25.5      .\n" +
  "\n" +
  "condorcet winner: none\n" +
  "condorcet loser: Salad\n";

const LUNCH_MARGIN_PERCENT =
  "vs     Pizza  Ramen  Sushi  Tacos  Salad\n" +
  "Pizza      .  -25.5  -10.6  -25.5   23.4\n" +
  "Ramen   25.5      .   17.0  -19.1   17.0\n" +
  "Sushi   10.6  -17.0      .   31.9   27.7\n" +
  "Tacos   25.5   19.1  -31.9      .   31.9\n" +
  "Salad  -23.4  -17.0  -27.7  -31.9      .\n" +
  "\n" +
  "condorcet winner: none\n" +
  "condorcet loser: Salad\n";

test("pairwise --percent prints the lunch counts as percentages of 47 ballots", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["pairwise", "--percent", "lunch.txt"], io)).toBe(1);
  expect(calls.outTexts).toEqual([LUNCH_PERCENT]);
  expect(calls.errTexts).toEqual([]);
});

test("pairwise --margins --percent prints signed margins as percentages", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["pairwise", "--margins", "--percent", "lunch.txt"], io)).toBe(1);
  expect(calls.outTexts).toEqual([LUNCH_MARGIN_PERCENT]);
  expect(calls.errTexts).toEqual([]);
});

test("pairwise percentages round half up to one decimal", () => {
  const counts = fakeIo("candidates A B\n1: A > B\n15: B > A\n");

  expect(main(["pairwise", "--percent", "votes.txt"], counts.io)).toBe(0);
  expect(counts.calls.outTexts).toEqual([
    "vs     A    B\n" +
      "A      .  6.3\n" +
      "B   93.8    .\n" +
      "\n" +
      "condorcet winner: B\n" +
      "condorcet loser: A\n",
  ]);

  const margins = fakeIo("candidates A B\n1: A > B\n15: B > A\n");

  expect(main(["pairwise", "--margins", "--percent", "votes.txt"], margins.io)).toBe(0);
  expect(margins.calls.outTexts).toEqual([
    "vs     A      B\n" +
      "A      .  -87.5\n" +
      "B   87.5      .\n" +
      "\n" +
      "condorcet winner: B\n" +
      "condorcet loser: A\n",
  ]);
});

test("a margin percentage that rounds to 0.0 has no minus sign", () => {
  const { io, calls } = fakeIo("candidates A B\n1501: A > B\n1500: B > A\n");

  expect(main(["pairwise", "--margins", "--percent", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual([
    "vs    A    B\n" +
      "A     .  0.0\n" +
      "B   0.0    .\n" +
      "\n" +
      "condorcet winner: A\n" +
      "condorcet loser: B\n",
  ]);
});

test("blank ballots count in the total of --percent", () => {
  const { io, calls } = fakeIo("candidates A B\n3: A > B\n1:\n");

  expect(main(["pairwise", "--percent", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual([
    "vs    A     B\n" +
      "A     .  75.0\n" +
      "B   0.0     .\n" +
      "\n" +
      "condorcet winner: A\n" +
      "condorcet loser: B\n",
  ]);
});

test("pairwise accepts --percent and --margins in any order, repeated, after the file", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["pairwise", "--percent", "lunch.txt", "--margins", "--percent"], io)).toBe(1);
  expect(calls.outTexts).toEqual([LUNCH_MARGIN_PERCENT]);
  expect(calls.errTexts).toEqual([]);
});

test("--percent is a flag of pairwise only", () => {
  const withValue = fakeIo(LUNCH);

  expect(main(["pairwise", "--percent=1", "lunch.txt"], withValue.io)).toBe(2);
  expect(withValue.calls.outTexts).toEqual([]);
  expect(withValue.calls.errTexts).toEqual(['ranktally: unknown option "--percent=1"\n']);
  expect(withValue.calls.filePaths).toEqual([]);

  const tally = fakeIo(LUNCH);

  expect(main(["tally", "--percent", "plurality", "lunch.txt"], tally.io)).toBe(2);
  expect(tally.calls.outTexts).toEqual([]);
  expect(tally.calls.errTexts).toEqual(['ranktally: unknown option "--percent"\n']);
  expect(tally.calls.filePaths).toEqual([]);
});
