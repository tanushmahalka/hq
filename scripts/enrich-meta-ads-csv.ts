import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { launchBrowser } from "./facebook-ads-from-page-url.ts";
import { resolveAdsFromWebsiteUrl } from "./facebook-ads-from-website-url.ts";

type CsvRow = Record<string, string>;

type DomainResult = {
  domain: string;
  resolvedFacebookPageUrl: string | null;
  adLibraryPageId: string | null;
  hasActiveMetaAds: boolean;
  activeMetaAdsCount: number;
  status: "success" | "error";
  error: string | null;
};

type DomainFallbackMetadata = {
  title: string | null;
  description: string | null;
};

const OUTPUT_COLUMNS = [
  "resolved_facebook_page_url",
  "meta_ad_library_page_id",
  "has_active_meta_ads",
  "active_meta_ads_count",
  "meta_ads_lookup_status",
  "meta_ads_lookup_error",
] as const;

function usage(): never {
  console.error(
    "Usage: bun run enrich:meta-ads-csv -- <input.csv> [--output <output.csv>] [--concurrency <n>] [--debug]",
  );
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const debug = args.includes("--debug");
  const input = args.find((arg) => !arg.startsWith("--"));
  if (!input) usage();

  const outputIndex = args.indexOf("--output");
  const concurrencyIndex = args.indexOf("--concurrency");

  const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const concurrencyRaw = concurrencyIndex >= 0 ? args[concurrencyIndex + 1] : undefined;
  const concurrency = concurrencyRaw ? Number(concurrencyRaw) : 8;

  if (!Number.isFinite(concurrency) || concurrency <= 0) {
    throw new Error("Concurrency must be a positive number.");
  }

  return {
    input,
    output,
    concurrency,
    debug,
  };
}

function log(debug: boolean, message: string, data?: unknown) {
  if (!debug) return;
  if (typeof data === "undefined") {
    console.error(`[debug] ${message}`);
    return;
  }
  console.error(`[debug] ${message}: ${JSON.stringify(data, null, 2)}`);
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function parseCsv(content: string): { headers: string[]; rows: CsvRow[] } {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      continue;
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const rawHeaders = rows[0] ?? [];
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((header, index) => {
    const normalized = header || `__blank_col_${index}`;
    const count = seen.get(normalized) ?? 0;
    seen.set(normalized, count + 1);
    return count === 0 ? normalized : `${normalized}__${count + 1}`;
  });
  const dataRows = rows.slice(1).map((values) => {
    const out: CsvRow = {};
    headers.forEach((header, index) => {
      out[header] = values[index] ?? "";
    });
    return out;
  });

  return { headers, rows: dataRows };
}

function stringifyCsv(headers: string[], rows: CsvRow[]): string {
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header] ?? "")).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

function normalizeDomain(domain: string): string {
  const trimmed = domain.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function buildOutputPath(input: string, output?: string): string {
  if (output) return output;
  const ext = path.extname(input);
  const base = input.slice(0, input.length - ext.length);
  return `${base} - meta ads enriched${ext || ".csv"}`;
}

function buildCachePath(outputPath: string): string {
  return `${outputPath}.cache.json`;
}

async function loadCache(cachePath: string): Promise<Record<string, DomainResult>> {
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    return JSON.parse(raw) as Record<string, DomainResult>;
  } catch {
    return {};
  }
}

async function saveCache(cachePath: string, cache: Record<string, DomainResult>) {
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
}

async function workerRun(
  domains: string[],
  startIndex: number,
  step: number,
  results: Record<string, DomainResult>,
  fallbackMetadataByDomain: Record<string, DomainFallbackMetadata>,
  cachePath: string,
  debug: boolean,
  progress: { completed: number; total: number },
) {
  const browser = await launchBrowser();

  try {
    for (let index = startIndex; index < domains.length; index += step) {
      const domain = domains[index];
      if (results[domain]) {
        progress.completed += 1;
        continue;
      }

      try {
        const resolution = await resolveAdsFromWebsiteUrl(
          new URL(normalizeDomain(domain)),
          debug,
          browser,
          fallbackMetadataByDomain[domain],
        );
        results[domain] = {
          domain,
          resolvedFacebookPageUrl: resolution.resolvedFacebookPageUrl,
          adLibraryPageId: resolution.adLibraryPageId,
          hasActiveMetaAds: resolution.ads.length > 0,
          activeMetaAdsCount: resolution.ads.length,
          status: "success",
          error: null,
        };
      } catch (error) {
        results[domain] = {
          domain,
          resolvedFacebookPageUrl: null,
          adLibraryPageId: null,
          hasActiveMetaAds: false,
          activeMetaAdsCount: 0,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }

      progress.completed += 1;
      console.error(
        `[progress] ${progress.completed}/${progress.total} ${domain} -> ${results[domain].hasActiveMetaAds ? "ads" : "no-ads"}${results[domain].error ? ` (${results[domain].error})` : ""}`,
      );
      await saveCache(cachePath, results);
    }
  } finally {
    void browser.close().catch(() => {});
  }
}

async function main() {
  const { input, output, concurrency, debug } = parseArgs();
  const inputPath = path.resolve(input);
  const outputPath = path.resolve(buildOutputPath(inputPath, output));
  const cachePath = buildCachePath(outputPath);

  const csvContent = await fs.readFile(inputPath, "utf8");
  const { headers, rows } = parseCsv(csvContent);
  const outputHeaders = [...headers];
  for (const column of OUTPUT_COLUMNS) {
    if (!outputHeaders.includes(column)) {
      outputHeaders.push(column);
    }
  }

  const uniqueDomains = [...new Set(rows.map((row) => row["domain url"]?.trim()).filter(Boolean))];
  const fallbackMetadataByDomain = Object.fromEntries(
    uniqueDomains.map((domain) => {
      const row = rows.find((item) => item["domain url"]?.trim() === domain);
      return [
        domain,
        {
          title: row?.Company?.trim() || null,
          description:
            row?.["meta-description"]?.trim() ||
            row?.["classification reason"]?.trim() ||
            null,
        },
      ];
    }),
  );
  log(debug, "datasetSummary", {
    rowCount: rows.length,
    uniqueDomains: uniqueDomains.length,
    concurrency,
    outputPath,
    cachePath,
  });

  const cache = await loadCache(cachePath);
  for (const domain of Object.keys(cache)) {
    if (!uniqueDomains.includes(domain)) {
      delete cache[domain];
    }
  }
  const progress = {
    completed: 0,
    total: uniqueDomains.length,
  };

  await Promise.all(
    Array.from({ length: concurrency }, (_, index) =>
      workerRun(
        uniqueDomains,
        index,
        concurrency,
        cache,
        fallbackMetadataByDomain,
        cachePath,
        debug,
        progress,
      ),
    ),
  );

  const enrichedRows = rows.map((row) => {
    const domain = row["domain url"]?.trim();
    const result = domain ? cache[domain] : undefined;
    return {
      ...row,
      resolved_facebook_page_url: result?.resolvedFacebookPageUrl ?? "",
      meta_ad_library_page_id: result?.adLibraryPageId ?? "",
      has_active_meta_ads: result ? String(result.hasActiveMetaAds) : "",
      active_meta_ads_count: result ? String(result.activeMetaAdsCount) : "",
      meta_ads_lookup_status: result?.status ?? "",
      meta_ads_lookup_error: result?.error ?? "",
    };
  });

  await fs.writeFile(outputPath, stringifyCsv(outputHeaders, enrichedRows));
  console.error(`[done] wrote ${outputPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
