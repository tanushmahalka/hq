import fs from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { Client } from "pg";
import { siteCompetitors, competitorRankedKeywords, siteKeywords } from "../drizzle/schema/seo.ts";
import { createDb } from "../worker/db/client.ts";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
const UPSERT_BATCH_SIZE = 500;
const EMBEDDING_BATCH_SIZE = 100;

type RawKeywordRow = {
  siteId: number;
  siteCompetitorId: number;
  keyword: string;
  isRelevant: boolean | null;
  searchVolume: number;
  rank: number;
  keywordDifficulty: string | null;
  searchIntent: string | null;
  capturedAt: string;
};

type AggregatedKeyword = {
  siteId: number;
  keyword: string;
  normalizedKeyword: string;
  isRelevant: boolean | null;
  searchVolume: number | null;
  bestRank: number | null;
  keywordDifficulty: string | null;
  searchIntent: string | null;
  sourceCount: number;
  latestCapturedAt: string;
};

type EmbeddingResponse = {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
};

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function loadProjectEnv() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env"));
  loadEnvFile(path.join(cwd, ".dev.vars"));
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseArgs(argv: string[]) {
  const args = {
    siteId: null as number | null,
    skipEmbeddings: false,
    reembed: false,
    relevantOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--site-id") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --site-id");
      }
      args.siteId = Number.parseInt(value, 10);
      if (!Number.isInteger(args.siteId)) {
        throw new Error(`Invalid --site-id value: ${value}`);
      }
      index += 1;
      continue;
    }

    if (arg === "--skip-embeddings") {
      args.skipEmbeddings = true;
      continue;
    }

    if (arg === "--reembed") {
      args.reembed = true;
      continue;
    }

    if (arg === "--relevant-only") {
      args.relevantOnly = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function normalizeKeyword(keyword: string) {
  return keyword
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toVectorLiteral(values: number[]) {
  if (values.length !== DEFAULT_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${DEFAULT_EMBEDDING_DIMENSIONS} embedding dimensions, received ${values.length}.`,
    );
  }

  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding contains a non-finite value.");
    }
  }

  return `'[${values.join(",")}]'::vector`;
}

function choosePreferredKeyword(currentKeyword: string, nextKeyword: string) {
  const currentTrimmed = currentKeyword.trim();
  const nextTrimmed = nextKeyword.trim();
  if (nextTrimmed.length < currentTrimmed.length) {
    return nextTrimmed;
  }
  return currentTrimmed;
}

function aggregateKeywords(rows: RawKeywordRow[]) {
  const aggregates = new Map<string, AggregatedKeyword & { competitorIds: Set<number> }>();

  for (const row of rows) {
    const normalizedKeyword = normalizeKeyword(row.keyword);
    if (!normalizedKeyword) {
      continue;
    }

    const mapKey = `${row.siteId}:${normalizedKeyword}`;
    const existing = aggregates.get(mapKey);
    const capturedAt = new Date(row.capturedAt).toISOString();

    if (!existing) {
      aggregates.set(mapKey, {
        siteId: row.siteId,
        keyword: row.keyword.trim(),
        normalizedKeyword,
        isRelevant: row.isRelevant,
        searchVolume: row.searchVolume,
        bestRank: row.rank,
        keywordDifficulty: row.keywordDifficulty,
        searchIntent: row.searchIntent,
        sourceCount: 1,
        latestCapturedAt: capturedAt,
        competitorIds: new Set([row.siteCompetitorId]),
      });
      continue;
    }

    existing.keyword = choosePreferredKeyword(existing.keyword, row.keyword);
    existing.searchVolume = Math.max(existing.searchVolume ?? 0, row.searchVolume ?? 0);
    existing.bestRank =
      existing.bestRank === null ? row.rank : Math.min(existing.bestRank, row.rank);

    if (existing.isRelevant !== true) {
      if (row.isRelevant === true) {
        existing.isRelevant = true;
      } else if (existing.isRelevant === null && row.isRelevant === false) {
        existing.isRelevant = false;
      }
    }

    if (capturedAt >= existing.latestCapturedAt) {
      if (row.searchIntent) {
        existing.searchIntent = row.searchIntent;
      }
      if (row.keywordDifficulty !== null) {
        existing.keywordDifficulty = row.keywordDifficulty;
      }
      existing.latestCapturedAt = capturedAt;
    }

    existing.competitorIds.add(row.siteCompetitorId);
    existing.sourceCount = existing.competitorIds.size;
  }

  return Array.from(aggregates.values()).map(({ competitorIds: _ignored, ...keyword }) => keyword);
}

async function upsertSiteKeywords(
  db: ReturnType<typeof createDb>,
  keywords: AggregatedKeyword[],
) {
  const now = new Date().toISOString();

  for (let offset = 0; offset < keywords.length; offset += UPSERT_BATCH_SIZE) {
    const chunk = keywords.slice(offset, offset + UPSERT_BATCH_SIZE);
    if (chunk.length === 0) {
      continue;
    }

    await db
      .insert(siteKeywords)
      .values(
        chunk.map((keyword) => ({
          siteId: keyword.siteId,
          keyword: keyword.keyword,
          normalizedKeyword: keyword.normalizedKeyword,
          keywordSource: "competitor",
          isRelevant: keyword.isRelevant,
          searchVolume: keyword.searchVolume,
          bestRank: keyword.bestRank,
          keywordDifficulty: keyword.keywordDifficulty,
          searchIntent: keyword.searchIntent,
          sourceCount: keyword.sourceCount,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [siteKeywords.siteId, siteKeywords.normalizedKeyword],
        set: {
          keyword: sql`excluded.keyword`,
          keywordSource: sql`excluded.keyword_source`,
          isRelevant: sql`excluded.is_relevant`,
          searchVolume: sql`excluded.search_volume`,
          bestRank: sql`excluded.best_rank`,
          keywordDifficulty: sql`excluded.keyword_difficulty`,
          searchIntent: sql`excluded.search_intent`,
          sourceCount: sql`excluded.source_count`,
          updatedAt: now,
        },
      });
  }
}

async function fetchEmbeddings(inputs: string[], apiKey: string, model: string) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: inputs,
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding request failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as EmbeddingResponse;
  return payload.data
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.embedding);
}

async function embedSiteKeywords(
  db: ReturnType<typeof createDb>,
  options: {
    apiKey: string;
    model: string;
    databaseUrl: string;
    siteId: number | null;
    reembed: boolean;
    relevantOnly: boolean;
  },
) {
  const whereClause = options.siteId === null
    ? options.reembed
      ? options.relevantOnly
        ? sql`${siteKeywords.isRelevant} is true`
        : sql`true`
      : options.relevantOnly
        ? sql`${siteKeywords.isRelevant} is true and ${siteKeywords.embedding} is null`
        : sql`${siteKeywords.embedding} is null`
    : options.reembed
      ? options.relevantOnly
        ? sql`${siteKeywords.siteId} = ${options.siteId} and ${siteKeywords.isRelevant} is true`
        : sql`${siteKeywords.siteId} = ${options.siteId}`
      : options.relevantOnly
        ? sql`${siteKeywords.siteId} = ${options.siteId} and ${siteKeywords.isRelevant} is true and ${siteKeywords.embedding} is null`
        : sql`${siteKeywords.siteId} = ${options.siteId} and ${siteKeywords.embedding} is null`;

  const pendingRows = await db
    .select({
      id: siteKeywords.id,
      keyword: siteKeywords.keyword,
    })
    .from(siteKeywords)
    .where(whereClause)
    .orderBy(siteKeywords.id);

  if (pendingRows.length === 0) {
    console.log("No site keywords need embeddings.");
    return;
  }

  console.log(`Embedding ${pendingRows.length} site keywords...`);

  const client = new Client({ connectionString: options.databaseUrl });
  await client.connect();

  try {
    for (let offset = 0; offset < pendingRows.length; offset += EMBEDDING_BATCH_SIZE) {
      const chunk = pendingRows.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const embeddings = await fetchEmbeddings(
        chunk.map((row) => row.keyword),
        options.apiKey,
        options.model,
      );
      const embeddedAt = new Date().toISOString();
      const valuesSql = chunk
        .map(
          (row, index) =>
            `(${row.id}, ${toVectorLiteral(embeddings[index])})`,
        )
        .join(",\n");

      await client.query(
        `update site_keywords as sk
         set embedding = v.embedding,
             embedding_model = $1,
             embedded_at = $2,
             updated_at = $3
         from (
           values
           ${valuesSql}
         ) as v(id, embedding)
         where sk.id = v.id`,
        [options.model, embeddedAt, embeddedAt],
      );

      console.log(
        `Embedded ${Math.min(offset + EMBEDDING_BATCH_SIZE, pendingRows.length)} / ${pendingRows.length}`,
      );
    }
  } finally {
    await client.end();
  }
}

async function main() {
  loadProjectEnv();

  const { siteId, skipEmbeddings, reembed, relevantOnly } = parseArgs(process.argv.slice(2));
  const databaseUrl = getRequiredEnv("DATABASE_URL");
  const db = createDb(databaseUrl);

  const rawRows = await db
    .select({
      siteId: siteCompetitors.siteId,
      siteCompetitorId: competitorRankedKeywords.siteCompetitorId,
      keyword: competitorRankedKeywords.keyword,
      isRelevant: competitorRankedKeywords.isRelevant,
      searchVolume: competitorRankedKeywords.searchVolume,
      rank: competitorRankedKeywords.rank,
      keywordDifficulty: competitorRankedKeywords.keywordDifficulty,
      searchIntent: competitorRankedKeywords.searchIntent,
      capturedAt: competitorRankedKeywords.capturedAt,
    })
    .from(competitorRankedKeywords)
    .innerJoin(siteCompetitors, eq(siteCompetitors.id, competitorRankedKeywords.siteCompetitorId))
    .where(
      siteId === null
        ? relevantOnly
          ? eq(competitorRankedKeywords.isRelevant, true)
          : undefined
        : relevantOnly
          ? sql`${siteCompetitors.siteId} = ${siteId} and ${competitorRankedKeywords.isRelevant} is true`
          : eq(siteCompetitors.siteId, siteId),
    );

  console.log(`Loaded ${rawRows.length} competitor keyword rows.`);

  const aggregatedKeywords = aggregateKeywords(rawRows as RawKeywordRow[]);
  console.log(`Aggregated ${aggregatedKeywords.length} unique site keywords.`);

  await upsertSiteKeywords(db, aggregatedKeywords);
  console.log("Upserted site keywords.");

  if (skipEmbeddings) {
    console.log("Skipped embeddings by request.");
    return;
  }

  const openAiApiKey = getRequiredEnv("OPENAI_API_KEY");
  const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;

  if (embeddingModel !== DEFAULT_EMBEDDING_MODEL) {
    console.warn(
      `Using ${embeddingModel}. Ensure it returns ${DEFAULT_EMBEDDING_DIMENSIONS}-dimensional vectors for site_keywords.embedding.`,
    );
  }

  await embedSiteKeywords(db, {
    apiKey: openAiApiKey,
    model: embeddingModel,
    databaseUrl,
    siteId,
    reembed,
    relevantOnly,
  });

  const siteScope = siteId === null ? sql`true` : eq(siteKeywords.siteId, siteId);
  const summary = await db
    .select({
      total: sql<number>`count(*)`,
      embedded: sql<number>`count(*) filter (where ${siteKeywords.embedding} is not null)`,
    })
    .from(siteKeywords)
    .where(siteScope);

  const row = summary[0];
  console.log(`Done. ${row?.embedded ?? 0} / ${row?.total ?? 0} site keywords have embeddings.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
