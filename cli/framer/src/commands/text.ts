import { getBooleanFlag, getStringFlag, parseArgs } from "../core/args.ts";
import { CliError } from "../core/errors.ts";
import { withFramer, type SharedDependencies, SHARED_FLAG_SCHEMA } from "../core/framer.ts";
import { printJson, printLine } from "../core/output.ts";
import { readInlineOrFileValue, resolveTextNodeTarget } from "../core/resolvers.ts";

const TEXT_SCHEMA = {
  ...SHARED_FLAG_SCHEMA,
  "--name": "string",
  "--node": "string",
  "--page": "string",
  "--value": "string",
  "--value-file": "string",
} as const;

export async function runTextCommand(
  argv: string[],
  dependencies: SharedDependencies & {
    printJsonImpl?: typeof printJson;
    printLineImpl?: typeof printLine;
  } = {},
): Promise<void> {
  const [action, ...rest] = argv;
  const parsed = parseArgs(rest, TEXT_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  await withFramer(
    parsed,
    async (framer) => {
      const node = await resolveTextNodeTarget(framer, {
        nodeId: getStringFlag(parsed, "--node"),
        pagePath: getStringFlag(parsed, "--page"),
        name: getStringFlag(parsed, "--name"),
      });

      if (action === "get") {
        const text = await node.getText();
        const payload = {
          id: node.id,
          name: node.name ?? null,
          text,
        };

        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(payload);
          return;
        }

        printLineImpl(`Text node: ${node.id}`);
        if (node.name) {
          printLineImpl(`Name: ${node.name}`);
          printLineImpl("");
        }
        printLineImpl(text);
        return;
      }

      if (action === "set") {
        const value = await readInlineOrFileValue({
          value: getStringFlag(parsed, "--value"),
          valueFile: getStringFlag(parsed, "--value-file"),
        });

        await node.setText(value);
        const payload = {
          id: node.id,
          name: node.name ?? null,
          text: value,
        };

        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(payload);
          return;
        }

        printLineImpl(`Updated text node ${node.id}`);
        if (node.name) {
          printLineImpl(`Name: ${node.name}`);
        }
        return;
      }

      throw new CliError(`Unknown text command: ${action ?? "(missing)"}`, 2);
    },
    dependencies,
  );
}

export function printHelp(printLineImpl: typeof printLine = printLine): void {
  printLineImpl("Framer text commands");
  printLineImpl("");
  printLineImpl("Usage:");
  printLineImpl("  framer text get --node <id> [--json]");
  printLineImpl("  framer text get --page </path> --name <layer-name> [--json]");
  printLineImpl("  framer text set --node <id> --value <text> [--json]");
  printLineImpl("  framer text set --page </path> --name <layer-name> --value <text> [--json]");
}
