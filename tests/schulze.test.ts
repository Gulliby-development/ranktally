import { describe, expect, test } from "bun:test";
import type { Election, MethodFn, Outcome } from "../src/core/ballots";
import { run } from "../src/methods/schulze";

function expectOutcome(election: Election, expected: Outcome): void {
  expect(run(election, 1)).toEqual(expected);
}

describe("Schulze", () => {
  test("matches every row of the lunch election", () => {
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

  test("returns A and B as tied winners in the supplied tie election", () => {
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

  test("keeps all blank-ballot candidates tied in declaration order", () => {
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

  test("does not turn a ballot tying every candidate into a strict path", () => {
    const election: Election = {
      candidates: ["B", "C", "A"],
      ballots: [{ count: 5, groups: [[0, 1, 2]] }],
    };

    expectOutcome(election, {
      winners: ["B", "C", "A"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "B", "0", "0"],
        ["1", "C", "0", "0"],
        ["1", "A", "0", "0"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("treats omitted candidates as tied below partial rankings", () => {
    const election: Election = {
      candidates: ["A", "B", "C", "D"],
      ballots: [
        { count: 2, groups: [[0]] },
        { count: 1, groups: [[1], [2]] },
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

  test("finds a strict winner in a two-candidate election", () => {
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

  test("leaves an equal-strength Condorcet cycle tied", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 1, groups: [[0], [1], [2]] },
        { count: 1, groups: [[1], [2], [0]] },
        { count: 1, groups: [[2], [0], [1]] },
      ],
    };

    expectOutcome(election, {
      winners: ["A", "B", "C"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "wins", "losses"],
      rows: [
        ["1", "A", "0", "0"],
        ["1", "B", "0", "0"],
        ["1", "C", "0", "0"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("uses an indirect path to break an unequal-strength cycle", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 4, groups: [[0], [1], [2]] },
        { count: 2, groups: [[0], [2], [1]] },
        { count: 1, groups: [[1], [0], [2]] },
        { count: 2, groups: [[1], [2], [0]] },
        { count: 2, groups: [[2], [0], [1]] },
        { count: 2, groups: [[2], [1], [0]] },
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

  test("propagates a strongest path through multiple intermediate candidates", () => {
    const election: Election = {
      candidates: ["A", "B", "C", "D"],
      ballots: [
        { count: 5, groups: [[0], [1], [2], [3]] },
        { count: 4, groups: [[1], [2], [3], [0]] },
        { count: 4, groups: [[2], [3], [0], [1]] },
        { count: 1, groups: [[3], [0], [1], [2]] },
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
});
