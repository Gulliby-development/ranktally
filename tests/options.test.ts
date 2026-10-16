import { describe, expect, test } from "bun:test";
import { VoteError } from "../src/core/ballots";
import { type OptionSpec, parseOptions } from "../src/core/options";

const optionSpecs: OptionSpec[] = [
  { name: "--seats", kind: "int", default: 1, lo: 1, hi: 11 },
  { name: "--other", kind: "int", default: 0, lo: -9, hi: 9 },
  { name: "--winner-only", kind: "flag" },
];

function parse(argv: string[], specs: OptionSpec[] = optionSpecs) {
  return parseOptions(argv, specs);
}

function caughtError(argv: string[], specs: OptionSpec[] = optionSpecs): VoteError {
  try {
    parse(argv, specs);
  } catch (error) {
    if (error instanceof VoteError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected parseOptions to throw a VoteError");
}

describe("parseOptions", () => {
  test("accepts an integer option with an equals value", () => {
    expect(parse(["--seats=2"]).values["--seats"]).toBe(2);
  });

  test("accepts an integer option with a separate value", () => {
    expect(parse(["--seats", "2"]).values["--seats"]).toBe(2);
  });

  test("preserves interleaved positional arguments and treats a lone hyphen as positional", () => {
    expect(parse(["before", "--seats=2", "-", "after"]).args).toEqual(["before", "-", "after"]);
  });

  test("supplies each declared default and false for a flag without a default", () => {
    expect(parse([])).toEqual({
      values: { "--seats": 1, "--other": 0, "--winner-only": false },
      args: [],
    });
  });

  test("sets a present flag to true", () => {
    expect(parse(["--winner-only"]).values["--winner-only"]).toBe(true);
  });

  test("uses parsed values instead of defaults", () => {
    expect(parse(["--seats=4", "--other=-2"]).values).toEqual({
      "--seats": 4,
      "--other": -2,
      "--winner-only": false,
    });
  });

  test("consumes a dash-prefixed next token as an integer value", () => {
    const error = caughtError(["--seats", "--help"]);
    expect(error).toBeInstanceOf(VoteError);
    expect(error.message).toBe('invalid --seats "--help" (expected an integer from 1 to 11)');
  });

  test("splits an equals-form option at only its first equals sign", () => {
    expect(caughtError(["--other=1=2"]).message).toBe(
      'invalid --other "1=2" (expected an integer from -9 to 9)',
    );
  });

  test("lets the last repeated integer value win", () => {
    expect(parse(["--seats=2", "--seats", "6"]).values["--seats"]).toBe(6);
  });

  test("lets the last repeated flag value win", () => {
    expect(parse(["--winner-only", "--winner-only"]).values["--winner-only"]).toBe(true);
  });

  test("does not validate an earlier integer value when a valid final value replaces it", () => {
    expect(parse(["--seats=not-an-integer", "--seats=3"]).values["--seats"]).toBe(3);
  });

  test("reports the final invalid repeated integer value", () => {
    expect(caughtError(["--seats=3", "--seats=12"]).message).toBe(
      'invalid --seats "12" (expected an integer from 1 to 11)',
    );
  });

  test("includes one value for every spec and no extra value keys", () => {
    const result = parse(["input.txt"]);
    expect(Object.keys(result.values).sort()).toEqual(
      ["--other", "--seats", "--winner-only"].sort(),
    );
    expect(result.args).toEqual(["input.txt"]);
  });

  test("quotes unknown option names exactly", () => {
    expect(caughtError(["-x"]).message).toBe('unknown option "-x"');
  });

  test("treats -- as an unknown option rather than an option terminator", () => {
    expect(caughtError(["--"]).message).toBe('unknown option "--"');
  });

  test("treats --help as an unknown option", () => {
    expect(caughtError(["--help"]).message).toBe('unknown option "--help"');
  });

  test("rejects a flag with an equals value as an unknown option", () => {
    expect(caughtError(["--winner-only=true"]).message).toBe('unknown option "--winner-only=true"');
  });

  test("uses show-style quoting for non-ASCII option text", () => {
    expect(caughtError(["--naïve"]).message).toBe('unknown option "--na?ve"');
  });

  test("reports a final integer option without a value", () => {
    expect(caughtError(["--seats"]).message).toBe("--seats needs a value");
  });

  test("reports an unknown option during scanning before deferred integer validation", () => {
    expect(caughtError(["--seats=0", "--bogus"]).message).toBe('unknown option "--bogus"');
  });

  test("reports a missing value during scanning before deferred integer validation", () => {
    expect(caughtError(["--seats=0", "--other"]).message).toBe("--other needs a value");
  });

  test("reports whichever scanning error appears first", () => {
    expect(caughtError(["--bogus", "--other"]).message).toBe('unknown option "--bogus"');
  });

  test("consumes a dash-prefixed token as the integer value", () => {
    expect(caughtError(["--other", "--bogus"]).message).toBe(
      'invalid --other "--bogus" (expected an integer from -9 to 9)',
    );
  });

  test("validates final integer values in spec order rather than argv order", () => {
    expect(caughtError(["--other=10", "--seats=0"]).message).toBe(
      'invalid --seats "0" (expected an integer from 1 to 11)',
    );
  });

  test("accepts zero for an integer option whose inclusive range contains zero", () => {
    expect(parse(["--other=0"]).values["--other"]).toBe(0);
  });

  test("accepts positive and negative integer syntax within range", () => {
    expect(parse(["--other=9"]).values["--other"]).toBe(9);
    expect(parse(["--other=-9"]).values["--other"]).toBe(-9);
  });

  test("accepts both inclusive seats boundaries", () => {
    expect(parse(["--seats=1"]).values["--seats"]).toBe(1);
    expect(parse(["--seats=11"]).values["--seats"]).toBe(11);
  });

  test("rejects zero below the seats lower bound", () => {
    expect(caughtError(["--seats=0"]).message).toBe(
      'invalid --seats "0" (expected an integer from 1 to 11)',
    );
  });

  test("rejects twelve above the seats upper bound", () => {
    expect(caughtError(["--seats=12"]).message).toBe(
      'invalid --seats "12" (expected an integer from 1 to 11)',
    );
  });

  test("rejects negative zero", () => {
    expect(caughtError(["--other=-0"]).message).toBe(
      'invalid --other "-0" (expected an integer from -9 to 9)',
    );
  });

  test("rejects an explicit plus sign", () => {
    expect(caughtError(["--other=+3"]).message).toBe(
      'invalid --other "+3" (expected an integer from -9 to 9)',
    );
  });

  test("rejects leading zeroes", () => {
    expect(caughtError(["--other=007"]).message).toBe(
      'invalid --other "007" (expected an integer from -9 to 9)',
    );
  });

  test("rejects an empty equals value", () => {
    expect(caughtError(["--seats="]).message).toBe(
      'invalid --seats "" (expected an integer from 1 to 11)',
    );
  });

  test("rejects whitespace around a number", () => {
    expect(caughtError(["--seats= 2"]).message).toBe(
      'invalid --seats "?2" (expected an integer from 1 to 11)',
    );
  });

  test("rejects decimal notation", () => {
    expect(caughtError(["--other=1.5"]).message).toBe(
      'invalid --other "1.5" (expected an integer from -9 to 9)',
    );
  });

  test("accepts a nine-digit value when its declared bounds allow it", () => {
    const wideSpecs: OptionSpec[] = [
      { name: "--number", kind: "int", default: 0, lo: -2_000_000_000, hi: 2_000_000_000 },
    ];
    expect(parse(["--number=999999999"], wideSpecs).values["--number"]).toBe(999999999);
  });

  test("rejects a ten-digit value even when its declared bounds allow it", () => {
    const wideSpecs: OptionSpec[] = [
      { name: "--number", kind: "int", default: 0, lo: -2_000_000_000, hi: 2_000_000_000 },
    ];
    expect(caughtError(["--number=1000000000"], wideSpecs).message).toBe(
      'invalid --number "1000000000" (expected an integer from -2000000000 to 2000000000)',
    );
  });

  test("rejects an integer one below an inclusive lower bound", () => {
    expect(caughtError(["--other=-10"]).message).toBe(
      'invalid --other "-10" (expected an integer from -9 to 9)',
    );
  });

  test("rejects an integer one above an inclusive upper bound", () => {
    expect(caughtError(["--other=10"]).message).toBe(
      'invalid --other "10" (expected an integer from -9 to 9)',
    );
  });
});
