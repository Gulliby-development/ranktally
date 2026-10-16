import { describe, expect, test } from "bun:test";
import type { Election, MethodFn, Outcome } from "../src/core/ballots";
import { run } from "../src/methods/rankedpairs";

function expectOutcome(election: Election, expected: Outcome): void {
  expect(run(election, 1)).toEqual(expected);
}

describe("ranked pairs", () => {
  test("matches the complete lunch-election outcome", () => {
    const election: Election = {
      candidates: ["Pizza", "Ramen", "Sushi", "Tacos", "Salad"],
      ballots: [
        { count: 7, groups: [[3], [1]] },
        { count: 7, groups: [[4], [1, 2], [3]] },
        { count: 5, groups: [[0], [2], [4], [3], [1]] },
        { count: 8, groups: [[1], [2], [3], [0], [4]] },
        { count: 4, groups: [[0]] },
        { count: 5, groups: [[0], [3], [1]] },
        { count: 3, groups: [[0]] },
        { count: 7, groups: [[2], [3], [4, 1]] },
        { count: 1, groups: [] },
      ],
    };

    expectOutcome(election, {
      winners: ["Sushi"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "Sushi", "4", "0"],
        ["2", "Tacos", "3", "1"],
        ["3", "Ramen", "2", "2"],
        ["4", "Pizza", "1", "3"],
        ["5", "Salad", "0", "4"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("returns both winners for the supplied tied election", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 1, groups: [[0], [1], [2]] },
        { count: 1, groups: [[1], [0], [2]] },
        { count: 1, groups: [[2]] },
      ],
    };

    expectOutcome(election, {
      winners: ["A", "B"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "A", "1", "0"],
        ["1", "B", "1", "0"],
        ["3", "C", "0", "2"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("keeps every candidate tied when every ballot is blank", () => {
    const election: Election = {
      candidates: ["C", "A", "B"],
      ballots: [{ count: 7, groups: [] }],
    };

    expectOutcome(election, {
      winners: ["C", "A", "B"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "C", "0", "0"],
        ["1", "A", "0", "0"],
        ["1", "B", "0", "0"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("handles partial rankings, a tied group, and a blank ballot", () => {
    const election: Election = {
      candidates: ["A", "B", "C", "D"],
      ballots: [
        { count: 4, groups: [[0, 1], [2]] },
        { count: 2, groups: [[2], [0]] },
        { count: 1, groups: [] },
      ],
    };

    expectOutcome(election, {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "A", "3", "0"],
        ["2", "B", "2", "1"],
        ["3", "C", "1", "2"],
        ["4", "D", "0", "3"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("rejects the cycle-closing edge after locking the strongest pairs", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 3, groups: [[0], [1], [2]] },
        { count: 3, groups: [[1], [2], [0]] },
        { count: 2, groups: [[2], [0], [1]] },
      ],
    };

    expectOutcome(election, {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "A", "2", "0"],
        ["2", "B", "1", "1"],
        ["3", "C", "0", "2"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("counts all candidates reached along a transitive chain", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [{ count: 4, groups: [[0], [1], [2]] }],
    };

    expectOutcome(election, {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "A", "2", "0"],
        ["2", "B", "1", "1"],
        ["3", "C", "0", "2"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("counts candidates once when a diamond has multiple routes", () => {
    const election: Election = {
      candidates: ["A", "B", "C", "D"],
      ballots: [{ count: 3, groups: [[0], [1], [2], [3]] }],
    };

    expectOutcome(election, {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "A", "3", "0"],
        ["2", "B", "2", "1"],
        ["3", "C", "1", "2"],
        ["4", "D", "0", "3"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("uses source declaration order for an equal-strength cycle", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 1, groups: [[0], [1], [2]] },
        { count: 1, groups: [[1], [2], [0]] },
        { count: 1, groups: [[2], [0], [1]] },
      ],
    };

    expectOutcome(election, {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "A", "2", "0"],
        ["2", "B", "1", "1"],
        ["3", "C", "0", "2"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("uses target declaration order for equal victories from one source", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 2, groups: [[0], [1], [2]] },
        { count: 2, groups: [[0], [2], [1]] },
      ],
    };

    expectOutcome(election, {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "A", "2", "0"],
        ["2", "B", "0", "1"],
        ["2", "C", "0", "1"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("prioritizes winning votes over a larger margin when locking a cycle", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 2, groups: [[1], [2], [0]] },
        { count: 2, groups: [[2], [0], [1]] },
        { count: 1, groups: [[0, 1], [2]] },
        { count: 2, groups: [[0, 2], [1]] },
        { count: 1, groups: [[0], [1, 2]] },
        { count: 2, groups: [[1], [0, 2]] },
      ],
    };

    // A>B and B>C each have 5 winning votes to 4; C>A has only 4 to 2.
    // Margin sorting locks C>A first and elects C, unlike the required order.
    expectOutcome(election, {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "A", "2", "0"],
        ["2", "B", "1", "1"],
        ["3", "C", "0", "2"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("uses fewer opposing votes to resolve equal winning-vote strengths", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 2, groups: [[1], [2], [0]] },
        { count: 2, groups: [[2], [0], [1]] },
        { count: 1, groups: [[0, 2], [1]] },
        { count: 2, groups: [[0], [1, 2]] },
        { count: 2, groups: [[1], [0, 2]] },
      ],
    };

    // B>C and C>A both have 4 winning votes; C>A has 2 opposing votes
    // versus 3 for B>C, so C>A must lock first and complete the cycle.
    expectOutcome(election, {
      winners: ["C"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "C", "2", "0"],
        ["2", "A", "1", "1"],
        ["3", "B", "0", "2"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("implements MethodFn and repeats identically without changing the input", () => {
    const election: Election = {
      candidates: ["A", "B"],
      ballots: [
        { count: 2, groups: [[0], [1]] },
        { count: 1, groups: [[1], [0]] },
      ],
    };
    const method: MethodFn = run;
    const before = structuredClone(election);
    const expected: Outcome = {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "A", "1", "0"],
        ["2", "B", "0", "1"],
      ],
      right: new Set([0, 2, 3]),
    };

    expect(method(election, 1)).toEqual(expected);
    expect(method(election, 11)).toEqual(expected);
    expect(method(election, 1)).toEqual(expected);
    expect(election).toEqual(before);
  });
});
