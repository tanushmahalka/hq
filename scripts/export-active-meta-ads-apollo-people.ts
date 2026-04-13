import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

type CsvRow = Record<string, string>;

type ApolloPerson = {
  id?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  email?: string;
  phones?: Array<Record<string, unknown>>;
  linkedinUrl?: string;
  company?: {
    id?: string;
    name?: string;
    domain?: string;
    websiteUrl?: string;
    industry?: string;
    employeeCount?: number;
    location?: string;
  };
  location?: string;
};

type ApolloListResponse = {
  ok: boolean;
  results: ApolloPerson[];
  totalEntries?: number;
  page?: number;
  perPage?: number;
  warnings?: string[];
};

type DomainCacheEntry = {
  status: string;
  people: ApolloPerson[];
};

const TITLE_FILTERS = [
  "Growth Marketer",
  "Head of Growth",
  "VP of marketing",
  "Paid Media Manager",
  "Chief Marketing Officer",
  "Founder",
  "Co-Founder",
  "Owner",
] as const;

const OUTPUT_COLUMNS = [
  "apollo_people_count",
  "apollo_people_json",
  "apollo_people_lookup_status",
] as const;

function usage(): never {
  console.error(
    "Usage: npx tsx scripts/export-active-meta-ads-apollo-people.ts --input <input.csv> [--output <output.csv>] [--per-page <n>]",
  );
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const outputIndex = args.indexOf("--output");
  const perPageIndex = args.indexOf("--per-page");

  const input = inputIndex >= 0 ? args[inputIndex + 1] : args.find((arg) => !arg.startsWith("--"));
  if (!input) usage();

  const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const perPage = perPageIndex >= 0 ? Number.parseInt(args[perPageIndex + 1] ?? "", 10) : 100;

  if (!Number.isFinite(perPage) || perPage <= 0) {
    throw new Error("Per-page must be a positive integer.");
  }

  return {
    input: path.resolve(input),
    output: output ? path.resolve(output) : buildOutputPath(path.resolve(input)),
    perPage,
  };
}

function buildOutputPath(inputPath: string): string {
  const ext = path.extname(inputPath) || ".csv";
  const base = inputPath.slice(0, inputPath.length - ext.length);
  return `${base} - active-meta-ads apollo people.csv`;
}

function buildCachePath(outputPath: string): string {
  return `${outputPath}.cache.json`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
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

  return {
    headers,
    rows: rows.slice(1).map((values) => {
      const out: CsvRow = {};
      headers.forEach((header, index) => {
        out[header] = values[index] ?? "";
      });
      return out;
    }),
  };
}

function stringifyCsv(headers: string[], rows: CsvRow[]): string {
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header] ?? "")).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

function isActiveAdsRow(row: CsvRow): boolean {
  return row["has_active_meta_ads"]?.trim().toLowerCase() === "true";
}

function normalizeDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";

  const candidate = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^www\./, "");
  }
}

async function runProspectListPeople(queryArgs: string[]): Promise<ApolloListResponse> {
  const args = [
    "./cli/prospect/bin/prospect",
    "apollo",
    "list",
    "people",
    ...queryArgs,
    "--json",
  ];

  const { stdout, stderr, code } = await spawnCollect("bash", ["-lc", args.map(shellEscape).join(" ")], process.cwd());
  if (code !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `prospect exited with code ${code}`);
  }

  return JSON.parse(stdout) as ApolloListResponse;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

async function spawnCollect(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

function personOrgDomain(person: ApolloPerson): string {
  return normalizeDomain(person.company?.domain ?? person.company?.websiteUrl ?? "");
}

function dedupePeople(people: ApolloPerson[]): ApolloPerson[] {
  const seen = new Set<string>();
  return people.filter((person) => {
    const key = [
      person.id ?? "",
      person.email ?? "",
      person.linkedinUrl ?? "",
      person.fullName ?? "",
      person.jobTitle ?? "",
      personOrgDomain(person),
    ].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function main() {
  const { input, output, perPage } = parseArgs();
  const cachePath = buildCachePath(output);
  const csv = await fs.readFile(input, "utf8");
  const { headers, rows } = parseCsv(csv);
  const activeRows = rows.filter(isActiveAdsRow);
  const uniqueDomains = [...new Set(activeRows.map((row) => normalizeDomain(row["domain url"] ?? "")).filter(Boolean))];
  const cache = {
    ...(await seedCacheFromExistingOutput(output)),
    ...(await loadCache(cachePath)),
  };
  const resultsByDomain = new Map<string, ApolloPerson[]>(Object.entries(cache).map(([domain, entry]) => [domain, entry.people]));
  const statusByDomain = new Map<string, string>(Object.entries(cache).map(([domain, entry]) => [domain, entry.status]));

  console.error(`[info] active rows: ${activeRows.length}`);
  console.error(`[info] unique active domains: ${uniqueDomains.length}`);
  console.error(`[info] domains already successful: ${Array.from(statusByDomain.values()).filter((value) => value === "success").length}`);

  for (let domainIndex = 0; domainIndex < uniqueDomains.length; domainIndex += 1) {
    const domain = uniqueDomains[domainIndex];
    if ((statusByDomain.get(domain) ?? "") === "success") {
      continue;
    }
    let page = 1;
    let fetched = 0;
    let totalEntries = Number.POSITIVE_INFINITY;
    const domainPeople: ApolloPerson[] = [];

    try {
      while (fetched < totalEntries) {
        const queryArgs = [
          "--query",
          `q_organization_domains_list[]=${domain}`,
          ...TITLE_FILTERS.flatMap((title) => ["--query", `person_titles[]=${title}`]),
          "--query",
          `page=${page}`,
          "--query",
          `per_page=${perPage}`,
        ];

        const response = await runProspectListPeopleWithRetry(queryArgs, domain);
        totalEntries = response.totalEntries ?? response.results.length;
        fetched += response.results.length;
        domainPeople.push(...response.results);

        console.error(
          `[progress] ${domainIndex + 1}/${uniqueDomains.length} ${domain} page ${page} fetched ${fetched}/${Number.isFinite(totalEntries) ? totalEntries : "?"}`,
        );

        if (response.results.length === 0 || response.results.length < perPage) {
          break;
        }

        page += 1;
      }

      resultsByDomain.set(domain, dedupePeople(domainPeople));
      statusByDomain.set(domain, "success");
      await saveCache(cachePath, resultsByDomain, statusByDomain);
    } catch (error) {
      resultsByDomain.set(domain, []);
      statusByDomain.set(domain, error instanceof Error ? error.message : String(error));
      console.error(`[warn] ${domain}: ${statusByDomain.get(domain)}`);
      await saveCache(cachePath, resultsByDomain, statusByDomain);
    }
  }

  const outputHeaders = [...headers];
  for (const column of OUTPUT_COLUMNS) {
    if (!outputHeaders.includes(column)) {
      outputHeaders.push(column);
    }
  }

  const outputRows = activeRows.map((row) => {
    const domain = normalizeDomain(row["domain url"] ?? "");
    const people = resultsByDomain.get(domain) ?? [];
    return {
      ...row,
      apollo_people_count: String(people.length),
      apollo_people_json: JSON.stringify(people),
      apollo_people_lookup_status: statusByDomain.get(domain) ?? "success",
    };
  });

  await fs.writeFile(output, stringifyCsv(outputHeaders, outputRows), "utf8");
  console.error(`[done] wrote ${outputRows.length} rows to ${output}`);
}

async function runProspectListPeopleWithRetry(queryArgs: string[], domain: string): Promise<ApolloListResponse> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await runProspectListPeople(queryArgs);
      await sleep(1400);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/maximum number of api calls allowed/i.test(message) || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = 65_000;
      console.error(`[retry] ${domain}: Apollo rate limit hit, sleeping ${Math.round(delayMs / 1000)}s before retry ${attempt + 1}/${maxAttempts}`);
      await sleep(delayMs);
    }
  }

  throw new Error(`Failed to fetch Apollo people for ${domain}`);
}

async function loadCache(cachePath: string): Promise<Record<string, DomainCacheEntry>> {
  try {
    return JSON.parse(await fs.readFile(cachePath, "utf8")) as Record<string, DomainCacheEntry>;
  } catch {
    return {};
  }
}

async function seedCacheFromExistingOutput(outputPath: string): Promise<Record<string, DomainCacheEntry>> {
  if (!(await fileExists(outputPath))) {
    return {};
  }

  const content = await fs.readFile(outputPath, "utf8");
  const { rows } = parseCsv(content);
  const seeded: Record<string, DomainCacheEntry> = {};

  for (const row of rows) {
    if (!isActiveAdsRow(row)) {
      continue;
    }

    const domain = normalizeDomain(row["domain url"] ?? "");
    if (!domain) {
      continue;
    }

    const status = row["apollo_people_lookup_status"]?.trim();
    if (!status) {
      continue;
    }

    let people: ApolloPerson[] = [];
    const json = row["apollo_people_json"]?.trim();
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          people = parsed as ApolloPerson[];
        }
      } catch {
        people = [];
      }
    }

    seeded[domain] = {
      status,
      people,
    };
  }

  return seeded;
}

async function saveCache(
  cachePath: string,
  resultsByDomain: Map<string, ApolloPerson[]>,
  statusByDomain: Map<string, string>,
): Promise<void> {
  const payload = Object.fromEntries(
    Array.from(statusByDomain.entries()).map(([domain, status]) => [
      domain,
      {
        status,
        people: resultsByDomain.get(domain) ?? [],
      } satisfies DomainCacheEntry,
    ]),
  );

  await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
