import { getBooleanFlag, parseArgs } from "../core/args.ts";
import { readConfig, resolveConfig } from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { printJson, printLine } from "../core/output.ts";
import { createProviders, executeWithFallback } from "../providers/index.ts";
import type { AccountLookupInput, PersonLookupInput } from "../types/normalized.ts";
import { ACCOUNT_SCHEMA, parseAccountInput, parsePersonInput, parseRequestOptions, PERSON_SCHEMA } from "./shared.ts";

export async function runEnrichCommand(
  argv: string[],
  dependencies: { fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const [entity = "help", ...rest] = argv;

  if (entity === "help" || entity === "--help") {
    printHelp();
    return;
  }

  const config = resolveConfig(await readConfig());
  const providers = createProviders(config, dependencies);

  if (entity === "person") {
    const parsed = parseArgs(rest, PERSON_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printHelp();
      return;
    }

    const input = parsePersonInput(parsed);
    validatePersonInput(input);
    const options = parseRequestOptions(parsed);
    const result = await executeWithFallback(
      providers,
      config.defaults.providerOrder,
      options.provider,
      (provider) => provider.enrichPerson(input, options),
    );
    outputRawEnrichResponse(result.providerRaw);
    return;
  }

  if (entity === "account") {
    const parsed = parseArgs(rest, ACCOUNT_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printHelp();
      return;
    }

    const input = parseAccountInput(parsed);
    validateAccountInput(input);
    const options = parseRequestOptions(parsed);
    const result = await executeWithFallback(
      providers,
      config.defaults.providerOrder,
      options.provider,
      (provider) => provider.enrichAccount(input, options),
    );
    outputRawEnrichResponse(result.providerRaw);
    return;
  }

  throw new CliError(`Unknown enrich entity: ${entity}`, 2);
}

function validatePersonInput(input: PersonLookupInput): void {
  if (input.id || input.email || input.hashedEmail || input.linkedinUrl) {
    return;
  }

  if (input.name && (input.domain || input.company)) {
    return;
  }

  if ((input.firstName || input.lastName) && (input.domain || input.company || input.email || input.hashedEmail)) {
    return;
  }

  throw new CliError("Provide --id, --email, --hashed-email, --linkedin-url, or person name fields with --domain/--company.", 2);
}

function validateAccountInput(input: AccountLookupInput): void {
  if (input.domain || input.name) {
    return;
  }

  throw new CliError("Provide --domain or --name.", 2);
}

function printHelp(): void {
  printLine("Prospect enrich commands");
  printLine("");
  printLine("Usage:");
  printLine("  prospect enrich person --email <email> [--provider apollo] [--json]");
  printLine("  prospect enrich person --id <apollo-id> [--provider apollo] [--json]");
  printLine("  prospect enrich account --domain <domain> [--provider apollo] [--json]");
}

function outputRawEnrichResponse(value: unknown): void {
  printJson(value ?? null);
}
