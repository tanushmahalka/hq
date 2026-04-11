import { getBooleanFlag, getOptionalIntegerFlag, getStringFlag, parseArgs, type ParsedArgs } from "../core/args.ts";
import { printHumanEnvelope, printJson } from "../core/output.ts";
import type { AccountLookupInput, CommandEnvelope, PersonLookupInput, RequestOptions } from "../types/normalized.ts";

export const COMMON_SCHEMA = {
  "--provider": "string",
  "--json": "boolean",
  "--raw": "boolean",
  "--debug": "boolean",
  "--timeout-ms": "string",
  "--help": "boolean",
} as const;

export const PERSON_SCHEMA = {
  ...COMMON_SCHEMA,
  "--email": "string",
  "--linkedin-url": "string",
  "--name": "string",
  "--domain": "string",
  "--company": "string",
} as const;

export const ACCOUNT_SCHEMA = {
  ...COMMON_SCHEMA,
  "--domain": "string",
  "--name": "string",
} as const;

export function parsePersonInput(parsed: ParsedArgs): PersonLookupInput {
  return {
    email: getStringFlag(parsed, "--email"),
    linkedinUrl: getStringFlag(parsed, "--linkedin-url"),
    name: getStringFlag(parsed, "--name"),
    domain: getStringFlag(parsed, "--domain"),
    company: getStringFlag(parsed, "--company"),
  };
}

export function parseAccountInput(parsed: ParsedArgs): AccountLookupInput {
  return {
    domain: getStringFlag(parsed, "--domain"),
    name: getStringFlag(parsed, "--name"),
  };
}

export function parseRequestOptions(parsed: ParsedArgs): RequestOptions & { provider?: string; json: boolean } {
  return {
    provider: getStringFlag(parsed, "--provider"),
    json: getBooleanFlag(parsed, "--json"),
    includeRaw: getBooleanFlag(parsed, "--raw"),
    explain: getBooleanFlag(parsed, "--debug"),
    timeoutMs: getOptionalIntegerFlag(parsed, "--timeout-ms"),
  };
}

export function outputEnvelope<T>(envelope: CommandEnvelope<T>, json: boolean): void {
  if (json) {
    printJson(envelope);
    return;
  }

  printHumanEnvelope(envelope as unknown as Parameters<typeof printHumanEnvelope>[0]);
}

export function printFindHelp(): void {
  const parsed = parseArgs([], COMMON_SCHEMA);
  void parsed;
}
