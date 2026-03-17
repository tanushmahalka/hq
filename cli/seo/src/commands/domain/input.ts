import { readFile } from "node:fs/promises";

import { CliError } from "../../core/errors.ts";
import { normalizeDomainInput } from "../../providers/dataforseo/geo.ts";

export interface LoadDomainTargetsOptions {
  domains: string[];
  file?: string;
  readFileImpl?: typeof readFile;
  readStdinImpl?: () => Promise<string>;
}

export async function loadDomainTargets(options: LoadDomainTargetsOptions): Promise<string[]> {
  const inlineTargets = normalizeDomainTargets(options.domains);
  const fileTargets = options.file
    ? normalizeDomainTargets(
        parseDomainTargetFile(
          await readDomainTargetSource(options.file, options.readFileImpl ?? readFile, options.readStdinImpl ?? readStdin),
        ),
      )
    : [];
  const combined = dedupeStrings([...inlineTargets, ...fileTargets]);

  if (combined.length === 0) {
    throw new CliError("Provide at least one `--domain` or a `--file` with domains.", 2);
  }

  return combined;
}

export function normalizeDomainTargets(inputs: string[]): string[] {
  return dedupeStrings(
    inputs
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => normalizeDomainInput(value)),
  );
}

export function parseDomainTargetFile(contents: string): string[] {
  const trimmed = contents.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJsonDomainTargetFile(trimmed);
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

async function readDomainTargetSource(
  file: string,
  readFileImpl: typeof readFile,
  readStdinImpl: () => Promise<string>,
): Promise<string> {
  if (file === "-") {
    return readStdinImpl();
  }

  try {
    return await readFileImpl(file, "utf8");
  } catch (error) {
    throw new CliError(`Failed to read domain target file ${file}: ${(error as Error).message}`);
  }
}

function parseJsonDomainTargetFile(contents: string): string[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new CliError(`Failed to parse JSON domain target file: ${(error as Error).message}`);
  }

  const values = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { domains?: unknown }).domains)
      ? (parsed as { domains: unknown[] }).domains
      : null;

  if (!values) {
    throw new CliError("JSON domain target files must be either an array of strings or an object with a `domains` array.", 2);
  }

  return values.map((value) => {
    if (typeof value !== "string") {
      throw new CliError("JSON domain target files may contain only string values.", 2);
    }

    return value;
  });
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      deduped.push(value);
    }
  }

  return deduped;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}
