import { describe, expect, test } from "bun:test";
import { Fraction } from "../src/core/fraction";

function expectFraction(actual: Fraction, numerator: bigint, denominator = 1n): void {
  expect(actual.compare(Fraction.ratio(numerator, denominator))).toBe(0);
}

describe("Fraction", () => {
  test("of normalizes zero", () => {
    expectFraction(Fraction.of(0), 0n);
    expect(Fraction.of(0).toFixed2()).toBe("0.00");
  });

  test("of accepts integer numbers", () => {
    expectFraction(Fraction.of(-12), -12n);
  });

  test("of preserves bigint precision beyond safe integers", () => {
    const large = 900719925474099312345678901n;

    expect(Fraction.of(large).compare(Fraction.of(large + 1n))).toBe(-1);
  });

  test("ratio normalizes a negative denominator", () => {
    expectFraction(Fraction.ratio(2n, -4n), -1n, 2n);
  });

  test("ratio normalizes two negative signs", () => {
    expectFraction(Fraction.ratio(-6n, -8n), 3n, 4n);
  });

  test("ratio reduces zero with a negative denominator", () => {
    expectFraction(Fraction.ratio(0n, -7n), 0n);
  });

  test("ratio reduces equivalent fractions", () => {
    expect(Fraction.ratio(2n, 4n).compare(Fraction.ratio(1n, 2n))).toBe(0);
  });

  test("ratio reduces large values exactly", () => {
    const integer = 900719925474099312345678901n;

    expect(Fraction.ratio(integer * 3n, 3n).compare(Fraction.of(integer))).toBe(0);
  });

  test("plus adds unlike denominators exactly", () => {
    expectFraction(Fraction.ratio(1n, 3n).plus(Fraction.ratio(1n, 6n)), 1n, 2n);
  });

  test("minus preserves a negative result", () => {
    expectFraction(Fraction.ratio(1n, 3n).minus(Fraction.ratio(1n, 2n)), -1n, 6n);
  });

  test("times multiplies signed fractions", () => {
    expectFraction(Fraction.ratio(-2n, 3n).times(Fraction.ratio(9n, 4n)), -3n, 2n);
  });

  test("dividedBy handles a negative divisor", () => {
    expectFraction(Fraction.ratio(2n, 3n).dividedBy(Fraction.ratio(-4n, 5n)), -5n, 6n);
  });

  test("compare returns -1 for a smaller value", () => {
    expect(Fraction.of(-1).compare(Fraction.of(0))).toBe(-1);
  });

  test("compare returns 0 for equivalent fractions", () => {
    expect(Fraction.ratio(2n, 4n).compare(Fraction.ratio(1n, 2n))).toBe(0);
  });

  test("compare returns 1 for a greater value", () => {
    expect(Fraction.of(2).compare(Fraction.of(1))).toBe(1);
  });

  test("arithmetic leaves both operands unchanged", () => {
    const left = Fraction.ratio(1n, 3n);
    const right = Fraction.ratio(1n, 6n);

    left.plus(right);
    left.minus(right);
    left.times(right);
    left.dividedBy(right);

    expectFraction(left, 1n, 3n);
    expectFraction(right, 1n, 6n);
  });

  test("zero fractions compare equal across denominators", () => {
    expect(Fraction.ratio(0n, 11n).compare(Fraction.ratio(0n, 23n))).toBe(0);
  });

  test("toFixed2 formats zero", () => {
    expect(Fraction.of(0).toFixed2()).toBe("0.00");
  });

  test("toFixed2 rounds one third down to two decimals", () => {
    expect(Fraction.ratio(1n, 3n).toFixed2()).toBe("0.33");
  });

  test("toFixed2 rounds an exact half hundredth up", () => {
    expect(Fraction.ratio(1n, 200n).toFixed2()).toBe("0.01");
  });

  test("toFixed2 rounds below half a hundredth down", () => {
    expect(Fraction.ratio(1n, 400n).toFixed2()).toBe("0.00");
  });

  test("toFixed2 carries a rounded value into the next whole number", () => {
    expect(Fraction.ratio(1999n, 2000n).toFixed2()).toBe("1.00");
  });

  test("toFixed2 rounds an exact half thousandth up", () => {
    expect(Fraction.ratio(1n, 8n).toFixed2()).toBe("0.13");
  });

  test("toFixed2 keeps two digits for an integer", () => {
    expect(Fraction.of(5).toFixed2()).toBe("5.00");
  });
});
