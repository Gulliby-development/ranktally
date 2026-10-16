function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = absolute(left);
  let b = absolute(right);

  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a;
}

export class Fraction {
  private constructor(
    private readonly numerator: bigint,
    private readonly denominator: bigint,
  ) {}

  static of(value: number | bigint): Fraction {
    const numerator = typeof value === "bigint" ? value : BigInt(value);
    return Fraction.ratio(numerator, 1n);
  }

  static ratio(numerator: bigint, denominator: bigint): Fraction {
    const positiveNumerator = denominator < 0n ? -numerator : numerator;
    const positiveDenominator = absolute(denominator);
    const divisor = greatestCommonDivisor(positiveNumerator, positiveDenominator);

    return new Fraction(positiveNumerator / divisor, positiveDenominator / divisor);
  }

  plus(other: Fraction): Fraction {
    return Fraction.ratio(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  minus(other: Fraction): Fraction {
    return Fraction.ratio(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  times(other: Fraction): Fraction {
    return Fraction.ratio(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  dividedBy(other: Fraction): Fraction {
    return Fraction.ratio(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  compare(other: Fraction): number {
    const left = this.numerator * other.denominator;
    const right = other.numerator * this.denominator;

    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }

    return 0;
  }

  toFixed2(): string {
    const negative = this.numerator < 0n;
    const scaledNumerator = absolute(this.numerator) * 100n;
    let hundredths = scaledNumerator / this.denominator;

    if ((scaledNumerator % this.denominator) * 2n >= this.denominator) {
      hundredths += 1n;
    }

    const whole = hundredths / 100n;
    const fraction = (hundredths % 100n).toString().padStart(2, "0");
    const sign = negative && hundredths !== 0n ? "-" : "";

    return `${sign}${whole}.${fraction}`;
  }
}
