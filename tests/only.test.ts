import { expect, test } from "bun:test";
import { main } from "../src/cli";

const LUNCH =
  "# lunch vote\ncandidates Pizza Ramen Sushi Tacos Salad\n\n7: Tacos > Ramen\n7: Salad > Ramen = Sushi > Tacos\n5: Pizza > Sushi > Salad > Tacos > Ramen\n8: Ramen > Sushi > Tacos > Pizza > Salad\n4: Pizza\n5: Pizza > Tacos > Ramen\n3: Pizza\n7: Sushi > Tacos > Salad = Ramen\n1:\n";

interface Row {
  argv: string[];
  status: number;
  out: string;
  err: string;
}

const ROWS: Row[] = [
  {
    argv: ["compare", "lunch.txt"],
    status: 1,
    out: "method       winner\nplurality    Pizza\nborda        Tacos\nschulze      Sushi\nrankedpairs  Sushi\nstv          Ramen\n",
    err: "",
  },
  {
    argv: ["compare", "--only", "schulze", "lunch.txt"],
    status: 0,
    out: "method   winner\nschulze  Sushi\n",
    err: "",
  },
  {
    argv: ["compare", "--only=schulze,borda", "lunch.txt"],
    status: 1,
    out: "method   winner\nborda    Tacos\nschulze  Sushi\n",
    err: "",
  },
  {
    argv: ["compare", "--only", "stv,borda", "lunch.txt"],
    status: 1,
    out: "method  winner\nborda   Tacos\nstv     Ramen\n",
    err: "",
  },
  {
    argv: ["compare", "--only", "schulze,schulze", "lunch.txt"],
    status: 0,
    out: "method   winner\nschulze  Sushi\n",
    err: "",
  },
  {
    argv: ["compare", "lunch.txt", "--only", "plurality"],
    status: 0,
    out: "method     winner\nplurality  Pizza\n",
    err: "",
  },
  {
    argv: ["compare", "--only", "plurality,borda", "--only", "schulze", "lunch.txt"],
    status: 0,
    out: "method   winner\nschulze  Sushi\n",
    err: "",
  },
  {
    argv: ["compare", "--only", "plurality,rankedpairs,schulze,borda,stv", "lunch.txt"],
    status: 1,
    out: "method       winner\nplurality    Pizza\nborda        Tacos\nschulze      Sushi\nrankedpairs  Sushi\nstv          Ramen\n",
    err: "",
  },
  {
    argv: ["compare", "--only", "", "lunch.txt"],
    status: 2,
    out: "",
    err: 'ranktally: invalid --only "" (expected method names separated by commas)\n',
  },
  {
    argv: ["compare", "--only=", "lunch.txt"],
    status: 2,
    out: "",
    err: 'ranktally: invalid --only "" (expected method names separated by commas)\n',
  },
  {
    argv: ["compare", "--only", "borda,,stv", "lunch.txt"],
    status: 2,
    out: "",
    err: 'ranktally: invalid --only "borda,,stv" (expected method names separated by commas)\n',
  },
  {
    argv: ["compare", "--only", "borda,", "lunch.txt"],
    status: 2,
    out: "",
    err: 'ranktally: invalid --only "borda," (expected method names separated by commas)\n',
  },
  {
    argv: ["compare", "--only", "Schulze", "lunch.txt"],
    status: 2,
    out: "",
    err: 'ranktally: unknown method "Schulze" (expected plurality, borda, schulze, rankedpairs or stv)\n',
  },
  {
    argv: ["compare", "--only", "schulze,irv", "lunch.txt"],
    status: 2,
    out: "",
    err: 'ranktally: unknown method "irv" (expected plurality, borda, schulze, rankedpairs or stv)\n',
  },
  { argv: ["compare", "--only", "schulze"], status: 2, out: "", err: "ranktally: missing FILE\n" },
  {
    argv: ["compare", "--only", "irv"],
    status: 2,
    out: "",
    err: 'ranktally: unknown method "irv" (expected plurality, borda, schulze, rankedpairs or stv)\n',
  },
  { argv: ["compare", "--only"], status: 2, out: "", err: "ranktally: --only needs a value\n" },
  {
    argv: ["compare", "--only", "borda", "a.txt", "b.txt"],
    status: 2,
    out: "",
    err: "ranktally: too many arguments\n",
  },
  {
    argv: ["tally", "--only", "schulze", "schulze", "lunch.txt"],
    status: 2,
    out: "",
    err: 'ranktally: unknown option "--only"\n',
  },
  {
    argv: ["pairwise", "--only=schulze", "lunch.txt"],
    status: 2,
    out: "",
    err: 'ranktally: unknown option "--only=schulze"\n',
  },
];

test("compare --only rows", () => {
  for (const row of ROWS) {
    const out: string[] = [];
    const err: string[] = [];
    const status = main(row.argv, {
      readFile: () => new TextEncoder().encode(LUNCH),
      readStdin: () => new Uint8Array(),
      out: (text) => out.push(text),
      err: (text) => err.push(text),
    });

    expect({ argv: row.argv, status, out: out.join(""), err: err.join("") }).toEqual(row);
  }
});
