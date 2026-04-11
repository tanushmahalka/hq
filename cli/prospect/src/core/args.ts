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

    const type = schema[token];
    if (!type) {
      throw new CliError(`Unknown option: ${token}`, 2);
    }

    if (type === "boolean") {
      flags[token] = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      throw new CliError(`Option ${token} expects a value`, 2);
    }

    index += 1;

    if (type === "string[]") {
      const current = Array.isArray(flags[token]) ? (flags[token] as string[]) : [];
      current.push(next);
      flags[token] = current;
      continue;
    }

    flags[token] = next;
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

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue)) {
    throw new CliError(`Option ${flag} expects an integer`, 2);
  }

  return parsedValue;
}

export function requireFlag(value: string | undefined, flag: string): string {
  if (!value) {
    throw new CliError(`Missing required option: ${flag}`, 2);
  }

  return value;
}
