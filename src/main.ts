import { readFileSync } from "node:fs";
import { main } from "./cli";
import type { Io } from "./formats/files";

const io: Io = {
  readFile(path) {
    return readFileSync(path);
  },
  readStdin() {
    return readFileSync(0);
  },
  out(text) {
    process.stdout.write(text);
  },
  err(text) {
    process.stderr.write(text);
  },
};

process.exitCode = main(process.argv.slice(2), io);
