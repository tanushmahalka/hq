import { getBooleanFlag, getStringFlag, parseArgs, requireFlag } from "../core/args.ts";
import { readConfig, resolveAweberConfig, saveAweberTokens } from "../core/config.ts";
import { readJsonInput, parseAssignmentList, toStringRecord } from "../core/http.ts";
import { CliError } from "../core/errors.ts";
import { printHuman, printJson, printLine } from "../core/output.ts";
import { AweberClient } from "../providers/aweber/client.ts";

const API_SCHEMA = {
  "--method": "string",
  "--path": "string",
  "--beta": "boolean",
  "--query": "string[]",
  "--field": "string[]",
  "--form": "string[]",
  "--data": "string",
  "--data-file": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

export async function runApiCommand(
  argv: string[],
  dependencies: {
    fetchImpl?: typeof fetch;
    printJsonImpl?: typeof printJson;
    printLineImpl?: typeof printLine;
  } = {},
): Promise<void> {
  const [action, ...rest] = argv;
  const parsed = parseArgs([action, ...rest].filter(Boolean) as string[], API_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (action === "--help" || action === "help" || getBooleanFlag(parsed, "--help")) {
    printHelp(printLineImpl);
    return;
  }

  const method = (getStringFlag(parsed, "--method") ?? "GET").toUpperCase();
  const path = requireFlag(getStringFlag(parsed, "--path"), "--path");
  const query = parseAssignmentList(parsed.flags["--query"] as string[] ?? []);
  const jsonPayload = await readJsonInput(getStringFlag(parsed, "--data"), getStringFlag(parsed, "--data-file"));
  const fieldPayload = parseAssignmentList(parsed.flags["--field"] as string[] ?? []);
  const formPayload = toStringRecord(parseAssignmentList(parsed.flags["--form"] as string[] ?? [], (value) => value));

  if (jsonPayload !== undefined && Object.keys(fieldPayload).length > 0) {
    throw new CliError("Use either `--data`/`--data-file` or `--field`, not both.", 2);
  }

  const resolved = resolveAweberConfig(await readConfig());
  const client = new AweberClient({
    config: resolved,
    fetchImpl: dependencies.fetchImpl,
    persistTokens: async (tokens) => {
      await saveAweberTokens(tokens);
    },
  });

  const response = await client.request({
    method,
    path,
    version: getBooleanFlag(parsed, "--beta") ? "beta" : "v1",
    query: query as Record<string, string>,
    json: Object.keys(formPayload).length === 0 ? (jsonPayload ?? (Object.keys(fieldPayload).length > 0 ? fieldPayload : undefined)) : undefined,
    form: Object.keys(formPayload).length > 0 ? formPayload : undefined,
  });

  if (getBooleanFlag(parsed, "--json")) {
    printJsonImpl(response.data);
    return;
  }

  printHuman(response.data, printLineImpl);
}

function printHelp(printLineImpl: typeof printLine = printLine): void {
  printLineImpl("AWeber raw API command");
  printLineImpl("");
  printLineImpl("Usage:");
  printLineImpl("  aweber api --method GET --path /accounts [--query ws.start=0] [--json]");
  printLineImpl("  aweber api --method POST --path /accounts/123/lists/456/subscribers --field email=user@example.com [--json]");
  printLineImpl("  aweber api --method POST --path /accounts/123/lists/456/broadcasts --form subject=Hi --form body_html='<p>Hi</p>' --form body_text='Hi' [--json]");
}
