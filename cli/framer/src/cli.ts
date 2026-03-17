import { CliError } from "./core/errors.ts";
import { printLine } from "./core/output.ts";
import { runProjectCommand } from "./commands/project.ts";
import { runPagesCommand } from "./commands/pages.ts";
import { runNodesCommand } from "./commands/nodes.ts";
import { runTextCommand } from "./commands/text.ts";
import { runCmsCommand } from "./commands/cms.ts";
import { runCodeCommand } from "./commands/code.ts";

async function main(argv: string[]): Promise<void> {
  const [group, action, ...rest] = argv;

  if (!group || group === "--help" || group === "help") {
    printHelp();
    return;
  }

  if (group === "project") {
    await runProjectCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "pages") {
    await runPagesCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "nodes") {
    await runNodesCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "text") {
    await runTextCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "cms") {
    await runCmsCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  if (group === "code") {
    await runCodeCommand([action, ...rest].filter(Boolean) as string[]);
    return;
  }

  throw new CliError(`Unknown command: ${argv.join(" ")}`, 2);
}

function printHelp(): void {
  printLine("Framer CLI");
  printLine("");
  printLine("Usage:");
  printLine("  framer project info [--json]");
  printLine("  framer project publish-info [--json]");
  printLine("  framer pages list [--json]");
  printLine("  framer nodes list [--page </path>] [--type <TextNode|FrameNode|...>] [--name <text>] [--json]");
  printLine("  framer nodes get --node <id> [--json]");
  printLine("  framer text get --node <id> [--json]");
  printLine("  framer text get --page </path> --name <layer-name> [--json]");
  printLine("  framer text set --node <id> --value <text> [--json]");
  printLine("  framer text set --page </path> --name <layer-name> --value <text> [--json]");
  printLine("  framer cms collections [--json]");
  printLine("  framer cms items --collection <name-or-id> [--json]");
  printLine("  framer cms update --collection <name-or-id> --item <slug-or-id> --field <name-or-id> --value <value> [--json]");
  printLine("  framer code files [--json]");
  printLine("  framer code get --file <id-or-path-or-name> [--json]");
  printLine("  framer code set --file <id-or-path-or-name> --content <code> [--json]");
  printLine("");
  printLine("Global flags:");
  printLine("  --project <url-or-id>   Framer project URL or project ID");
  printLine("  --api-key <token>       Framer API key");
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }

  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exit(1);
});
