import { VoteError } from "./ballots";
import { show } from "./text";

export interface OptionSpec {
  name: string;
  kind: "flag" | "int";
  default?: number | boolean;
  lo?: number;
  hi?: number;
}

export interface Parsed {
  values: Record<string, number | boolean>;
  args: string[];
}

export function parseOptions(argv: string[], specs: OptionSpec[]): Parsed {
  const values = new Map<string, number | boolean>();
  const rawIntegers = new Map<string, string>();
  const args: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("-") || argument === "-") {
      args.push(argument);
      continue;
    }

    const equalsIndex = argument.indexOf("=");
    const name = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
    const spec = specs.find((candidate) => candidate.name === name);

    if (spec === undefined || (spec.kind === "flag" && equalsIndex !== -1)) {
      throw new VoteError(`unknown option ${show(argument)}`);
    }

    if (spec.kind === "flag") {
      values.set(spec.name, true);
      continue;
    }

    let value: string;

    if (equalsIndex !== -1) {
      value = argument.slice(equalsIndex + 1);
    } else {
      if (index + 1 >= argv.length) {
        throw new VoteError(`${spec.name} needs a value`);
      }

      index += 1;
      value = argv[index];
    }

    rawIntegers.set(spec.name, value);
  }

  for (const spec of specs) {
    if (spec.kind !== "int" || !rawIntegers.has(spec.name)) {
      continue;
    }

    const value = rawIntegers.get(spec.name);
    if (value === undefined || !/^(?:0|-[1-9][0-9]{0,8}|[1-9][0-9]{0,8})$/.test(value)) {
      throw invalidInteger(spec, value ?? "");
    }

    const parsed = Number(value);
    if (
      parsed < (spec.lo ?? Number.NEGATIVE_INFINITY) ||
      parsed > (spec.hi ?? Number.POSITIVE_INFINITY)
    ) {
      throw invalidInteger(spec, value);
    }

    values.set(spec.name, parsed);
  }

  const result: Record<string, number | boolean> = {};

  for (const spec of specs) {
    if (values.has(spec.name)) {
      const value = values.get(spec.name);
      if (value !== undefined) {
        result[spec.name] = value;
      }
    } else if (spec.default !== undefined) {
      result[spec.name] = spec.default;
    } else if (spec.kind === "flag") {
      result[spec.name] = false;
    } else {
      result[spec.name] = 0;
    }
  }

  return { values: result, args };
}

function invalidInteger(spec: OptionSpec, value: string): VoteError {
  return new VoteError(
    `invalid ${spec.name} ${show(value)} (expected an integer from ${spec.lo} to ${spec.hi})`,
  );
}
