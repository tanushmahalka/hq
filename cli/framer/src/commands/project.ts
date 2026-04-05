import { getBooleanFlag, parseArgs } from "../core/args.ts";
import { withFramer, type SharedDependencies, SHARED_FLAG_SCHEMA } from "../core/framer.ts";
import { printJson, printLine } from "../core/output.ts";

const PROJECT_SCHEMA = {
  ...SHARED_FLAG_SCHEMA,
} as const;

export async function runProjectCommand(
  argv: string[],
  dependencies: SharedDependencies & {
    printJsonImpl?: typeof printJson;
    printLineImpl?: typeof printLine;
  } = {},
): Promise<void> {
  const [action, ...rest] = argv;
  const parsed = parseArgs(rest, PROJECT_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (!action || action === "help" || getBooleanFlag(parsed, "--help")) {
    printHelp(printLineImpl);
    return;
  }

  await withFramer(
    parsed,
    async (framer) => {
      if (action === "info") {
        const projectInfo = await framer.getProjectInfo();
        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(projectInfo);
          return;
        }

        printLineImpl(`Project: ${projectInfo.name}`);
        printLineImpl(`ID: ${projectInfo.id}`);
        printLineImpl(`API v1 ID: ${projectInfo.apiVersion1Id}`);
        return;
      }

      if (action === "publish-info") {
        const publishInfo = await framer.getPublishInfo();
        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(publishInfo);
          return;
        }

        printLineImpl("Production:");
        printLineImpl(`  ${publishInfo.production?.url ?? "(not published)"}`);
        printLineImpl("Staging:");
        printLineImpl(`  ${publishInfo.staging?.url ?? "(not published)"}`);
        return;
      }

      printHelp(printLineImpl);
    },
    dependencies,
  );
}

export function printHelp(printLineImpl: typeof printLine = printLine): void {
  printLineImpl("Framer project commands");
  printLineImpl("");
  printLineImpl("Usage:");
  printLineImpl("  framer project info [--json]");
  printLineImpl("  framer project publish-info [--json]");
}
