import { readFile } from "node:fs/promises";
import { CliError } from "./core/errors.ts";
import { getBooleanFlag, getStringFlag, parseArgs } from "./core/args.ts";
import { getConfigPath, readConfig, saveDatabaseUrl } from "./core/config.ts";
import { printJson, printLine } from "./core/output.ts";
import { requestAgentJson } from "./core/http.ts";

type EbookItem = {
  id: number;
  organizationId: string;
  assetType: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  currentVersion: number;
  storagePath: string | null;
  lastUpdateSource: string;
  updatedAt: string;
};

async function readHtmlInput(
  filePath: string | undefined,
  inlineHtml: string | undefined,
): Promise<string | undefined> {
  if (filePath && inlineHtml) {
    throw new CliError("Use either --file or --html, not both.", 2);
  }

  if (inlineHtml !== undefined) {
    return inlineHtml;
  }

  if (!filePath) {
    return undefined;
  }

  if (filePath === "-") {
    return readStdin();
  }

  return readFile(filePath, "utf8");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function requireFlag(value: string | undefined, flag: string): string {
  if (!value) {
    throw new CliError(`Missing required option: ${flag}`, 2);
  }

  return value;
}

function parseId(value: string | undefined): number {
  const id = Number.parseInt(requireFlag(value, "--id"), 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new CliError("Expected --id to be a positive integer.", 2);
  }
  return id;
}

function printEbookSummary(ebook: EbookItem): void {
  printLine(`id: ${ebook.id}`);
  printLine(`title: ${ebook.title}`);
  printLine(`slug: ${ebook.slug}`);
  printLine(`status: ${ebook.status}`);
  printLine(`version: ${ebook.currentVersion}`);
  printLine(`updatedAt: ${ebook.updatedAt}`);
  printLine(`storagePath: ${ebook.storagePath ?? "pending"}`);
}

async function runListCommand(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv, {
    "--org": "string",
    "--json": "boolean",
    "--api-url": "string",
    "--token": "string",
  });

  const organizationId = requireFlag(getStringFlag(parsed, "--org"), "--org");
  const result = await requestAgentJson<{ items: EbookItem[] }>({
    apiUrl: getStringFlag(parsed, "--api-url"),
    token: getStringFlag(parsed, "--token"),
    path: `/api/marketing/agent/assets?organizationId=${encodeURIComponent(organizationId)}&assetType=ebook`,
  });

  if (getBooleanFlag(parsed, "--json")) {
    printJson(result.items);
    return;
  }

  if (result.items.length === 0) {
    printLine("No ebooks found.");
    return;
  }

  for (const ebook of result.items) {
    printLine(`${ebook.id}\t${ebook.slug}\tv${ebook.currentVersion}\t${ebook.title}`);
  }
}

async function runGetCommand(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv, {
    "--id": "string",
    "--json": "boolean",
    "--api-url": "string",
    "--token": "string",
  });

  const result = await requestAgentJson<{ item: EbookItem }>({
    apiUrl: getStringFlag(parsed, "--api-url"),
    token: getStringFlag(parsed, "--token"),
    path: `/api/marketing/agent/assets/${parseId(getStringFlag(parsed, "--id"))}`,
  });

  if (getBooleanFlag(parsed, "--json")) {
    printJson(result.item);
    return;
  }

  printEbookSummary(result.item);
}

async function runCreateCommand(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv, {
    "--org": "string",
    "--title": "string",
    "--slug": "string",
    "--description": "string",
    "--html": "string",
    "--file": "string",
    "--status": "string",
    "--summary": "string",
    "--updated-by": "string",
    "--json": "boolean",
    "--api-url": "string",
    "--token": "string",
  });

  const html = await readHtmlInput(
    getStringFlag(parsed, "--file"),
    getStringFlag(parsed, "--html"),
  );

  const result = await requestAgentJson<{ item: EbookItem }>({
    apiUrl: getStringFlag(parsed, "--api-url"),
    token: getStringFlag(parsed, "--token"),
    method: "POST",
    path: "/api/marketing/agent/assets",
    body: {
      organizationId: requireFlag(getStringFlag(parsed, "--org"), "--org"),
      assetType: "ebook",
      title: requireFlag(getStringFlag(parsed, "--title"), "--title"),
      slug: getStringFlag(parsed, "--slug"),
      description: getStringFlag(parsed, "--description"),
      html,
      status: getStringFlag(parsed, "--status"),
      summary: getStringFlag(parsed, "--summary"),
      updatedBy: getStringFlag(parsed, "--updated-by"),
      source: "cli",
    },
  });

  if (getBooleanFlag(parsed, "--json")) {
    printJson(result.item);
    return;
  }

  printLine("Created ebook:");
  printEbookSummary(result.item);
}

async function runUpdateCommand(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv, {
    "--id": "string",
    "--title": "string",
    "--slug": "string",
    "--description": "string",
    "--html": "string",
    "--file": "string",
    "--status": "string",
    "--summary": "string",
    "--updated-by": "string",
    "--json": "boolean",
    "--api-url": "string",
    "--token": "string",
  });

  const html = await readHtmlInput(
    getStringFlag(parsed, "--file"),
    getStringFlag(parsed, "--html"),
  );
  const id = parseId(getStringFlag(parsed, "--id"));

  const body = {
    title: getStringFlag(parsed, "--title"),
    slug: getStringFlag(parsed, "--slug"),
    description: getStringFlag(parsed, "--description"),
    html,
    status: getStringFlag(parsed, "--status"),
    summary: getStringFlag(parsed, "--summary"),
    updatedBy: getStringFlag(parsed, "--updated-by"),
    source: "cli",
  };

  const hasMutation =
    body.title !== undefined ||
    body.slug !== undefined ||
    body.description !== undefined ||
    body.html !== undefined ||
    body.status !== undefined ||
    body.summary !== undefined ||
    body.updatedBy !== undefined;

  if (!hasMutation) {
    throw new CliError("No update fields provided.", 2);
  }

  const result = await requestAgentJson<{ item: EbookItem }>({
    apiUrl: getStringFlag(parsed, "--api-url"),
    token: getStringFlag(parsed, "--token"),
    method: "PATCH",
    path: `/api/marketing/agent/assets/${id}`,
    body,
  });

  if (getBooleanFlag(parsed, "--json")) {
    printJson(result.item);
    return;
  }

  printLine("Updated ebook:");
  printEbookSummary(result.item);
}

async function runConfigCommand(argv: string[]): Promise<void> {
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    printLine("Usage:");
    printLine("  ebook config set --database-url <url>");
    printLine("  ebook config get [--json]");
    printLine("  ebook config path");
    return;
  }

  if (subcommand === "set") {
    const parsed = parseArgs(rest, {
      "--database-url": "string",
    });
    const databaseUrl = requireFlag(
      getStringFlag(parsed, "--database-url"),
      "--database-url",
    );

    await saveDatabaseUrl(databaseUrl);
    printLine(`Saved database URL to ${getConfigPath()}`);
    return;
  }

  if (subcommand === "get") {
    const parsed = parseArgs(rest, {
      "--json": "boolean",
    });
    const config = await readConfig();

    if (getBooleanFlag(parsed, "--json")) {
      printJson(config);
      return;
    }

    printLine(`databaseUrl: ${config.databaseUrl ?? "not set"}`);
    return;
  }

  if (subcommand === "path") {
    printLine(getConfigPath());
    return;
  }

  throw new CliError(`Unknown config command: ${subcommand}`, 2);
}

function printHelp(): void {
  printLine("Ebook CLI");
  printLine("");
  printLine("Usage:");
  printLine("  ebook list --org <organization-id> [--json]");
  printLine("  ebook get --id <ebook-id> [--json]");
  printLine("  ebook create --org <organization-id> --title <title> [--slug <slug>] [--description <text>] [--file <path>|--file -|--html <html>] [--status <draft|published|archived>] [--json]");
  printLine("  ebook update --id <ebook-id> [--title <title>] [--slug <slug>] [--description <text>] [--file <path>|--file -|--html <html>] [--status <draft|published|archived>] [--json]");
  printLine("  ebook config set --database-url <url>");
  printLine("  ebook config get [--json]");
  printLine("  ebook config path");
  printLine("");
  printLine("Auth:");
  printLine("  Set AGENT_API_TOKEN and optionally HQ_API_URL, or pass --token / --api-url.");
  printLine("");
  printLine("Config:");
  printLine("  Saves local CLI config to a JSON file in your config directory.");
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "list") {
    await runListCommand(rest);
    return;
  }

  if (command === "get") {
    await runGetCommand(rest);
    return;
  }

  if (command === "create") {
    await runCreateCommand(rest);
    return;
  }

  if (command === "update") {
    await runUpdateCommand(rest);
    return;
  }

  if (command === "config") {
    await runConfigCommand(rest);
    return;
  }

  throw new CliError(`Unknown command: ${command}`, 2);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }

  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exit(1);
});
