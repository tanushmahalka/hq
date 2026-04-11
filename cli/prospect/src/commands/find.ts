import { getBooleanFlag, parseArgs } from "../core/args.ts";
import { readConfig, resolveConfig } from "../core/config.ts";
import { CliError } from "../core/errors.ts";
import { printLine } from "../core/output.ts";
import { createProviders, executeWithFallback } from "../providers/index.ts";
import { toEnvelope } from "../providers/apollo/index.ts";
import type { AccountLookupInput, PersonLookupInput } from "../types/normalized.ts";
import { ACCOUNT_SCHEMA, outputEnvelope, parseAccountInput, parsePersonInput, parseRequestOptions, PERSON_SCHEMA } from "./shared.ts";

export async function runFindCommand(
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
    validatePersonFindInput(input);
    const options = parseRequestOptions(parsed);
    const result = await executeWithFallback(
      providers,
      config.defaults.providerOrder,
      options.provider,
      (provider) => provider.findPerson(input, options),
    );
    outputEnvelope(toEnvelope("find", "person", input, result), options.json);
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
      (provider) => provider.findAccount(input, options),
    );
    outputEnvelope(toEnvelope("find", "account", input, result), options.json);
    return;
  }

  if (entity === "number") {
    const parsed = parseArgs(rest, PERSON_SCHEMA);
    if (getBooleanFlag(parsed, "--help")) {
      printHelp();
      return;
    }

    const input = parsePersonInput(parsed);
    validatePersonFindInput(input);
    const options = parseRequestOptions(parsed);
    const result = await executeWithFallback(
      providers,
      config.defaults.providerOrder,
      options.provider,
      (provider) => provider.findNumber(input, options),
    );
    outputEnvelope(toEnvelope("find", "number", input, result), options.json);
    return;
  }

  throw new CliError(`Unknown find entity: ${entity}`, 2);
}

function validatePersonFindInput(input: PersonLookupInput): void {
  if (input.email || input.linkedinUrl) {
    return;
  }

  if (input.name && (input.domain || input.company)) {
    return;
  }

  throw new CliError("Provide --email, --linkedin-url, or --name with --domain/--company.", 2);
}

function validateAccountInput(input: AccountLookupInput): void {
  if (input.domain || input.name) {
    return;
  }

  throw new CliError("Provide --domain or --name.", 2);
}

function printHelp(): void {
  printLine("Prospect find commands");
  printLine("");
  printLine("Usage:");
  printLine("  prospect find person --email <email> [--provider apollo] [--json]");
  printLine("  prospect find person --linkedin-url <url> [--provider apollo] [--json]");
  printLine("  prospect find person --name <name> --domain <domain> [--provider apollo] [--json]");
  printLine("  prospect find account --domain <domain> [--provider apollo] [--json]");
  printLine("  prospect find number --email <email> [--provider apollo] [--json]");
}
