import { expect, test } from "bun:test";
import { type Election, FormatError } from "../src/core/ballots";
import { parseElection } from "../src/formats/election";

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type IsReadonly<T, Key extends keyof T> =
  Equal<Pick<T, Key>, { -readonly [Property in Key]: T[Property] }> extends true ? false : true;

type ParseElectionContract = Assert<Equal<typeof parseElection, (lines: string[]) => Election>>;
type FormatErrorLineIsReadonly = Assert<IsReadonly<FormatError, "line">>;

function caughtError(lines: string[]): FormatError {
  try {
    parseElection(lines);
  } catch (error) {
    if (error instanceof FormatError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected parseElection to throw a FormatError");
}

test("parseElection and FormatError keep their public type contracts", () => {
  const contractAssertions: [ParseElectionContract, FormatErrorLineIsReadonly] = [true, true];
  expect(contractAssertions).toEqual([true, true]);
});

const electionCases: Array<{ name: string; lines: string[]; expected: Election }> = [
  {
    name: "two candidates and no ballot lines",
    lines: ["candidates A B"],
    expected: { candidates: ["A", "B"], ballots: [] },
  },
  {
    name: "all permitted ASCII candidate character classes",
    lines: ["candidates A z 7 _ -"],
    expected: { candidates: ["A", "z", "7", "_", "-"], ballots: [] },
  },
  {
    name: "a candidate name at the 20-character limit",
    lines: ["candidates ABCDEFGHIJKLMNOPQRST B"],
    expected: { candidates: ["ABCDEFGHIJKLMNOPQRST", "B"], ballots: [] },
  },
  {
    name: "the maximum of 12 candidates",
    lines: ["candidates A B C D E F G H I J K L"],
    expected: {
      candidates: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"],
      ballots: [],
    },
  },
  {
    name: "spaces and tabs separate declaration names",
    lines: ["candidates\tA   B\tC"],
    expected: { candidates: ["A", "B", "C"], ballots: [] },
  },
  {
    name: "candidate case is significant",
    lines: ["candidates A a", "A > a"],
    expected: { candidates: ["A", "a"], ballots: [{ count: 1, groups: [[0], [1]] }] },
  },
  {
    name: "candidate order defines stable ballot indexes",
    lines: ["candidates B A C", "C > B = A"],
    expected: { candidates: ["B", "A", "C"], ballots: [{ count: 1, groups: [[2], [0, 1]] }] },
  },
  {
    name: "a complete ballot preserves singleton groups",
    lines: ["candidates A B C", "A > B > C"],
    expected: { candidates: ["A", "B", "C"], ballots: [{ count: 1, groups: [[0], [1], [2]] }] },
  },
  {
    name: "a partial ranking with tied candidates preserves group order",
    lines: ["candidates A B C", "C = A > B"],
    expected: { candidates: ["A", "B", "C"], ballots: [{ count: 1, groups: [[2, 0], [1]] }] },
  },
  {
    name: "a count prefix and whitespace around names are accepted",
    lines: ["candidates A B C", "  2 \t: \t C = A \t> B  "],
    expected: { candidates: ["A", "B", "C"], ballots: [{ count: 2, groups: [[2, 0], [1]] }] },
  },
  {
    name: "an unprefixed partial ranking has count one",
    lines: ["candidates A B C", "B"],
    expected: { candidates: ["A", "B", "C"], ballots: [{ count: 1, groups: [[1]] }] },
  },
  {
    name: "the maximum six-digit ballot count is accepted",
    lines: ["candidates A B", "999999: A"],
    expected: { candidates: ["A", "B"], ballots: [{ count: 999999, groups: [[0]] }] },
  },
  {
    name: "a counted empty ranking is a blank ballot",
    lines: ["candidates A B", "1:"],
    expected: { candidates: ["A", "B"], ballots: [{ count: 1, groups: [] }] },
  },
  {
    name: "spaces and tabs after a count still make a blank ballot",
    lines: ["candidates A B", "  2 : \t  "],
    expected: { candidates: ["A", "B"], ballots: [{ count: 2, groups: [] }] },
  },
  {
    name: "blank lines and full-line comments are ignored between ballots",
    lines: ["candidates A B", "", " \t ", "  # note", "A", "\t# another note", "B"],
    expected: {
      candidates: ["A", "B"],
      ballots: [
        { count: 1, groups: [[0]] },
        { count: 1, groups: [[1]] },
      ],
    },
  },
  {
    name: "ignored lines after a declaration leave an empty ballot list",
    lines: ["candidates A B", " ", "# no ballot"],
    expected: { candidates: ["A", "B"], ballots: [] },
  },
];

test.each(electionCases)("parses $name", ({ lines, expected }) => {
  expect(parseElection(lines)).toEqual(expected);
});

const declarationErrorCases: Array<{
  name: string;
  lines: string[];
  line: number;
  message: string;
}> = [
  { name: "empty input has no candidates line", lines: [], line: 0, message: "no candidates line" },
  {
    name: "only ignored lines have no candidates line",
    lines: ["", " \t ", "# comment", "  # another comment"],
    line: 0,
    message: "no candidates line",
  },
  {
    name: "a ballot cannot be the first content line",
    lines: ["A > B"],
    line: 1,
    message: 'expected a "candidates" line first',
  },
  {
    name: "the candidates keyword must be exact",
    lines: ["candidatesX A B"],
    line: 1,
    message: 'expected a "candidates" line first',
  },
  {
    name: "the first declaration error retains its original line number",
    lines: ["", "# preface", "A > B"],
    line: 3,
    message: 'expected a "candidates" line first',
  },
  {
    name: "the candidates keyword alone reaches the minimum count check",
    lines: ["candidates"],
    line: 1,
    message: "at least 2 candidates are needed",
  },
  {
    name: "one candidate is below the minimum",
    lines: ["candidates A"],
    line: 1,
    message: "at least 2 candidates are needed",
  },
  {
    name: "a 21-character candidate name exceeds the limit",
    lines: ["candidates ABCDEFGHIJKLMNOPQRSTU B"],
    line: 1,
    message: 'invalid candidate name "ABCDEFGHIJKLMNOPQRSTU"',
  },
  {
    name: "punctuation is not allowed in a candidate name",
    lines: ["candidates A! B"],
    line: 1,
    message: 'invalid candidate name "A!"',
  },
  {
    name: "non-ASCII candidate characters are shown as question marks",
    lines: ["candidates Café B"],
    line: 1,
    message: 'invalid candidate name "Caf?"',
  },
  {
    name: "a carriage return is not trimmed from a direct input line",
    lines: ["candidates A\r B"],
    line: 1,
    message: 'invalid candidate name "A?"',
  },
  {
    name: "candidate names are unique",
    lines: ["candidates A B A"],
    line: 1,
    message: 'duplicate candidate "A"',
  },
  {
    name: "the 13th distinct candidate exceeds the maximum",
    lines: ["candidates A B C D E F G H I J K L M"],
    line: 1,
    message: "at most 12 candidates are allowed",
  },
  {
    name: "a duplicate in an overfull declaration precedes the count error",
    lines: ["candidates A B C D E F G H I J K L A"],
    line: 1,
    message: 'duplicate candidate "A"',
  },
  {
    name: "an invalid name in an overfull declaration precedes the count error",
    lines: ["candidates A B C D E F G H I J K L !"],
    line: 1,
    message: 'invalid candidate name "!"',
  },
  {
    name: "an invalid name is checked before a later duplicate",
    lines: ["candidates A! A A"],
    line: 1,
    message: 'invalid candidate name "A!"',
  },
  {
    name: "a duplicate is checked before a later invalid name",
    lines: ["candidates A A !"],
    line: 1,
    message: 'duplicate candidate "A"',
  },
];

test.each(declarationErrorCases)("reports $name as a FormatError", ({ lines, line, message }) => {
  const error = caughtError(lines);
  expect(error).toBeInstanceOf(FormatError);
  expect(error.line).toBe(line);
  expect(error.message).toBe(message);
});

const ballotErrorCases: Array<{
  name: string;
  lines: string[];
  line: number;
  message: string;
}> = [
  {
    name: "zero is not a ballot count",
    lines: ["candidates A B", "0: X >"],
    line: 2,
    message: 'invalid ballot count "0"',
  },
  {
    name: "a ballot count cannot have a leading zero",
    lines: ["candidates A B", "01: A"],
    line: 2,
    message: 'invalid ballot count "01"',
  },
  {
    name: "a plus sign is not valid count syntax",
    lines: ["candidates A B", "+1: A"],
    line: 2,
    message: 'invalid ballot count "+1"',
  },
  {
    name: "a minus sign is not valid count syntax",
    lines: ["candidates A B", "-1: A"],
    line: 2,
    message: 'invalid ballot count "-1"',
  },
  {
    name: "a decimal is not valid count syntax",
    lines: ["candidates A B", "1.0: A"],
    line: 2,
    message: 'invalid ballot count "1.0"',
  },
  {
    name: "a seven-digit count exceeds the limit",
    lines: ["candidates A B", "1000000: A"],
    line: 2,
    message: 'invalid ballot count "1000000"',
  },
  {
    name: "an empty count before a colon is invalid",
    lines: ["candidates A B", ": A"],
    line: 2,
    message: 'invalid ballot count ""',
  },
  {
    name: "spaces alone are not a count",
    lines: ["candidates A B", "  : A"],
    line: 2,
    message: 'invalid ballot count ""',
  },
  {
    name: "an invalid count precedes ranking errors",
    lines: ["candidates A B", "0: X >"],
    line: 2,
    message: 'invalid ballot count "0"',
  },
  {
    name: "a repeated greater-than separator has an empty name",
    lines: ["candidates A B", "A > > B"],
    line: 2,
    message: "empty name in ranking",
  },
  {
    name: "a trailing greater-than separator has an empty name",
    lines: ["candidates A B", "A >"],
    line: 2,
    message: "empty name in ranking",
  },
  {
    name: "a leading greater-than separator has an empty name",
    lines: ["candidates A B", "> A"],
    line: 2,
    message: "empty name in ranking",
  },
  {
    name: "a repeated equals separator has an empty name",
    lines: ["candidates A B", "A = = B"],
    line: 2,
    message: "empty name in ranking",
  },
  {
    name: "a trailing equals separator has an empty name",
    lines: ["candidates A B", "A ="],
    line: 2,
    message: "empty name in ranking",
  },
  {
    name: "an undeclared ranking name is rejected",
    lines: ["candidates A B", "A > X"],
    line: 2,
    message: 'unknown candidate "X"',
  },
  {
    name: "a candidate repeated in one tied group is rejected",
    lines: ["candidates A B", "A = A"],
    line: 2,
    message: 'candidate "A" is ranked twice',
  },
  {
    name: "a candidate repeated in a later rank group is rejected",
    lines: ["candidates A B", "A > A"],
    line: 2,
    message: 'candidate "A" is ranked twice',
  },
  {
    name: "an earlier unknown name precedes a later duplicate",
    lines: ["candidates A B", "A > X > A"],
    line: 2,
    message: 'unknown candidate "X"',
  },
  {
    name: "an earlier duplicate precedes a later unknown name",
    lines: ["candidates A B", "A > A > X"],
    line: 2,
    message: 'candidate "A" is ranked twice',
  },
  {
    name: "an extra colon remains part of the ranking name",
    lines: ["candidates A B", "1: A:B"],
    line: 2,
    message: 'unknown candidate "A:B"',
  },
  {
    name: "an inline comment is not a comment",
    lines: ["candidates A B", "A # comment"],
    line: 2,
    message: 'unknown candidate "A?#?comment"',
  },
  {
    name: "Unicode whitespace is not trimmed around a ranking name",
    lines: ["candidates A B", "A\u00a0B"],
    line: 2,
    message: 'unknown candidate "A?B"',
  },
  {
    name: "ignored lines count toward the ballot source line",
    lines: ["candidates A B", "", " # ignored", "\t", "A > X"],
    line: 5,
    message: 'unknown candidate "X"',
  },
  {
    name: "the first malformed ballot wins",
    lines: ["candidates A B", "A > X", "B > B"],
    line: 2,
    message: 'unknown candidate "X"',
  },
];

test.each(ballotErrorCases)("reports $name as a FormatError", ({ lines, line, message }) => {
  const error = caughtError(lines);
  expect(error).toBeInstanceOf(FormatError);
  expect(error.line).toBe(line);
  expect(error.message).toBe(message);
});
