import { describe, expect, test } from "bun:test";
import type { Election } from "../src/core/ballots";
import { condorcetLoser, condorcetWinner, duels } from "../src/core/duels";

describe("duels", () => {
  test("returns a zero matrix when there are no ballots", () => {
    const election: Election = { candidates: ["A", "B", "C"], ballots: [] };

    expect(duels(election)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  test("blank ballots count for no pairwise preference", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [{ count: 7, groups: [] }],
    };

    expect(duels(election)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  test("matches the weighted count and omission fixture", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [
        { count: 2, groups: [[0], [1]] },
        { count: 3, groups: [[1, 2]] },
        { count: 4, groups: [] },
      ],
    };

    expect(duels(election)).toEqual([
      [0, 2, 2],
      [3, 0, 2],
      [3, 0, 0],
    ]);
  });

  test("unlisted candidates tie below every listed candidate", () => {
    const election: Election = {
      candidates: ["A", "B", "C", "D"],
      ballots: [
        { count: 2, groups: [[0]] },
        { count: 3, groups: [[2], [1]] },
      ],
    };

    expect(duels(election)).toEqual([
      [0, 2, 2, 2],
      [3, 0, 0, 3],
      [3, 3, 0, 3],
      [0, 0, 0, 0],
    ]);
  });

  test("a tied group defeats lower groups but not its members", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [{ count: 5, groups: [[0, 1], [2]] }],
    };

    expect(duels(election)).toEqual([
      [0, 0, 5],
      [0, 0, 5],
      [0, 0, 0],
    ]);
  });

  test("complete ties contribute no strict preferences", () => {
    const election: Election = {
      candidates: ["A", "B", "C"],
      ballots: [{ count: 6, groups: [[0, 1, 2]] }],
    };

    expect(duels(election)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  test("keeps every diagonal entry zero in a twelve-candidate election", () => {
    const election: Election = {
      candidates: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"],
      ballots: [
        {
          count: 1,
          groups: [[0], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11]],
        },
        {
          count: 2,
          groups: [[11], [10], [9], [8], [7], [6], [5], [4], [3], [2], [1], [0]],
        },
      ],
    };

    expect(duels(election)).toEqual([
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 2, 2, 0, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 2, 2, 2, 0, 1, 1, 1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2, 0, 1, 1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2, 2, 0, 1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2, 2, 2, 0, 1, 1, 1, 1],
      [2, 2, 2, 2, 2, 2, 2, 2, 0, 1, 1, 1],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 1, 1],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 1],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0],
    ]);
  });
});

describe("strict Condorcet detection", () => {
  test("finds the strict winner and strict loser from the specified matrix", () => {
    const matrix = [
      [0, 4, 4],
      [1, 0, 3],
      [1, 2, 0],
    ];

    expect(condorcetWinner(matrix)).toBe(0);
    expect(condorcetLoser(matrix)).toBe(2);
  });

  test("returns no winner or loser for a tied two-candidate comparison", () => {
    const matrix = [
      [0, 1],
      [1, 0],
    ];

    expect(condorcetWinner(matrix)).toBeNull();
    expect(condorcetLoser(matrix)).toBeNull();
  });

  test("returns no winner or loser for a Condorcet cycle", () => {
    const matrix = [
      [0, 2, 1],
      [1, 0, 2],
      [2, 1, 0],
    ];

    expect(condorcetWinner(matrix)).toBeNull();
    expect(condorcetLoser(matrix)).toBeNull();
  });

  test("returns no winner or loser when all pairwise counts are zero", () => {
    const matrix = [
      [0, 0],
      [0, 0],
    ];

    expect(condorcetWinner(matrix)).toBeNull();
    expect(condorcetLoser(matrix)).toBeNull();
  });

  test("does not treat a tied comparison as a strict win", () => {
    const matrix = [
      [0, 1, 4],
      [1, 0, 4],
      [0, 0, 0],
    ];

    expect(condorcetWinner(matrix)).toBeNull();
    expect(condorcetLoser(matrix)).toBe(2);
  });

  test("keeps the strict loser when the other candidates tie", () => {
    const matrix = [
      [0, 0, 4],
      [0, 0, 4],
      [1, 1, 0],
    ];

    expect(condorcetWinner(matrix)).toBeNull();
    expect(condorcetLoser(matrix)).toBe(2);
  });

  test("finds both strict results in a two-candidate election", () => {
    const matrix = [
      [0, 3],
      [2, 0],
    ];

    expect(condorcetWinner(matrix)).toBe(0);
    expect(condorcetLoser(matrix)).toBe(1);
  });

  test("identifies the first candidate only when it strictly beats everyone", () => {
    const matrix = [
      [0, 5, 3, 8],
      [2, 0, 4, 1],
      [1, 2, 0, 2],
      [0, 3, 1, 0],
    ];

    expect(condorcetWinner(matrix)).toBe(0);
    expect(condorcetLoser(matrix)).toBeNull();
  });

  test("identifies the last candidate only when everyone strictly beats it", () => {
    const matrix = [
      [0, 3, 1, 4],
      [2, 0, 4, 3],
      [5, 3, 0, 7],
      [0, 0, 0, 0],
    ];

    expect(condorcetWinner(matrix)).toBeNull();
    expect(condorcetLoser(matrix)).toBe(3);
  });

  test("detects strict winner and loser in a twelve-candidate matrix", () => {
    const matrix = [
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    expect(condorcetWinner(matrix)).toBe(0);
    expect(condorcetLoser(matrix)).toBe(11);
  });

  test("returns no strict result for a twelve-candidate all-tie matrix", () => {
    const matrix = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    expect(condorcetWinner(matrix)).toBeNull();
    expect(condorcetLoser(matrix)).toBeNull();
  });

  test.each([
    [
      "0 beats 1 by 2 to 1",
      [
        [0, 2],
        [1, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 3 to 1",
      [
        [0, 3],
        [1, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 4 to 1",
      [
        [0, 4],
        [1, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 4 to 2",
      [
        [0, 4],
        [2, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 5 to 1",
      [
        [0, 5],
        [1, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 5 to 2",
      [
        [0, 5],
        [2, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 5 to 3",
      [
        [0, 5],
        [3, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 6 to 1",
      [
        [0, 6],
        [1, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 6 to 2",
      [
        [0, 6],
        [2, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 6 to 3",
      [
        [0, 6],
        [3, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 6 to 4",
      [
        [0, 6],
        [4, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 7 to 1",
      [
        [0, 7],
        [1, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 7 to 2",
      [
        [0, 7],
        [2, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 7 to 3",
      [
        [0, 7],
        [3, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 7 to 4",
      [
        [0, 7],
        [4, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 7 to 5",
      [
        [0, 7],
        [5, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 8 to 1",
      [
        [0, 8],
        [1, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 8 to 2",
      [
        [0, 8],
        [2, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 8 to 3",
      [
        [0, 8],
        [3, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 8 to 4",
      [
        [0, 8],
        [4, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 8 to 5",
      [
        [0, 8],
        [5, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 8 to 6",
      [
        [0, 8],
        [6, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 9 to 1",
      [
        [0, 9],
        [1, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 9 to 2",
      [
        [0, 9],
        [2, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 9 to 3",
      [
        [0, 9],
        [3, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 9 to 4",
      [
        [0, 9],
        [4, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 9 to 5",
      [
        [0, 9],
        [5, 0],
      ],
      0,
      1,
    ],
    [
      "0 beats 1 by 9 to 6",
      [
        [0, 9],
        [6, 0],
      ],
      0,
      1,
    ],
    [
      "1 beats 0 by 2 to 1",
      [
        [0, 1],
        [2, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 3 to 1",
      [
        [0, 1],
        [3, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 4 to 1",
      [
        [0, 1],
        [4, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 4 to 2",
      [
        [0, 2],
        [4, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 5 to 1",
      [
        [0, 1],
        [5, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 5 to 2",
      [
        [0, 2],
        [5, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 5 to 3",
      [
        [0, 3],
        [5, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 6 to 1",
      [
        [0, 1],
        [6, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 6 to 2",
      [
        [0, 2],
        [6, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 6 to 3",
      [
        [0, 3],
        [6, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 6 to 4",
      [
        [0, 4],
        [6, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 7 to 1",
      [
        [0, 1],
        [7, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 7 to 2",
      [
        [0, 2],
        [7, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 7 to 3",
      [
        [0, 3],
        [7, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 7 to 4",
      [
        [0, 4],
        [7, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 7 to 5",
      [
        [0, 5],
        [7, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 8 to 1",
      [
        [0, 1],
        [8, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 8 to 2",
      [
        [0, 2],
        [8, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 8 to 3",
      [
        [0, 3],
        [8, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 8 to 4",
      [
        [0, 4],
        [8, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 8 to 5",
      [
        [0, 5],
        [8, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 8 to 6",
      [
        [0, 6],
        [8, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 9 to 1",
      [
        [0, 1],
        [9, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 9 to 2",
      [
        [0, 2],
        [9, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 9 to 3",
      [
        [0, 3],
        [9, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 9 to 4",
      [
        [0, 4],
        [9, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 9 to 5",
      [
        [0, 5],
        [9, 0],
      ],
      1,
      0,
    ],
    [
      "1 beats 0 by 9 to 6",
      [
        [0, 6],
        [9, 0],
      ],
      1,
      0,
    ],
    [
      "0 and 1 tie at 0",
      [
        [0, 0],
        [0, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 1",
      [
        [0, 1],
        [1, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 2",
      [
        [0, 2],
        [2, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 3",
      [
        [0, 3],
        [3, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 4",
      [
        [0, 4],
        [4, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 5",
      [
        [0, 5],
        [5, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 6",
      [
        [0, 6],
        [6, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 7",
      [
        [0, 7],
        [7, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 8",
      [
        [0, 8],
        [8, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 9",
      [
        [0, 9],
        [9, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 10",
      [
        [0, 10],
        [10, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 11",
      [
        [0, 11],
        [11, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 12",
      [
        [0, 12],
        [12, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 13",
      [
        [0, 13],
        [13, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 14",
      [
        [0, 14],
        [14, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 15",
      [
        [0, 15],
        [15, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 16",
      [
        [0, 16],
        [16, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 17",
      [
        [0, 17],
        [17, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 18",
      [
        [0, 18],
        [18, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 19",
      [
        [0, 19],
        [19, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 20",
      [
        [0, 20],
        [20, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 21",
      [
        [0, 21],
        [21, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 22",
      [
        [0, 22],
        [22, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 23",
      [
        [0, 23],
        [23, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 24",
      [
        [0, 24],
        [24, 0],
      ],
      null,
      null,
    ],
    [
      "0 and 1 tie at 25",
      [
        [0, 25],
        [25, 0],
      ],
      null,
      null,
    ],
  ])("%s", (_name, matrix, winner, loser) => {
    expect(condorcetWinner(matrix)).toBe(winner);
    expect(condorcetLoser(matrix)).toBe(loser);
  });
});
