import { readFile } from "node:fs/promises";

import { getBooleanFlag, getStringFlag, parseArgs } from "../../core/args.ts";
import { readConfig, resolveOpenRouterConfig } from "../../core/config.ts";
import { CliError } from "../../core/errors.ts";
import { printJson, printLine } from "../../core/output.ts";
import { OpenRouterClient, type KeywordClassification } from "../../providers/openrouter/client.ts";

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 16;
const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1_000;

const KEYWORDS_CLASSIFY_RELEVANCE_SCHEMA = {
  "--query": "string",
  "--jsonl": "string",
  "--brand": "string",
  "--model": "string",
  "--concurrency": "string",
  "--json": "boolean",
  "--help": "boolean",
} as const;

export interface JsonlKeywordRecord {
  query: string;
  source: Record<string, unknown>;
}

interface RunKeywordsClassifyRelevanceDependencies {
  resolvedConfig?: ReturnType<typeof resolveOpenRouterConfig>;
  createClient?: (config: ReturnType<typeof resolveOpenRouterConfig>) => OpenRouterClientLike;
  readFileImpl?: typeof readFile;
  readStdinImpl?: () => Promise<string>;
  writeStdoutImpl?: (value: string) => void;
  printJsonImpl?: typeof printJson;
  printLineImpl?: typeof printLine;
  sleepImpl?: (ms: number) => Promise<void>;
}

interface OpenRouterClientLike {
  classifyKeyword(options: { query: string; brandOverview: string; model?: string }): Promise<KeywordClassification>;
}

export async function runKeywordsClassifyRelevanceCommand(
  argv: string[],
  dependencies: RunKeywordsClassifyRelevanceDependencies = {},
): Promise<void> {
  const parsed = parseArgs(argv, KEYWORDS_CLASSIFY_RELEVANCE_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;
  const writeStdoutImpl = dependencies.writeStdoutImpl ?? ((value: string) => process.stdout.write(value));
  const sleepImpl = dependencies.sleepImpl ?? defaultSleep;

  if (getBooleanFlag(parsed, "--help")) {
    printKeywordsClassifyRelevanceHelp(printLineImpl);
    return;
  }

  const query = getStringFlag(parsed, "--query");
  const jsonlPath = getStringFlag(parsed, "--jsonl");
  const brandOverview = getStringFlag(parsed, "--brand");
  const model = getStringFlag(parsed, "--model") ?? DEFAULT_MODEL;

  if (!brandOverview) {
    throw new CliError("`seo keywords classify-relevance` requires `--brand`.", 2);
  }

  if ((query ? 1 : 0) + (jsonlPath ? 1 : 0) !== 1) {
    throw new CliError("Provide exactly one of `--query` or `--jsonl`.", 2);
  }

  const config = dependencies.resolvedConfig ?? resolveOpenRouterConfig(await readConfig());
  const client = dependencies.createClient?.(config) ?? new OpenRouterClient({ config });

  if (query) {
    const result = await classifyWithRetries(
      { query, brandOverview, model },
      {
        client,
        sleepImpl,
      },
    );

    if (getBooleanFlag(parsed, "--json")) {
      printJsonImpl(result.relevant);
      return;
    }

    printLineImpl(String(result.relevant));
    return;
  }

  const records = parseJsonlKeywordRecords(
    await readTextInput(jsonlPath!, dependencies.readFileImpl ?? readFile, dependencies.readStdinImpl ?? readStdin),
  );
  const concurrency = parseConcurrency(getStringFlag(parsed, "--concurrency"));
  const results = await mapWithConcurrency(records, concurrency, async (record) => {
    const classification = await classifyWithRetries(
      {
        query: record.query,
        brandOverview,
        model,
      },
      {
        client,
        sleepImpl,
      },
    );

    return {
      ...record.source,
      query: record.query,
      relevant: classification.relevant,
    };
  });

  if (getBooleanFlag(parsed, "--json")) {
    printJsonImpl({
      total: results.length,
      relevant: results.filter((result) => (result as { relevant: boolean }).relevant).length,
      notRelevant: results.filter((result) => !(result as { relevant: boolean }).relevant).length,
      model,
      results,
    });
    return;
  }

  for (const result of results) {
    writeStdoutImpl(`${JSON.stringify(result)}\n`);
  }
}

function printKeywordsClassifyRelevanceHelp(printLineImpl: typeof printLine): void {
  printLineImpl("Usage:");
  printLineImpl("  seo keywords classify-relevance (--query <keyword> | --jsonl <path|->) --brand <overview> [--model <model>] [--concurrency <n>] [--json]");
  printLineImpl("");
  printLineImpl("Options:");
  printLineImpl("  --query <keyword>      Classify a single keyword");
  printLineImpl("  --jsonl <path|->       Read newline-delimited JSON records from a file or stdin");
  printLineImpl("  --brand <overview>     Paragraph describing the business, offer, and target customer");
  printLineImpl(`  --model <model>        OpenRouter model ID, defaults to \`${DEFAULT_MODEL}\``);
  printLineImpl(`  --concurrency <n>      Parallel JSONL workers, defaults to ${DEFAULT_CONCURRENCY}`);
  printLineImpl("  --json                 Emit a JSON boolean for single query mode, or an aggregate JSON object for JSONL mode");
  printLineImpl("");
  printLineImpl("JSONL input:");
  printLineImpl("  Each line may be a JSON string or an object with `query`, `keyword`, or `term`.");
}

async function classifyWithRetries(
  options: { query: string; brandOverview: string; model: string },
  dependencies: { client: OpenRouterClientLike; sleepImpl: (ms: number) => Promise<void> },
): Promise<KeywordClassification> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await dependencies.client.classifyKeyword(options);
    } catch (error) {
      lastError = error;
      const retryDelayMs = resolveRetryDelay(error, attempt);

      if (attempt === MAX_ATTEMPTS || retryDelayMs === null) {
        throw error;
      }

      await dependencies.sleepImpl(retryDelayMs);
    }
  }

  throw lastError;
}

function resolveRetryDelay(error: unknown, attempt: number): number | null {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();
  const shouldRetry = lowered.includes(" 429") || lowered.includes("rate limit") || lowered.includes("retry after");

  if (!shouldRetry) {
    return null;
  }

  const retryAfterMatch = /retry after (\d+) second/i.exec(message);
  if (retryAfterMatch) {
    return Number.parseInt(retryAfterMatch[1] ?? "1", 10) * 1_000;
  }

  return BASE_RETRY_DELAY_MS * attempt;
}

function parseJsonlKeywordRecords(contents: string): JsonlKeywordRecord[] {
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new CliError("JSONL input was empty.", 2);
  }

  return lines.map((line, index) => parseJsonlKeywordRecord(line, index + 1));
}

function parseJsonlKeywordRecord(line: string, lineNumber: number): JsonlKeywordRecord {
  let parsed: unknown;

  try {
    parsed = JSON.parse(line);
  } catch (error) {
    throw new CliError(`Failed to parse JSONL line ${lineNumber}: ${(error as Error).message}`);
  }

  if (typeof parsed === "string") {
    const query = parsed.trim();
    if (!query) {
      throw new CliError(`JSONL line ${lineNumber} contained an empty query string.`, 2);
    }

    return {
      query,
      source: { query },
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CliError(
      `JSONL line ${lineNumber} must be a JSON string or object with \`query\`, \`keyword\`, or \`term\`.`,
      2,
    );
  }

  const record = parsed as Record<string, unknown>;
  const query = firstString(record.query, record.keyword, record.term)?.trim();

  if (!query) {
    throw new CliError(`JSONL line ${lineNumber} is missing a string \`query\`, \`keyword\`, or \`term\` field.`, 2);
  }

  return {
    query,
    source: record,
  };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function parseConcurrency(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_CONCURRENCY;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_CONCURRENCY) {
    throw new CliError(`\`--concurrency\` must be an integer between 1 and ${MAX_CONCURRENCY}.`, 2);
  }

  return parsed;
}

async function readTextInput(
  path: string,
  readFileImpl: typeof readFile,
  readStdinImpl: () => Promise<string>,
): Promise<string> {
  if (path === "-") {
    return readStdinImpl();
  }

  try {
    return await readFileImpl(path, "utf8");
  } catch (error) {
    throw new CliError(`Failed to read JSONL input ${path}: ${(error as Error).message}`);
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(values[currentIndex]!, currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
