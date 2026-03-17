import { CliError } from "./errors.ts";

type FlagType = "boolean" | "string" | "string[]";

interface FlagSchema {
  [flag: string]: FlagType;
}

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, boolean | string | string[]>;
}

export function parseArgs(argv: string[], schema: FlagSchema): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, boolean | string | string[]> = {};

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

    index += 1;

    if (flagType === "string[]") {
      const current = Array.isArray(flags[token]) ? (flags[token] as string[]) : [];
      current.push(nextValue);
      flags[token] = current;
      continue;
    }

    flags[token] = nextValue;
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

export function getStringArrayFlag(parsed: ParsedArgs, flag: string): string[] {
  const value = parsed.flags[flag];
  return Array.isArray(value) ? value : [];
}

export function getOptionalIntegerFlag(parsed: ParsedArgs, flag: string): number | undefined {
  const value = getStringFlag(parsed, flag);
  if (value === undefined) {
    return undefined;
  }

  const parsedNumber = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedNumber)) {
    throw new CliError(`Option ${flag} expects an integer`, 2);
  }

  return parsedNumber;
}

export function requireFlag(value: string | undefined, flag: string): string {
  if (!value) {
    throw new CliError(`Missing required option: ${flag}`, 2);
  }

  return value;
}
