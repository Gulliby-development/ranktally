import { expect, test } from "bun:test";
import { main } from "../src/cli";
import { run as compareRun } from "../src/commands/compare";
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

function outcome(winners: string[]): Outcome {
  return {
    winners,
    tie: winners.length > 1,
    lines: [],
    header: [],
    rows: [],
    right: new Set(),
  };
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

test("compare prints the supplied lunch table exactly and reports disagreement", () => {
  const { io, calls } = fakeIo(LUNCH);

  expect(main(["compare", "lunch.txt"], io)).toBe(1);
  expect(calls.outTexts).toEqual([
    "method       winner\nplurality    Pizza\nborda        Tacos\nschulze      Sushi\nrankedpairs  Sushi\nstv          Ramen\n",
  ]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["lunch.txt"]);
  expect(calls.stdinReads).toBe(0);
});

test("compare returns success when all five methods have the same sole winner", () => {
  const { io, calls } = fakeIo("candidates A B\n3: A > B\n");

  expect(main(["compare", "votes.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual([
    "method       winner\nplurality    A\nborda        A\nschulze      A\nrankedpairs  A\nstv          A\n",
  ]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
  expect(calls.stdinReads).toBe(0);
});

test("compare runs injected methods in order with one shared election and one seat", () => {
  const { io, calls } = fakeIo("candidates A B\n2: A > B\n");
  const callOrder: string[] = [];
  const received: Array<{ election: Election; seats: number }> = [];
  const methods: Record<string, MethodFn> = {
    first(election, seats) {
      callOrder.push("first");
      received.push({ election, seats });
      return outcome(["A"]);
    },
    second(election, seats) {
      callOrder.push("second");
      received.push({ election, seats });
      return outcome(["A"]);
    },
  };

  expect(compareRun(["votes.txt"], io, methods)).toBe(0);
  expect(callOrder).toEqual(["first", "second"]);
  expect(received).toHaveLength(2);
  expect(received[0]?.seats).toBe(1);
  expect(received[1]?.seats).toBe(1);
  expect(received[0]?.election).toBe(received[1]?.election);
  expect(received[0]?.election).toEqual({
    candidates: ["A", "B"],
    ballots: [{ count: 2, groups: [[0], [1]] }],
  });
  expect(calls.filePaths).toEqual(["votes.txt"]);
  expect(calls.outTexts).toEqual(["method  winner\nfirst   A\nsecond  A\n"]);
  expect(calls.outTexts).toHaveLength(1);
  expect(calls.errTexts).toEqual([]);
});

test("compare returns one when injected methods have different sole winners", () => {
  const { io, calls } = fakeIo("candidates A B\n1: A\n");
  const methods: Record<string, MethodFn> = {
    plurality: () => outcome(["A"]),
    borda: () => outcome(["B"]),
  };

  expect(compareRun(["votes.txt"], io, methods)).toBe(1);
  expect(calls.outTexts).toEqual(["method     winner\nplurality  A\nborda      B\n"]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
});

test("identical tied winner lists still fail and retain their joined order", () => {
  const { io, calls } = fakeIo("candidates A B\n1: A\n");
  const methods: Record<string, MethodFn> = {
    first: () => outcome(["B", "A"]),
    second: () => outcome(["B", "A"]),
  };

  expect(compareRun(["votes.txt"], io, methods)).toBe(1);
  expect(calls.outTexts).toEqual(["method  winner\nfirst   B, A\nsecond  B, A\n"]);
  expect(calls.errTexts).toEqual([]);
});

test("a later VoteError propagates without output after earlier methods complete", () => {
  const { io, calls } = fakeIo("candidates A B\n1: A\n");
  const methodError = new VoteError("second method failed");
  const callOrder: string[] = [];
  const methods: Record<string, MethodFn> = {
    first() {
      callOrder.push("first");
      return outcome(["A"]);
    },
    second() {
      callOrder.push("second");
      throw methodError;
    },
  };

  const caught = caughtVoteError(() => compareRun(["votes.txt"], io, methods));

  expect(caught).toBe(methodError);
  expect(caught.message).toBe("second method failed");
  expect(callOrder).toEqual(["first", "second"]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual([]);
});

test("compare reports positional and option errors before reading a file", () => {
  const missing = fakeIo("candidates A B\n1: A\n");
  expect(main(["compare"], missing.io)).toBe(2);
  expect(missing.calls.outTexts).toEqual([]);
  expect(missing.calls.errTexts).toEqual(["ranktally: missing FILE\n"]);
  expect(missing.calls.filePaths).toEqual([]);

  const extra = fakeIo("candidates A B\n1: A\n");
  expect(main(["compare", "votes.txt", "extra"], extra.io)).toBe(2);
  expect(extra.calls.outTexts).toEqual([]);
  expect(extra.calls.errTexts).toEqual(["ranktally: too many arguments\n"]);
  expect(extra.calls.filePaths).toEqual([]);

  const option = fakeIo("candidates A B\n1: A\n");
  expect(main(["compare", "--help", "votes.txt"], option.io)).toBe(2);
  expect(option.calls.outTexts).toEqual([]);
  expect(option.calls.errTexts).toEqual(['ranktally: unknown option "--help"\n']);
  expect(option.calls.filePaths).toEqual([]);
});

test("compare uses stdin for the hyphen path and reads no file", () => {
  const { io, calls } = fakeIo("", { stdinText: "candidates A B\n2: B > A\n" });

  expect(main(["compare", "-"], io)).toBe(0);
  expect(calls.outTexts).toEqual([
    "method       winner\nplurality    B\nborda        B\nschulze      B\nrankedpairs  B\nstv          B\n",
  ]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual([]);
  expect(calls.stdinReads).toBe(1);
});

test("compare turns file read failures into one diagnostic and no partial output", () => {
  const { io, calls } = fakeIo("", { failFile: true });

  expect(main(["compare", "votes.txt"], io)).toBe(2);
  expect(calls.outTexts).toEqual([]);
  expect(calls.errTexts).toEqual(["ranktally: votes.txt: cannot read the file\n"]);
  expect(calls.filePaths).toEqual(["votes.txt"]);
  expect(calls.stdinReads).toBe(0);
});
