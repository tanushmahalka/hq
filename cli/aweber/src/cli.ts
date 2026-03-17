import { CliError } from "./core/errors.ts";
import { printLine } from "./core/output.ts";
import { runAuthCommand } from "./commands/auth.ts";
import { runContextCommand } from "./commands/context.ts";
import { runApiCommand } from "./commands/api.ts";
import { runResourceGroupCommand } from "./commands/resources.ts";

async function main(argv: string[]): Promise<void> {
  const [group, action, ...rest] = argv;

  if (!group || group === "--help" || group === "help") {
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

  if (
    [
      "accounts",
      "integrations",
      "lists",
      "custom-fields",
      "landing-pages",
      "segments",
      "webforms",
      "subscribers",
      "broadcasts",
      "campaigns",
      "analytics",
    ].includes(group)
  ) {
    await runResourceGroupCommand(group, [action, ...rest].filter(Boolean) as string[]);
    return;
  }

  throw new CliError(`Unknown command: ${argv.join(" ")}`, 2);
}

function printHelp(): void {
  printLine("AWeber CLI");
  printLine("");
  printLine("Usage:");
  printLine("  aweber auth set --client-id <id> [--client-secret <secret>] [--client-type <public|confidential>] [--redirect-uri <uri>]");
  printLine("  aweber auth login [--json]");
  printLine("  aweber auth exchange-code (--callback-url <url> | --code <code>) [--json]");
  printLine("  aweber auth refresh [--json]");
  printLine("  aweber auth revoke [--json]");
  printLine("  aweber auth logout [--json]");
  printLine("  aweber context set --account-id <id> [--list-id <id>] [--json]");
  printLine("  aweber accounts list [--all] [--json]");
  printLine("  aweber subscribers add --email <email> [--field name='Jane'] [--json]");
  printLine("  aweber broadcasts schedule --broadcast-id <id> --scheduled-for <iso8601> [--json]");
  printLine("  aweber analytics broadcast-links --account-uuid <uuid> --broadcast-uuid <uuid> --filter <clicks|pageviews> [--json]");
  printLine("  aweber api --method GET --path /accounts [--json]");
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }

  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exit(1);
});
