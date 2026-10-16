import { expect, test } from "bun:test";
import {
  type Ballot,
  type Election,
  FormatError,
  levels,
  type MethodFn,
  type Outcome,
  totalBallots,
  VoteError,
} from "../src/core/ballots";

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type IsReadonly<T, Key extends keyof T> =
  Equal<Pick<T, Key>, { -readonly [Property in Key]: T[Property] }> extends true ? false : true;

type BallotContract = Assert<Equal<Ballot, { count: number; groups: number[][] }>>;
type ElectionContract = Assert<Equal<Election, { candidates: string[]; ballots: Ballot[] }>>;
type OutcomeContract = Assert<
  Equal<
    Outcome,
    {
      winners: string[];
      tie: boolean;
      lines: string[];
      header: string[];
      rows: string[][];
      right: ReadonlySet<number>;
    }
  >
>;
type MethodFnContract = Assert<Equal<MethodFn, (election: Election, seats: number) => Outcome>>;
type FormatErrorLineIsReadonly = Assert<IsReadonly<FormatError, "line">>;

test("ballot contracts are available to downstream methods", () => {
  const contractAssertions: [
    BallotContract,
    ElectionContract,
    OutcomeContract,
    MethodFnContract,
    FormatErrorLineIsReadonly,
  ] = [true, true, true, true, true];
  expect(contractAssertions).toEqual([true, true, true, true, true]);

  const election: Election = {
    candidates: ["A", "B"],
    ballots: [{ count: 1, groups: [[0], [1]] }],
  };
  const method: MethodFn = (_election, _seats) => ({
    winners: ["A"],
    tie: false,
    lines: [],
    header: ["rank", "candidate"],
    rows: [["1", "A"]],
    right: new Set([0]),
  });

  expect(method(election, 1).winners).toEqual(["A"]);
});

test("VoteError preserves its exact message", () => {
  const error = new VoteError('unknown candidate "Pasta"');

  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe('unknown candidate "Pasta"');
});

test.each([
  [0, "no candidates line"],
  [4, 'invalid ballot count "02"'],
])("FormatError preserves line %i and its exact message", (line, message) => {
  const error = new FormatError(line, message);

  expect(error).toBeInstanceOf(Error);
  expect(error.line).toBe(line);
  expect(error.message).toBe(message);
});

const ballotTotalCases: Array<{ name: string; election: Election; expected: number }> = [
  {
    name: "no ballots",
    election: { candidates: ["A", "B"], ballots: [] },
    expected: 0,
  },
  {
    name: "weighted ballots including a blank ballot",
    election: {
      candidates: ["A", "B"],
      ballots: [
        { count: 2, groups: [[0]] },
        { count: 3, groups: [] },
      ],
    },
    expected: 5,
  },
  {
    name: "a maximum-size ballot count",
    election: {
      candidates: ["A", "B"],
      ballots: [{ count: 999999, groups: [[0], [1]] }],
    },
    expected: 999999,
  },
];

test.each(ballotTotalCases)("totalBallots counts $name", ({ election, expected }) => {
  expect(totalBallots(election)).toBe(expected);
});

const levelCases: Array<{
  name: string;
  ballot: Ballot;
  candidates: number;
  expected: number[];
}> = [
  {
    name: "listed groups and an omitted candidate",
    ballot: { count: 1, groups: [[1], [0, 2]] },
    candidates: 4,
    expected: [1, 0, 1, 2],
  },
  {
    name: "a blank ranking",
    ballot: { count: 1, groups: [] },
    candidates: 3,
    expected: [0, 0, 0],
  },
  {
    name: "a complete ranking",
    ballot: { count: 1, groups: [[2], [0], [1]] },
    candidates: 3,
    expected: [1, 2, 0],
  },
  {
    name: "all candidates tied in one group",
    ballot: { count: 1, groups: [[0, 1, 2]] },
    candidates: 3,
    expected: [0, 0, 0],
  },
  {
    name: "tied candidates share a level",
    ballot: { count: 1, groups: [[2], [0, 1]] },
    candidates: 3,
    expected: [1, 1, 0],
  },
];

test.each(levelCases)(
  "levels returns candidate ranks for $name",
  ({ ballot, candidates, expected }) => {
    expect(levels(ballot, candidates)).toEqual(expected);
  },
);
