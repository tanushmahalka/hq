import { getBooleanFlag, getOptionalIntegerFlag, getStringFlag, parseArgs } from "../core/args.ts";
import { CliError } from "../core/errors.ts";
import { withFramer, type SharedDependencies, SHARED_FLAG_SCHEMA } from "../core/framer.ts";
import { printJson, printLine } from "../core/output.ts";
import { inferNodeType, resolvePage, serializeNode } from "../core/resolvers.ts";

const NODES_SCHEMA = {
  ...SHARED_FLAG_SCHEMA,
  "--limit": "string",
  "--name": "string",
  "--node": "string",
  "--page": "string",
  "--type": "string",
} as const;

export async function runNodesCommand(
  argv: string[],
  dependencies: SharedDependencies & {
    printJsonImpl?: typeof printJson;
    printLineImpl?: typeof printLine;
  } = {},
): Promise<void> {
  const [action, ...rest] = argv;
  const parsed = parseArgs(rest, NODES_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (action === "help" || getBooleanFlag(parsed, "--help")) {
    printHelp(printLineImpl);
    return;
  }

  if (action !== "list" && action !== "get") {
    printHelp(printLineImpl);
    return;
  }

  await withFramer(
    parsed,
    async (framer) => {
      if (action === "list") {
        const pagePath = getStringFlag(parsed, "--page");
        const type = getStringFlag(parsed, "--type") ?? "TextNode";
        const nameFilter = getStringFlag(parsed, "--name")?.toLowerCase();
        const limit = getOptionalIntegerFlag(parsed, "--limit");

        const root = pagePath ? await resolvePage(framer, pagePath) : null;
        const nodes = (root ? await root.getNodesWithType(type) : await framer.getNodesWithType(type)).filter(
          (node) => !nameFilter || String((node as { name?: string | null }).name ?? "").toLowerCase().includes(nameFilter),
        );
        const filteredNodes = limit ? nodes.slice(0, limit) : nodes;
        const payload = filteredNodes.map(serializeNode);

        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(payload);
          return;
        }

        printLineImpl(`Found ${filteredNodes.length} ${type} node(s)`);
        printLineImpl("");
        for (const node of filteredNodes) {
          const summary = serializeNode(node);
          printLineImpl(`${summary.id}\t${summary.type}\t${summary.name ?? ""}`);
        }
        return;
      }

      if (action === "get") {
        const nodeId = getStringFlag(parsed, "--node");
        if (!nodeId) {
          throw new CliError(`nodes get requires --node <id>.`, 2);
        }

        const node = await framer.getNode(nodeId);
        if (!node) {
          throw new CliError(`Could not find node "${nodeId}".`, 2);
        }

        const children = typeof (node as { getChildren?: () => Promise<unknown[]> }).getChildren === "function"
          ? await (node as { getChildren: () => Promise<unknown[]> }).getChildren()
          : [];
        const parent = typeof (node as { getParent?: () => Promise<unknown | null> }).getParent === "function"
          ? await (node as { getParent: () => Promise<unknown | null> }).getParent()
          : null;

        const payload = {
          ...serializeNode(node),
          parentId: (parent as { id?: string } | null)?.id ?? null,
          childCount: children.length,
        };

        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(payload);
          return;
        }

        printLineImpl(`Node: ${payload.id}`);
        printLineImpl(`Type: ${payload.type}`);
        printLineImpl(`Name: ${payload.name ?? "(unnamed)"}`);
        if (payload.path) {
          printLineImpl(`Path: ${payload.path}`);
        }
        printLineImpl(`Parent: ${payload.parentId ?? "(root)"}`);
        printLineImpl(`Children: ${payload.childCount}`);
        return;
      }

      printHelp(printLineImpl);
    },
    dependencies,
  );
}

export function printHelp(printLineImpl: typeof printLine = printLine): void {
  printLineImpl("Framer node commands");
  printLineImpl("");
  printLineImpl("Usage:");
  printLineImpl("  framer nodes list [--type <TextNode|FrameNode|WebPageNode|...>] [--page </path>] [--name <text>] [--limit <n>] [--json]");
  printLineImpl("  framer nodes get --node <id> [--json]");
}
