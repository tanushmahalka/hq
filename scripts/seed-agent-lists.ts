import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

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

const LIST_TITLE = "Founders Who Raised in 2024";

const JSON_SCHEMA = {
  type: "object",
  properties: {
    founder_name: { type: "string", title: "Founder" },
    company: { type: "string", title: "Company" },
    raised_amount: { type: "string", title: "Raised" },
    funding_year: { type: "number", title: "Year" },
    source_url: { type: "string", title: "Source URL", format: "uri" },
  },
  required: ["founder_name", "company"],
};

const ROWS = [
  {
    founder_name: "Jane Doe",
    company: "Acme AI",
    raised_amount: "$8M seed",
    funding_year: 2024,
    source_url: "https://example.com/acme-ai-funding",
  },
  {
    founder_name: "Marcus Lee",
    company: "Nimbus Robotics",
    raised_amount: "$22M Series A",
    funding_year: 2024,
    source_url: "https://example.com/nimbus-series-a",
  },
  {
    founder_name: "Priya Nair",
    company: "Ledgerly",
    raised_amount: "$5M seed",
    funding_year: 2024,
    source_url: "https://example.com/ledgerly-seed",
  },
  {
    founder_name: "Tomás Alvarez",
    company: "Verdant Energy",
    raised_amount: "$40M Series B",
    funding_year: 2024,
    source_url: "https://example.com/verdant-series-b",
  },
  {
    founder_name: "Sofia Kowalski",
    company: "Helix Bio",
    raised_amount: "$15M Series A",
    funding_year: 2024,
    source_url: "https://example.com/helix-bio-series-a",
  },
];

async function main() {
  loadProjectEnv();

  const client = new Client({
    connectionString: getRequiredEnv("DATABASE_URL"),
  });

  await client.connect();

  try {
    // Find the first organization to scope the list to.
    const orgResult = await client.query<{ id: string }>(
      "SELECT id FROM organization ORDER BY created_at ASC LIMIT 1",
    );
    const organizationId = orgResult.rows[0]?.id ?? null;
    if (!organizationId) {
      console.warn(
        "No organization found — seeding list with organization_id = NULL. " +
          "It may not appear for org-scoped users.",
      );
    }

    // Idempotency: skip if the list already exists for this org.
    const existing = await client.query<{ id: number }>(
      organizationId
        ? "SELECT id FROM agent_lists WHERE title = $1 AND organization_id = $2 LIMIT 1"
        : "SELECT id FROM agent_lists WHERE title = $1 AND organization_id IS NULL LIMIT 1",
      organizationId ? [LIST_TITLE, organizationId] : [LIST_TITLE],
    );

    if (existing.rows.length > 0) {
      console.log(
        `List "${LIST_TITLE}" already exists (id=${existing.rows[0].id}). Skipping.`,
      );
      return;
    }

    await client.query("BEGIN");

    const listResult = await client.query<{ id: number }>(
      `INSERT INTO agent_lists (title, description, json_schema, organization_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        LIST_TITLE,
        "Founders who closed a funding round in 2024, with source links.",
        JSON.stringify(JSON_SCHEMA),
        organizationId,
      ],
    );

    const listId = listResult.rows[0].id;

    for (let i = 0; i < ROWS.length; i++) {
      await client.query(
        `INSERT INTO agent_list_rows (list_id, data, sort_order)
         VALUES ($1, $2, $3)`,
        [listId, JSON.stringify(ROWS[i]), i],
      );
    }

    await client.query("COMMIT");

    console.log(
      `Seeded list "${LIST_TITLE}" (id=${listId}) with ${ROWS.length} rows` +
        (organizationId ? ` for organization ${organizationId}.` : "."),
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
