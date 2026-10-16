import { describe, expect, test } from "bun:test";
import type { Election, MethodFn, Outcome } from "../src/core/ballots";
import { run } from "../src/methods/plurality";

function expectOutcome(election: Election, expected: Outcome): void {
  expect(run(election, 1)).toEqual(expected);
}

describe("plurality", () => {
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
      winners: ["Pizza"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "votes", "share%"],
      rows: [
        ["1", "Pizza", "17", "36.2"],
        ["2", "Ramen", "8", "17.0"],
        ["3", "Sushi", "7", "14.9"],
        ["3", "Tacos", "7", "14.9"],
        ["3", "Salad", "7", "14.9"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("reports all candidates tied on one singleton top vote each", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 1, groups: [[0], [1], [2]] },
        { count: 1, groups: [[1], [0], [2]] },
        { count: 1, groups: [[2]] },
      ],
    };

    expectOutcome(election, {
      winners: ["A", "B", "C"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "votes", "share%"],
      rows: [
        ["1", "A", "1", "33.3"],
        ["1", "B", "1", "33.3"],
        ["1", "C", "1", "33.3"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("counts only the first singleton group on a partial ballot", () => {
    const election: Election = {
      candidates: ["Z", "A", "M"],
      ballots: [
        { count: 2, groups: [[1], [0]] },
        { count: 3, groups: [[0]] },
      ],
    };

    expectOutcome(election, {
      winners: ["Z"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "votes", "share%"],
      rows: [
        ["1", "Z", "3", "60.0"],
        ["2", "A", "2", "40.0"],
        ["3", "M", "0", "0.0"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("does not award a tied top group to a lower singleton", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [{ count: 9, groups: [[0, 1], [2]] }],
    };

    expectOutcome(election, {
      winners: ["A", "B", "C"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "votes", "share%"],
      rows: [
        ["1", "A", "0", "0.0"],
        ["1", "B", "0", "0.0"],
        ["1", "C", "0", "0.0"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("keeps an all-blank election in declaration order with zero shares", () => {
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
      header: ["rank", "candidate", "votes", "share%"],
      rows: [
        ["1", "C", "0", "0.0"],
        ["1", "A", "0", "0.0"],
        ["1", "B", "0", "0.0"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("includes blank ballots in the share denominator", () => {
    const election: Election = {
      candidates: ["B", "A", "C"],
      ballots: [
        { count: 1, groups: [[0]] },
        { count: 3, groups: [] },
        { count: 1, groups: [[1]] },
      ],
    };

    expectOutcome(election, {
      winners: ["B", "A"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "votes", "share%"],
      rows: [
        ["1", "B", "1", "20.0"],
        ["1", "A", "1", "20.0"],
        ["3", "C", "0", "0.0"],
      ],
      right: new Set([0, 2, 3]),
    });
  });

  test("uses competition ranks and declaration order for equal scores", () => {
    const election: Election = {
      candidates: ["Z", "A", "M", "Q"],
      ballots: [
        { count: 2, groups: [[0]] },
        { count: 2, groups: [[1]] },
        { count: 1, groups: [] },
      ],
    };
    const method: MethodFn = run;
    const before = structuredClone(election);
    const expected: Outcome = {
      winners: ["Z", "A"],
      tie: true,
      lines: [],
      header: ["rank", "candidate", "votes", "share%"],
      rows: [
        ["1", "Z", "2", "40.0"],
        ["1", "A", "2", "40.0"],
        ["3", "M", "0", "0.0"],
        ["3", "Q", "0", "0.0"],
      ],
      right: new Set([0, 2, 3]),
    };

    const first = method(election, 1);

    expect(first).toEqual(expected);
    expect(method(election, 1)).toEqual(first);
    expect(method(election, 9)).toEqual(first);
    expect(election).toEqual(before);
  });

  test("rounds a half-tenth share upward exactly", () => {
    const election: Election = {
      candidates: ["A", "B"],
      ballots: [
        { count: 1, groups: [[0]] },
        { count: 15, groups: [] },
      ],
    };

    expectOutcome(election, {
      winners: ["A"],
      tie: false,
      lines: [],
      header: ["rank", "candidate", "votes", "share%"],
      rows: [
        ["1", "A", "1", "6.3"],
        ["2", "B", "0", "0.0"],
      ],
      right: new Set([0, 2, 3]),
    });
  });
});
