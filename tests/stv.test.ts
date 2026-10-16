import { describe, expect, test } from "bun:test";
import type { Election, MethodFn, Outcome } from "../src/core/ballots";
import { run } from "../src/methods/stv";

function expectOutcome(election: Election, seats: number, expected: Outcome): void {
  expect(run(election, seats)).toEqual(expected);
}

describe("single transferable vote", () => {
  test("matches the complete lunch-election outcome for two seats", () => {
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

    expectOutcome(election, 2, {
      winners: ["Pizza", "Ramen"],
      tie: false,
      lines: ["seats: 2", "quota: 16"],
      header: ["round", "action", "Pizza", "Ramen", "Sushi", "Tacos", "Salad"],
      rows: [
        ["1", "elect Pizza", "17.00", "8.00", "7.00", "7.00", "7.00"],
        ["2", "eliminate Salad", "-", "8.00", "7.29", "7.29", "7.00"],
        ["3", "eliminate Tacos", "-", "8.00", "7.29", "7.29", "-"],
        ["4", "eliminate Sushi", "-", "15.29", "7.29", "-", "-"],
        ["5", "fill Ramen", "-", "29.59", "-", "-", "-"],
      ],
      right: new Set([0, 2, 3, 4, 5, 6]),
    });
  });

  test("elects Ramen in the one-seat lunch count", () => {
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

    expectOutcome(election, 1, {
      winners: ["Ramen"],
      tie: false,
      lines: ["seats: 1", "quota: 24"],
      header: ["round", "action", "Pizza", "Ramen", "Sushi", "Tacos", "Salad"],
      rows: [
        ["1", "eliminate Salad", "17.00", "8.00", "7.00", "7.00", "7.00"],
        ["2", "eliminate Tacos", "17.00", "8.00", "7.00", "7.00", "-"],
        ["3", "eliminate Sushi", "17.00", "15.00", "7.00", "-", "-"],
        ["4", "elect Ramen", "17.00", "29.00", "-", "-", "-"],
      ],
      right: new Set([0, 2, 3, 4, 5, 6]),
    });
  });

  test("eliminates C then B and fills A in the supplied tie election", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 1, groups: [[0], [1], [2]] },
        { count: 1, groups: [[1], [0], [2]] },
        { count: 1, groups: [[2]] },
      ],
    };

    expectOutcome(election, 1, {
      winners: ["A"],
      tie: false,
      lines: ["seats: 1", "quota: 2"],
      header: ["round", "action", "A", "B", "C"],
      rows: [
        ["1", "eliminate C", "1.00", "1.00", "1.00"],
        ["2", "eliminate B", "1.00", "1.00", "-"],
        ["3", "fill A", "2.00", "-", "-"],
      ],
      right: new Set([0, 2, 3, 4]),
    });
  });

  test("fills two seats from an all-blank election in declaration order", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [{ count: 9, groups: [] }],
    };

    expectOutcome(election, 2, {
      winners: ["A", "B"],
      tie: false,
      lines: ["seats: 2", "quota: 4"],
      header: ["round", "action", "A", "B", "C"],
      rows: [
        ["1", "eliminate C", "0.00", "0.00", "0.00"],
        ["2", "fill A, B", "0.00", "0.00", "-"],
      ],
      right: new Set([0, 2, 3, 4]),
    });
  });

  test("includes blank ballots in the Droop quota", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 2, groups: [[0]] },
        { count: 2, groups: [[1]] },
        { count: 5, groups: [] },
      ],
    };

    expectOutcome(election, 2, {
      winners: ["A", "B"],
      tie: false,
      lines: ["seats: 2", "quota: 4"],
      header: ["round", "action", "A", "B", "C"],
      rows: [
        ["1", "eliminate C", "2.00", "2.00", "0.00"],
        ["2", "fill A, B", "2.00", "2.00", "-"],
      ],
      right: new Set([0, 2, 3, 4]),
    });
  });

  test("elects an exact-quota candidate with zero surplus transfer", () => {
    const election: Election = {
      candidates: ["A", "B"],
      ballots: [
        { count: 3, groups: [[0], [1]] },
        { count: 1, groups: [[1], [0]] },
      ],
    };

    expectOutcome(election, 1, {
      winners: ["A"],
      tie: false,
      lines: ["seats: 1", "quota: 3"],
      header: ["round", "action", "A", "B"],
      rows: [["1", "elect A", "3.00", "1.00"]],
      right: new Set([0, 2, 3]),
    });
  });

  test("transfers a fractional surplus exactly across later rounds", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 2, groups: [[0], [1], [2]] },
        { count: 2, groups: [[0], [2], [1]] },
        { count: 1, groups: [[1], [2], [0]] },
        { count: 1, groups: [[2], [1], [0]] },
      ],
    };

    expectOutcome(election, 2, {
      winners: ["A", "B"],
      tie: false,
      lines: ["seats: 2", "quota: 3"],
      header: ["round", "action", "A", "B", "C"],
      rows: [
        ["1", "elect A", "4.00", "1.00", "1.00"],
        ["2", "eliminate C", "-", "1.50", "1.50"],
        ["3", "fill B", "-", "3.00", "-"],
      ],
      right: new Set([0, 2, 3, 4]),
    });
  });

  test("uses exact vote comparisons when the displayed elimination totals tie", () => {
    const election: Election = {
      candidates: ["A", "C", "B"],
      ballots: [
        { count: 51, groups: [[0], [2]] },
        { count: 50, groups: [[0], [1]] },
        { count: 98, groups: [[1], [2]] },
        { count: 98, groups: [[2], [1]] },
      ],
    };

    expectOutcome(election, 2, {
      winners: ["A", "B"],
      tie: false,
      lines: ["seats: 2", "quota: 100"],
      header: ["round", "action", "A", "C", "B"],
      rows: [
        ["1", "elect A", "101.00", "98.00", "98.00"],
        ["2", "eliminate C", "-", "98.50", "98.50"],
        ["3", "fill B", "-", "-", "196.50"],
      ],
      right: new Set([0, 2, 3, 4]),
    });
  });

  test("elects the earliest-declared candidate among equal maxima", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 3, groups: [[0], [1], [2]] },
        { count: 3, groups: [[1], [0], [2]] },
      ],
    };

    expectOutcome(election, 2, {
      winners: ["A", "B"],
      tie: false,
      lines: ["seats: 2", "quota: 3"],
      header: ["round", "action", "A", "B", "C"],
      rows: [
        ["1", "elect A", "3.00", "3.00", "0.00"],
        ["2", "elect B", "-", "3.00", "0.00"],
      ],
      right: new Set([0, 2, 3, 4]),
    });
  });

  test("eliminates the latest-declared candidate among equal minima", () => {
    const election: Election = {
      candidates: ["A", "B", "C", "D"],
      ballots: [
        { count: 2, groups: [[0]] },
        { count: 1, groups: [[1]] },
        { count: 1, groups: [[2]] },
        { count: 1, groups: [[3]] },
      ],
    };

    expectOutcome(election, 1, {
      winners: ["A"],
      tie: false,
      lines: ["seats: 1", "quota: 3"],
      header: ["round", "action", "A", "B", "C", "D"],
      rows: [
        ["1", "eliminate D", "2.00", "1.00", "1.00", "1.00"],
        ["2", "eliminate C", "2.00", "1.00", "1.00", "-"],
        ["3", "eliminate B", "2.00", "1.00", "-", "-"],
        ["4", "fill A", "2.00", "-", "-", "-"],
      ],
      right: new Set([0, 2, 3, 4, 5]),
    });
  });

  test("a tied first group becomes a singleton after one candidate is removed", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 2, groups: [[0, 2], [1]] },
        { count: 1, groups: [[1], [0], [2]] },
      ],
    };

    expectOutcome(election, 1, {
      winners: ["A"],
      tie: false,
      lines: ["seats: 1", "quota: 2"],
      header: ["round", "action", "A", "B", "C"],
      rows: [
        ["1", "eliminate C", "0.00", "1.00", "0.00"],
        ["2", "elect A", "2.00", "1.00", "-"],
      ],
      right: new Set([0, 2, 3, 4]),
    });
  });

  test("does not allocate a tied first group to its lower-ranked candidate", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 2, groups: [[0, 1], [2]] },
        { count: 1, groups: [[2], [0], [1]] },
      ],
    };

    expectOutcome(election, 1, {
      winners: ["A"],
      tie: false,
      lines: ["seats: 1", "quota: 2"],
      header: ["round", "action", "A", "B", "C"],
      rows: [
        ["1", "eliminate B", "0.00", "0.00", "1.00"],
        ["2", "elect A", "2.00", "-", "1.00"],
      ],
      right: new Set([0, 2, 3, 4]),
    });
  });

  test("allows partial ballots to exhaust after their candidates are eliminated", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 1, groups: [[0]] },
        { count: 1, groups: [[1]] },
        { count: 1, groups: [[2]] },
      ],
    };

    expectOutcome(election, 1, {
      winners: ["A"],
      tie: false,
      lines: ["seats: 1", "quota: 2"],
      header: ["round", "action", "A", "B", "C"],
      rows: [
        ["1", "eliminate C", "1.00", "1.00", "1.00"],
        ["2", "eliminate B", "1.00", "1.00", "-"],
        ["3", "fill A", "1.00", "-", "-"],
      ],
      right: new Set([0, 2, 3, 4]),
    });
  });

  test("fills multiple remaining seats by exact votes then declaration order", () => {
    const election: Election = {
      candidates: ["A", "B", "C", "D"],
      ballots: [
        { count: 2, groups: [[0]] },
        { count: 1, groups: [[1]] },
        { count: 1, groups: [[2]] },
        { count: 1, groups: [[3]] },
        { count: 2, groups: [] },
      ],
    };

    expectOutcome(election, 2, {
      winners: ["A", "B"],
      tie: false,
      lines: ["seats: 2", "quota: 3"],
      header: ["round", "action", "A", "B", "C", "D"],
      rows: [
        ["1", "eliminate D", "2.00", "1.00", "1.00", "1.00"],
        ["2", "eliminate C", "2.00", "1.00", "1.00", "-"],
        ["3", "fill A, B", "2.00", "1.00", "-", "-"],
      ],
      right: new Set([0, 2, 3, 4, 5]),
    });
  });

  test("fills the seats before electing a remaining candidate at quota", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 2, groups: [[0]] },
        { count: 2, groups: [[1]] },
        { count: 2, groups: [[2], [0]] },
      ],
    };

    expectOutcome(election, 2, {
      winners: ["A", "B"],
      tie: false,
      lines: ["seats: 2", "quota: 3"],
      header: ["round", "action", "A", "B", "C"],
      rows: [
        ["1", "eliminate C", "2.00", "2.00", "2.00"],
        ["2", "fill A, B", "4.00", "2.00", "-"],
      ],
      right: new Set([0, 2, 3, 4]),
    });
  });

  test("orders an exact-fraction fill ahead of declaration order even when displays tie", () => {
    const election: Election = {
      candidates: ["A", "C", "B", "D"],
      ballots: [
        { count: 501, groups: [[0], [2]] },
        { count: 500, groups: [[0], [1]] },
        { count: 999, groups: [[1], [2]] },
        { count: 999, groups: [[2], [1]] },
        { count: 997, groups: [[3]] },
      ],
    };

    expectOutcome(election, 3, {
      winners: ["A", "B", "C"],
      tie: false,
      lines: ["seats: 3", "quota: 1000"],
      header: ["round", "action", "A", "C", "B", "D"],
      rows: [
        ["1", "elect A", "1001.00", "999.00", "999.00", "997.00"],
        ["2", "eliminate D", "-", "999.50", "999.50", "997.00"],
        ["3", "fill B, C", "-", "999.50", "999.50", "-"],
      ],
      right: new Set([0, 2, 3, 4, 5]),
    });
  });

  test("conforms to MethodFn, repeats exactly, and preserves the election", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 3, groups: [[0], [1], [2]] },
        { count: 2, groups: [[1], [0], [2]] },
      ],
    };
    const method: MethodFn = run;
    const before = structuredClone(election);
    const expected: Outcome = {
      winners: ["A", "B"],
      tie: false,
      lines: ["seats: 2", "quota: 2"],
      header: ["round", "action", "A", "B", "C"],
      rows: [
        ["1", "elect A", "3.00", "2.00", "0.00"],
        ["2", "elect B", "-", "3.00", "0.00"],
      ],
      right: new Set([0, 2, 3, 4]),
    };

    expect(method(election, 2)).toEqual(expected);
    expect(method(election, 2)).toEqual(expected);
    expect(election).toEqual(before);
  });
});
