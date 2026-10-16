import { describe, expect, test } from "bun:test";
import type { Election, MethodFn, Outcome } from "../src/core/ballots";
import { run } from "../src/methods/borda";

function expectOutcome(election: Election, expected: Outcome): void {
  expect(run(election, 1)).toEqual(expected);
}

describe("Borda", () => {
  test("matches the complete lunch election outcome", () => {
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
      winners: ["Tacos"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "points"],
      rows: [
        ["1", "Tacos", "92"],
        ["2", "Ramen", "84"],
        ["3", "Sushi", "81"],
        ["4", "Pizza", "76"],
        ["5", "Salad", "45"],
      ],
      right: new Set([0, 2]),
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
      header: ["rank", "candidate", "points"],
      rows: [
        ["1", "A", "3"],
        ["1", "B", "3"],
        ["3", "C", "2"],
      ],
      right: new Set([0, 2]),
    });
  });

  test("awards points for a strict complete ranking", () => {
    const election: Election = {
      candidates: ["A", "B", "C", "D"],
      ballots: [{ count: 2, groups: [[0], [1], [2], [3]] }],
    };

    expectOutcome(election, {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "points"],
      rows: [
        ["1", "A", "6"],
        ["2", "B", "4"],
        ["3", "C", "2"],
        ["4", "D", "0"],
      ],
      right: new Set([0, 2]),
    });
  });

  test("places an omitted candidate below every listed candidate", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [{ count: 1, groups: [[0], [1]] }],
    };

    expectOutcome(election, {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "points"],
      rows: [
        ["1", "A", "2"],
        ["2", "B", "1"],
        ["3", "C", "0"],
      ],
      right: new Set([0, 2]),
    });
  });

  test("gives a tied A=B group equal points above omitted C", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [{ count: 1, groups: [[0, 1]] }],
    };

    expectOutcome(election, {
      winners: ["A", "B"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "points"],
      rows: [
        ["1", "A", "1"],
        ["1", "B", "1"],
        ["3", "C", "0"],
      ],
      right: new Set([0, 2]),
    });
  });

  test("does not award points within either of multiple tied groups", () => {
    const election: Election = {
      candidates: ["A", "B", "C", "D", "E"],
      ballots: [{ count: 1, groups: [[0, 1], [2, 3], [4]] }],
    };

    expectOutcome(election, {
      winners: ["A", "B"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "points"],
      rows: [
        ["1", "A", "3"],
        ["1", "B", "3"],
        ["3", "C", "1"],
        ["3", "D", "1"],
        ["5", "E", "0"],
      ],
      right: new Set([0, 2]),
    });
  });

  test("reports every candidate tied at zero points on blank ballots", () => {
    const election: Election = {
      candidates: ["C", "A", "B"],
      ballots: [
        { count: 4, groups: [] },
        { count: 6, groups: [] },
      ],
    };

    expectOutcome(election, {
      winners: ["C", "A", "B"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "points"],
      rows: [
        ["1", "C", "0"],
        ["1", "A", "0"],
        ["1", "B", "0"],
      ],
      right: new Set([0, 2]),
    });
  });

  test("uses weighted scores, skipped ranks, and declaration order deterministically", () => {
    const election: Election = {
      candidates: ["Z", "A", "M", "Q"],
      ballots: [
        { count: 2, groups: [[0], [1], [2], [3]] },
        { count: 2, groups: [[1], [0], [2], [3]] },
      ],
    };
    const method: MethodFn = run;
    const before = structuredClone(election);
    const expected: Outcome = {
      winners: ["Z", "A"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "points"],
      rows: [
        ["1", "Z", "10"],
        ["1", "A", "10"],
        ["3", "M", "4"],
        ["4", "Q", "0"],
      ],
      right: new Set([0, 2]),
    };

    const first = method(election, 1);

    expect(first).toEqual(expected);
    expect(method(election, 1)).toEqual(first);
    expect(method(election, 9)).toEqual(first);
    expect(election).toEqual(before);
  });
});
