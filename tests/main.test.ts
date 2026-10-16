import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { main } from "../src/cli";
import type { Io } from "../src/formats/files";

const REPOSITORY_ROOT = resolve(import.meta.dir, "..");
const EXPECTED_USAGE = [
  "usage: ranktally tally [--seats N] [--winner-only] METHOD FILE",
  "       ranktally compare FILE",
  "       ranktally pairwise [--margins] FILE",
  "",
].join("\n");

function extractTextBlock(readme: string, firstLine: string): string {
  const blocks = [...readme.matchAll(/~~~text\n([\s\S]*?)~~~/g)].map((match) => match[1]);
  const matches = blocks.filter((block) => block?.startsWith(`${firstLine}\n`));
  expect(matches).toHaveLength(1);

  const block = matches[0];
  if (block === undefined) {
    throw new Error(`Missing README text block starting with ${JSON.stringify(firstLine)}`);
  }
  expect(block.endsWith("\n")).toBe(true);
  return block;
}

test("the real entry point rejects the specified malformed UTF-8 stdin bytes exactly", () => {
  const stdinBytes = new Uint8Array([
    0x63, 0x61, 0x6e, 0x64, 0x69, 0x64, 0x61, 0x74, 0x65, 0x73, 0x20, 0x41, 0x20, 0x42, 0x0a, 0x41,
    0xff, 0x0a,
  ]);
  expect(Array.from(stdinBytes)).toEqual([
    0x63, 0x61, 0x6e, 0x64, 0x69, 0x64, 0x61, 0x74, 0x65, 0x73, 0x20, 0x41, 0x20, 0x42, 0x0a, 0x41,
    0xff, 0x0a,
  ]);

  const result = Bun.spawnSync({
    cmd: [process.execPath, "src/main.ts", "tally", "plurality", "-"],
    cwd: REPOSITORY_ROOT,
    stdin: stdinBytes,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30_000,
  });

  expect(result.exitCode).toBe(2);
  expect(Array.from(result.stdout)).toEqual([]);
  expect(Array.from(result.stderr)).toEqual(
    Array.from(new TextEncoder().encode("ranktally: <stdin>: input is not valid UTF-8\n")),
  );
}, 30_000);

test("the README election produces its extracted Schulze output", () => {
  const readme = readFileSync(resolve(REPOSITORY_ROOT, "README.md"), "utf8").replace(/\r\n/g, "\n");
  expect(readme.match(/^## .+$/gm)).toEqual([
    "## Install",
    "## Usage",
    "## Commands",
    "## Methods",
    "## Exit codes",
    "## Development",
  ]);
  expect(readme).toContain("save this as lunch.txt");
  expect(readme).toContain("bun run src/main.ts tally schulze lunch.txt");

  const usage = extractTextBlock(
    readme,
    "usage: ranktally tally [--seats N] [--winner-only] METHOD FILE",
  );
  expect(usage).toBe(EXPECTED_USAGE);
  const election = extractTextBlock(readme, "# lunch vote");
  const expectedOutput = extractTextBlock(readme, "method: schulze");
  const electionBytes = new TextEncoder().encode(election);

  const calls = {
    filePaths: [] as string[],
    stdinReads: 0,
    outTexts: [] as string[],
    errTexts: [] as string[],
  };
  const io: Io = {
    readFile(path) {
      calls.filePaths.push(path);
      return electionBytes;
    },
    readStdin() {
      calls.stdinReads += 1;
      throw new Error("Unexpected stdin read");
    },
    out(text) {
      calls.outTexts.push(text);
    },
    err(text) {
      calls.errTexts.push(text);
    },
  };

  expect(main(["tally", "schulze", "lunch.txt"], io)).toBe(0);
  expect(calls.outTexts).toEqual([expectedOutput]);
  expect(calls.errTexts).toEqual([]);
  expect(calls.filePaths).toEqual(["lunch.txt"]);
  expect(calls.stdinReads).toBe(0);
});
