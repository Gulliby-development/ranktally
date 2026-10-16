import { describe, expect, test } from "bun:test";
import { competitionRanks, fixed1, renderTable, show } from "../src/core/text";

describe("show", () => {
  test("quotes empty text", () => {
    expect(show("")).toBe('""');
  });

  test("replaces a space with one question mark", () => {
    expect(show("A B")).toBe('"A?B"');
  });

  test("preserves printable ASCII including quotes and backslashes", () => {
    expect(show('!"\\~')).toBe('"!"\\~"');
  });

  test("replaces spaces and control whitespace one code point at a time", () => {
    expect(show(" \t\n\r")).toBe('"????"');
  });

  test("replaces a non-ASCII BMP character and a supplementary code point", () => {
    expect(show("é😀")).toBe('"??"');
  });

  test("replaces characters outside both printable ASCII boundaries", () => {
    expect(show("\u0000\u007f")).toBe('"??"');
  });
});

test("show preserves every printable ASCII character", () => {
  const printableAscii =
    "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

  expect(show(printableAscii)).toBe(`"${printableAscii}"`);
});

describe("fixed1", () => {
  test("formats zero with one decimal place", () => {
    expect(fixed1(0, 1)).toBe("0.0");
  });

  test("rounds one third to one decimal place", () => {
    expect(fixed1(1, 3)).toBe("0.3");
  });

  test("rounds an exact half tenth up", () => {
    expect(fixed1(1, 20)).toBe("0.1");
  });

  test("rounds a value below half a tenth down", () => {
    expect(fixed1(1, 40)).toBe("0.0");
  });

  test("rounds a value just above half a tenth up", () => {
    expect(fixed1(1, 19)).toBe("0.1");
  });

  test("rounds a value just below half a tenth down", () => {
    expect(fixed1(1, 21)).toBe("0.0");
  });

  test("carries a rounded tenth into the next whole number", () => {
    expect(fixed1(199, 200)).toBe("1.0");
  });

  test("handles the maximum safe integer exactly when numerator equals denominator", () => {
    expect(fixed1(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe("1.0");
  });

  test("preserves exact half-tenth rounding at the safe-integer boundary", () => {
    expect(fixed1(Number.MAX_SAFE_INTEGER, 20)).toBe("450359962737049.6");
  });

  test("preserves the rounded fractional digit at the safe-integer boundary", () => {
    expect(fixed1(Number.MAX_SAFE_INTEGER, 3)).toBe("3002399751580330.3");
  });
});

describe("renderTable", () => {
  test("renders a header-only table without adding a line ending", () => {
    expect(renderTable(["name", "votes"], [], new Set([1]))).toEqual(["name  votes"]);
  });

  test("uses the widest header or cell and aligns right-aligned columns", () => {
    expect(
      renderTable(
        ["x", "n"],
        [
          ["A", "2"],
          ["Long", "12"],
        ],
        new Set([1]),
      ),
    ).toEqual(["x      n", "A      2", "Long  12"]);
  });

  test("left-aligns other columns and removes trailing spaces", () => {
    expect(
      renderTable(
        ["x", "n", "flag"],
        [
          ["A", "2", "yes"],
          ["long", "12", "no"],
        ],
        new Set([1]),
      ),
    ).toEqual(["x      n  flag", "A      2  yes", "long  12  no"]);
  });

  test("widens a column for its header even when its rows are shorter", () => {
    expect(renderTable(["candidate", "n"], [["A", "1"]], new Set([1]))).toEqual([
      "candidate  n",
      "A          1",
    ]);
  });

  test("returns lines without LF or trailing whitespace", () => {
    const lines = renderTable(["key", "value"], [["last", "2"]], new Set([1]));

    expect(lines).toEqual(["key   value", "last      2"]);
    expect(lines.every((line) => !line.endsWith("\n") && line === line.trimEnd())).toBe(true);
  });
});

describe("competitionRanks", () => {
  test("ranks an empty key list", () => {
    expect(competitionRanks([])).toEqual([]);
  });

  test("gives a single key rank one", () => {
    expect(competitionRanks([4])).toEqual([1]);
  });

  test("shares tied ranks and skips the next rank", () => {
    expect(competitionRanks([9, 9, 5])).toEqual([1, 1, 3]);
  });

  test("skips ranks after a tie in the middle", () => {
    expect(competitionRanks([8, 7, 7, 3])).toEqual([1, 2, 2, 4]);
  });

  test("ranks sorted ascending keys with a middle tie", () => {
    expect(competitionRanks([0, 1, 1, 2])).toEqual([1, 2, 2, 4]);
  });
});
