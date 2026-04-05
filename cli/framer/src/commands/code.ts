import { getBooleanFlag, getStringFlag, parseArgs } from "../core/args.ts";
import { CliError } from "../core/errors.ts";
import { withFramer, type SharedDependencies, SHARED_FLAG_SCHEMA } from "../core/framer.ts";
import { printJson, printLine } from "../core/output.ts";
import { readInlineOrFileValue, resolveCodeFile, serializeCodeFile } from "../core/resolvers.ts";

const CODE_SCHEMA = {
  ...SHARED_FLAG_SCHEMA,
  "--content": "string",
  "--content-file": "string",
  "--file": "string",
} as const;

export async function runCodeCommand(
  argv: string[],
  dependencies: SharedDependencies & {
    printJsonImpl?: typeof printJson;
    printLineImpl?: typeof printLine;
  } = {},
): Promise<void> {
  const [action, ...rest] = argv;
  const parsed = parseArgs(rest, CODE_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (action === "help" || getBooleanFlag(parsed, "--help")) {
    printHelp(printLineImpl);
    return;
  }

  if (action !== "files" && action !== "get" && action !== "set") {
    printHelp(printLineImpl);
    return;
  }

  await withFramer(
    parsed,
    async (framer) => {
      if (action === "files") {
        const files = await framer.getCodeFiles();
        const payload = files.map((file) => serializeCodeFile(file));

        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(payload);
          return;
        }

        printLineImpl(`Found ${files.length} code file(s)`);
        printLineImpl("");
        for (const file of files) {
          printLineImpl(`${file.path}\t${file.id}`);
        }
        return;
      }

      const fileRef = getStringFlag(parsed, "--file");
      if (!fileRef) {
        throw new CliError(`Code commands require --file <id-or-path-or-name>.`, 2);
      }

      const file = await resolveCodeFile(framer, fileRef);

      if (action === "get") {
        const payload = {
          ...serializeCodeFile(file),
          content: file.content,
        };

        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(payload);
          return;
        }

        printLineImpl(`File: ${file.path}`);
        printLineImpl("");
        printLineImpl(file.content);
        return;
      }

      if (action === "set") {
        const content = await readInlineOrFileValue({
          value: getStringFlag(parsed, "--content"),
          valueFile: getStringFlag(parsed, "--content-file"),
        });
        const updated = await file.setFileContent(content);
        const payload = serializeCodeFile(updated);

        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(payload);
          return;
        }

        printLineImpl(`Updated ${updated.path}`);
        printLineImpl(`Version: ${updated.versionId}`);
        return;
      }

      printHelp(printLineImpl);
    },
    dependencies,
  );
}

export function printHelp(printLineImpl: typeof printLine = printLine): void {
  printLineImpl("Framer code commands");
  printLineImpl("");
  printLineImpl("Usage:");
  printLineImpl("  framer code files [--json]");
  printLineImpl("  framer code get --file <id-or-path-or-name> [--json]");
  printLineImpl("  framer code set --file <id-or-path-or-name> --content <code> [--json]");
  printLineImpl("  framer code set --file <id-or-path-or-name> --content-file <path> [--json]");
}
