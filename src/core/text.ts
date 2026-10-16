export function show(text: string): string {
  let visible = "";

  for (const character of text) {
    const codePoint = character.codePointAt(0);
    visible += codePoint !== undefined && codePoint >= 0x21 && codePoint <= 0x7e ? character : "?";
  }

  return `"${visible}"`;
}

export function fixed1(num: number, den: number): string {
  const scaled = BigInt(num) * 10n;
  const divisor = BigInt(den);
  let tenths = scaled / divisor;

  if ((scaled % divisor) * 2n >= divisor) {
    tenths += 1n;
  }

  return `${tenths / 10n}.${tenths % 10n}`;
}

export function renderTable(
  header: string[],
  rows: string[][],
  right: ReadonlySet<number>,
): string[] {
  const widths = header.map((cell) => cell.length);

  for (const row of rows) {
    for (let column = 0; column < header.length; column += 1) {
      widths[column] = Math.max(widths[column], row[column].length);
    }
  }

  const formatRow = (row: string[]): string =>
    row
      .map((cell, column) =>
        right.has(column) ? cell.padStart(widths[column]) : cell.padEnd(widths[column]),
      )
      .join("  ")
      .trimEnd();

  return [formatRow(header), ...rows.map(formatRow)];
}

export function competitionRanks(keys: number[]): number[] {
  let currentRank = 0;
  let previousKey: number | undefined;

  return keys.map((key, index) => {
    if (previousKey === undefined || key !== previousKey) {
      currentRank = index + 1;
      previousKey = key;
    }

    return currentRank;
  });
}
