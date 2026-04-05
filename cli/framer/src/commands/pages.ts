import { getBooleanFlag, parseArgs } from "../core/args.ts";
import { withFramer, type SharedDependencies, SHARED_FLAG_SCHEMA } from "../core/framer.ts";
import { printJson, printLine } from "../core/output.ts";
import { listPages, serializeNode } from "../core/resolvers.ts";

const PAGES_SCHEMA = {
  ...SHARED_FLAG_SCHEMA,
} as const;

export async function runPagesCommand(
  argv: string[],
  dependencies: SharedDependencies & {
    printJsonImpl?: typeof printJson;
    printLineImpl?: typeof printLine;
  } = {},
): Promise<void> {
  const [action, ...rest] = argv;
  const parsed = parseArgs(rest, PAGES_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (action === "help" || getBooleanFlag(parsed, "--help")) {
    printHelp(printLineImpl);
    return;
  }

  if (action !== "list") {
    printHelp(printLineImpl);
    return;
  }

  await withFramer(
    parsed,
    async (framer) => {
      const pages = await listPages(framer);
      const payload = pages.map(serializeNode);

      if (getBooleanFlag(parsed, "--json")) {
        printJsonImpl(payload);
        return;
      }

      printLineImpl(`Found ${pages.length} page(s)`);
      printLineImpl("");
      for (const page of pages) {
        printLineImpl(`${page.path ?? "(no path)"}\t${page.id}`);
      }
    },
    dependencies,
  );
}

export function printHelp(printLineImpl: typeof printLine = printLine): void {
  printLineImpl("Framer page commands");
  printLineImpl("");
  printLineImpl("Usage:");
  printLineImpl("  framer pages list [--json]");
}
