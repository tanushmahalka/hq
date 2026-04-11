import { runApolloCommand } from "./commands/apollo.ts";
import { runAuthCommand } from "./commands/auth.ts";
import { runEnrichCommand } from "./commands/enrich.ts";
import { runFindCommand } from "./commands/find.ts";
import { runProvidersCommand } from "./commands/providers.ts";
import { CliError } from "./core/errors.ts";
import { printLine } from "./core/output.ts";

async function main(argv: string[]): Promise<void> {
  const [group, action, ...rest] = argv;

  if (!group || group === "help" || group === "--help") {
    printHelp();
    return;
  }

  if (group === "auth") {
    await runAuthCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "providers") {
    await runProvidersCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "find") {
    await runFindCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "enrich") {
    await runEnrichCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "apollo") {
    await runApolloCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  throw new CliError(`Unknown command: ${argv.join(" ")}`, 2);
}

function printHelp(): void {
  printLine("Prospect CLI");
  printLine("");
  printLine("Find and enrich prospecting data across providers.");
  printLine("");
  printLine("Usage:");
  printLine("  prospect find person --email <email> [--provider apollo] [--json]");
  printLine("  prospect find account --domain <domain> [--provider apollo] [--json]");
  printLine("  prospect find number --email <email> [--provider apollo] [--json]");
  printLine("  prospect enrich person --email <email> [--provider apollo] [--json]");
  printLine("  prospect enrich account --domain <domain> [--provider apollo] [--json]");
  printLine("  prospect auth set apollo --api-key <key> [--base-url <url>]");
  printLine("  prospect providers list");
  printLine("  prospect apollo find person --email <email> [--json]");
  printLine("  prospect apollo list people --query 'person_titles[]=marketing director' [--json]");
  printLine("  prospect apollo enrich account --domain <domain> [--json]");
  printLine("  prospect apollo api --method GET --path /api/v1/auth/health [--json]");
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }

  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exit(1);
});
