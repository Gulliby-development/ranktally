import { expect, test } from "bun:test";
import { main } from "../src/cli";
import { run as tallyRun } from "../src/commands/tally";
import { type Election, type MethodFn, type Outcome, VoteError } from "../src/core/ballots";
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

const TIE = `candidates A B C
1: A > B > C
1: B > A > C
1: C
`;

function fakeIo(
  fileText = "",
  options: { stdinText?: string; failFile?: boolean; failStdin?: boolean } = {},
) {
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
        throw new Error("file read failed");
      }
      return new TextEncoder().encode(fileText);
    },
    readStdin() {
      calls.stdinReads += 1;
      if (options.failStdin) {
        throw new Error("stdin read failed");
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

test("tally plurality prints the complete lunch result with counted blank ballots", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["tally", "plurality", "lunch.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual([
    "method: plurality\nballots: 47\nwinner: Pizza\n\nrank  candidate  votes  share%\n   1  Pizza         17    36.2\n   2  Ramen          8    17.0\n   3  Sushi          7    14.9\n   3  Tacos          7    14.9\n   3  Salad          7    14.9\n",
  ]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["lunch.txt"]);
  expect(calls.stdinReads).toBe(0);
});

test("tally Schulze copies the supplied lunch output exactly", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["tally", "schulze", "lunch.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual([
    "method: schulze\nballots: 47\nwinner: Sushi\n\nrank  candidate  wins  losses\n   1  Sushi         4       0\n   2  Tacos         3       1\n   3  Ramen         2       2\n   4  Pizza         1       3\n   5  Salad         0       4\n",
  ]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["lunch.txt"]);
});

test("tally two-seat STV copies the supplied lunch round table exactly", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["tally", "stv", "--seats", "2", "lunch.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual([
    "method: stv\nballots: 47\nseats: 2\nquota: 16\nelected: Pizza, Ramen\n\nround  action           Pizza  Ramen  Sushi  Tacos  Salad\n    1  elect Pizza      17.00   8.00   7.00   7.00   7.00\n    2  eliminate Salad      -   8.00   7.29   7.29   7.00\n    3  eliminate Tacos      -   8.00   7.29   7.29      -\n    4  eliminate Sushi      -  15.29   7.29      -      -\n    5  fill Ramen           -  29.59      -      -      -\n",
  ]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["lunch.txt"]);
});

test("winner-only retains tied candidates in table order and returns status one", () => {
  const { io, calls } = fakeIo(TIE);

  expect(main(["tally", "schulze", "--winner-only", "tie.txt"], io)).toBe(1);
  expect(calls.outTexts).toEqual(["winners: A, B (tie)\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["tie.txt"]);
});

test("a single-winner winner-only result contains no metadata or table", () => {
  const { io, calls } = fakeIo("candidates A B\n1: B > A\n");

  expect(main(["tally", "plurality", "--winner-only", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["winner: B\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});

test("one-seat STV uses the singular winner result", () => {
  const { io, calls } = fakeIo("candidates A B\n2: A\n1: B\n");

  expect(main(["tally", "stv", "--winner-only", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["winner: A\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});

test("multi-seat STV winner-only uses elected and excludes the table", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["tally", "stv", "--seats", "2", "--winner-only", "lunch.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["elected: Pizza, Ramen\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["lunch.txt"]);
});

test("blank ballots are included in plurality totals and shares", () => {
  const { io, calls } = fakeIo("candidates A B\n3:\n1: B\n");

  expect(main(["tally", "plurality", "blank.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual([
    "method: plurality\nballots: 4\nwinner: B\n\nrank  candidate  votes  share%\n   1  B              1    25.0\n   2  A              0     0.0\n",
  ]);
  expect(calls.errTexts).toEqual([]);
});

test("winner-only multi-seat output still follows the method's winner order", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["tally", "stv", "--seats=2", "--winner-only", "lunch.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["elected: Pizza, Ramen\n"]);
  expect(calls.errTexts).toEqual([]);
});

test("the hyphen path reads stdin without touching files", () => {
  const { io, calls } = fakeIo("", { stdinText: "candidates A B\n1: A\n" });

  expect(main(["tally", "plurality", "--winner-only", "-"], io)).toBe(0);
  expect(calls.outTexts).toEqual(["winner: A\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
});

test("missing method diagnostic is exact and performs no read", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["tally"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: missing METHOD\n"]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(0);
});

test("unknown method diagnostic is exact and precedes a missing file", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["tally", "not-a-method"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([
    'ranktally: unknown method "not-a-method" (expected plurality, borda, schulze, rankedpairs or stv)\n',
  ]);
  expect(calls.filePaths).toEqual([]);
});

test("an inherited method property is rejected as an unknown method", () => {
  const { io, calls } = fakeIo("candidates A B\n1: A\n");

  expect(() => tallyRun(["toString", "votes.txt"], io, {})).toThrow(
    'unknown method "toString" (expected )',
  );
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual([]);
});

test("invalid STV seat count from the option parser fails before any file read", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["tally", "stv", "--seats", "0", "lunch.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([
    'ranktally: invalid --seats "0" (expected an integer from 1 to 11)\n',
  ]);
  expect(calls.filePaths).toEqual([]);
});

test("candidate-dependent STV seat validation happens after loading", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["tally", "stv", "--seats", "5", "lunch.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([
    'ranktally: invalid --seats "5" (expected an integer from 1 to 4)\n',
  ]);
  expect(calls.filePaths).toEqual(["lunch.txt"]);
});

test("the worked Pasta error reports line four and leaves stdout empty", () => {
  const modifiedLunch = LUNCH.replace("7: Tacos > Ramen", "3: Pizza > Pasta");
  const { io, calls } = fakeIo(modifiedLunch);

  expect(main(["tally", "borda", "lunch.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(['ranktally: lunch.txt:4: unknown candidate "Pasta"\n']);
  expect(calls.filePaths).toEqual(["lunch.txt"]);
});

test("an injected method receives the loaded election and seats and renders its outcome atomically", () => {
  const { io, calls } = fakeIo("candidates A B\n2: B > A\n");
  const received: Array<{ election: Election; seats: number }> = [];
  const expectedElection: Election = {
    candidates: ["A", "B"],
    ballots: [{ count: 2, groups: [[1], [0]] }],
  };
  const outcome: Outcome = {
    winners: ["B", "A"],
    tie: true,
    lines: ["details: checked"],
    header: ["rank", "candidate", "points"],
    rows: [
      ["1", "B", "12"],
      ["2", "A", "4"],
    ],
    right: new Set([0, 2]),
  };
  const methods: Record<string, MethodFn> = {
    injected(election, seats) {
      received.push({ election, seats });
      return outcome;
    },
  };

  expect(tallyRun(["injected", "votes.txt"], io, methods)).toBe(1);
  expect(received).toEqual([{ election: expectedElection, seats: 1 }]);
  expect(calls.outTexts).toEqual([
    "method: injected\nballots: 2\ndetails: checked\nwinners: B, A (tie)\n\nrank  candidate  points\n   1  B              12\n   2  A               4\n",
  ]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});

test("a VoteError from the selected method leaves stdout empty", () => {
  const { io, calls } = fakeIo("candidates A B\n1: A\n");
  const methodError = new VoteError("method failed");
  const methods: Record<string, MethodFn> = {
    injected() {
      throw methodError;
    },
  };

  expect(() => tallyRun(["injected", "votes.txt"], io, methods)).toThrow(methodError);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});
