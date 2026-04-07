import { CliError } from "./core/errors.ts";
import { printError, printLine } from "./core/output.ts";
import { runApiCommand } from "./commands/api.ts";
import { runAuthCommand } from "./commands/auth.ts";
import { runContextCommand } from "./commands/context.ts";
import { runResourceGroupCommand } from "./commands/resources.ts";
import { runSchemaCommand } from "./commands/schema.ts";
import { resourceDefinitions } from "./commands/definitions.ts";

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

  if (group === "context") {
    await runContextCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "api") {
    await runApiCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "schema") {
    await runSchemaCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (resourceDefinitions.some((resource) => resource.name === group)) {
    await runResourceGroupCommand(group, [action, ...rest].filter(Boolean) as string[]);
    return;
  }

  throw new CliError(`Unknown command: ${argv.join(" ")}`, 2);
}

function printHelp(): void {
  printLine("Twenty CLI");
  printLine("");
  printLine("JSON-first Twenty CRM tooling for AI agents.");
  printLine("");
  printLine("Usage:");
  printLine("  twenty auth set --base-url <url> --token <token>");
  printLine("  twenty auth show");
  printLine("  twenty context set --depth 1 --limit 50");
  printLine("  twenty schema operations");
  printLine("  twenty schema resource people");
  printLine("  twenty api call --method GET --path /people --query limit=10");
  printLine("  twenty api op --operation-id findManyPeople --query limit=10");
  for (const resource of resourceDefinitions) {
    printLine(`  twenty ${resource.name} list`);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CliError) {
    printError({
      message: error.message,
      status: error.status,
      requestId: error.requestId,
      details: error.details,
    });
    process.exit(error.exitCode);
  }

  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exit(1);
});
