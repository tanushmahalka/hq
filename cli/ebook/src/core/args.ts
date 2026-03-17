import { CliError } from "./errors.ts";

type FlagType = "boolean" | "string";

interface FlagSchema {
  [flag: string]: FlagType;
}

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, boolean | string>;
}

export function parseArgs(argv: string[], schema: FlagSchema): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, boolean | string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const flagType = schema[token];
    if (!flagType) {
      throw new CliError(`Unknown option: ${token}`, 2);
    }

    if (flagType === "boolean") {
      flags[token] = true;
      continue;
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      throw new CliError(`Option ${token} expects a value`, 2);
    }

    flags[token] = nextValue;
    index += 1;
  }

  return { positionals, flags };
}

export function getBooleanFlag(parsed: ParsedArgs, flag: string): boolean {
  return parsed.flags[flag] === true;
}

export function getStringFlag(parsed: ParsedArgs, flag: string): string | undefined {
  const value = parsed.flags[flag];
  return typeof value === "string" ? value : undefined;
}
