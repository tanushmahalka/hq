import "dotenv/config";
import { Client } from "pg";

type CountRow = { row_count: string };
type ForeignKeyMeta = {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  is_nullable: "YES" | "NO";
};
type ConstraintMeta = {
  table_name: string;
  constraint_name: string;
  constraint_type: "p" | "u" | "f" | "c";
  constraint_def: string;
};
type IndexMeta = {
  table_name: string;
  index_name: string;
  index_def: string;
};
type ColumnTypeMeta = {
  table_name: string;
  column_name: string;
  data_type: string;
};

const SCHEMA = "public";
const MIGRATED_TABLES = [
  "imports",
  "accounts",
  "team_members",
  "scrape_runs",
  "contacts",
  "call_tasks",
  "call_logs",
  "account_enrichments",
  "jobs",
  "account_events",
  "missions",
  "objectives",
  "campaigns",
  "sites",
  "pages",
  "site_competitors",
  "competitor_domain_footprints",
  "site_domain_footprints",
  "competitor_ranked_keywords",
  "query_clusters",
  "queries",
  "page_cluster_targets",
  "search_console_daily",
  "analytics_daily",
  "crawl_runs",
  "crawl_page_facts",
  "internal_links",
  "backlink_sources",
  "brand_mentions",
  "outreach_prospects",
  "reviews",
  "business_profiles",
  "assets",
  "task_comments",
] as const;

const EXTRA_LOCKED_TABLES = ["tasks"] as const;

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function quoteQualified(tableName: string, columnName?: string) {
  const table = `${quoteIdent(SCHEMA)}.${quoteIdent(tableName)}`;
  return columnName ? `${table}.${quoteIdent(columnName)}` : table;
}

function mapTableName(tableName: string) {
  return `__map_${tableName}`;
}

function tempColumnName(columnName: string) {
  return `__new_${columnName}`;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function queryCount(client: Client, tableName: string) {
  const result = await client.query<CountRow>(
    `select count(*)::bigint as row_count from ${quoteQualified(tableName)}`,
  );
  return Number(result.rows[0]?.row_count ?? "0");
}

async function ensurePreflight(client: Client) {
  const columnTypes = await client.query<ColumnTypeMeta>(
    `
      select table_name, column_name, data_type
      from information_schema.columns
      where table_schema = $1
        and (
          (table_name = any($2::text[]) and column_name = 'id')
          or (table_name = 'tasks' and column_name = 'campaign_id')
        )
      order by table_name, column_name
    `,
    [SCHEMA, MIGRATED_TABLES],
  );

  for (const row of columnTypes.rows) {
    if (row.table_name === "tasks" && row.column_name === "campaign_id") {
      if (row.data_type !== "text") {
        throw new Error(
          `Expected tasks.campaign_id to be text before migration, found ${row.data_type}`,
        );
      }
      continue;
    }

    if (row.data_type !== "uuid") {
      throw new Error(
        `Expected ${row.table_name}.${row.column_name} to be uuid before migration, found ${row.data_type}`,
      );
    }
  }

  const invalidTaskCampaignIds = await client.query<{ id: string; campaign_id: string }>(
    `
      select id, campaign_id
      from ${quoteQualified("tasks")}
      where campaign_id is not null
        and campaign_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      limit 5
    `,
  );
  if (invalidTaskCampaignIds.rows.length > 0) {
    throw new Error(
      `Found tasks.campaign_id values that are not UUIDs: ${invalidTaskCampaignIds.rows
        .map((row) => `${row.id}=${row.campaign_id}`)
        .join(", ")}`,
    );
  }
}

async function getForeignKeys(client: Client) {
  const result = await client.query<ForeignKeyMeta>(
    `
      select
        tc.table_name,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        cols.is_nullable
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      join information_schema.columns cols
        on cols.table_schema = tc.table_schema
       and cols.table_name = tc.table_name
       and cols.column_name = kcu.column_name
      where tc.table_schema = $1
        and tc.constraint_type = 'FOREIGN KEY'
        and tc.table_name = any($2::text[])
        and ccu.table_name = any($2::text[])
      order by tc.table_name, kcu.column_name
    `,
    [SCHEMA, MIGRATED_TABLES],
  );

  return result.rows;
}

async function getConstraints(client: Client) {
  const result = await client.query<ConstraintMeta>(
    `
      select
        cls.relname as table_name,
        con.conname as constraint_name,
        con.contype as constraint_type,
        pg_get_constraintdef(con.oid, true) as constraint_def
      from pg_constraint con
      join pg_class cls on cls.oid = con.conrelid
      join pg_namespace ns on ns.oid = cls.relnamespace
      where ns.nspname = $1
        and cls.relname = any($2::text[])
      order by
        case con.contype
          when 'p' then 1
          when 'u' then 2
          when 'c' then 3
          when 'f' then 4
          else 5
        end,
        cls.relname,
        con.conname
    `,
    [SCHEMA, MIGRATED_TABLES],
  );

  return result.rows;
}

async function getIndexes(client: Client) {
  const result = await client.query<IndexMeta>(
    `
      select
        tbl.relname as table_name,
        idx.relname as index_name,
        pg_get_indexdef(ind.indexrelid) as index_def
      from pg_index ind
      join pg_class idx on idx.oid = ind.indexrelid
      join pg_class tbl on tbl.oid = ind.indrelid
      join pg_namespace ns on ns.oid = tbl.relnamespace
      left join pg_constraint con on con.conindid = ind.indexrelid
      where ns.nspname = $1
        and tbl.relname = any($2::text[])
        and not ind.indisprimary
        and con.oid is null
      order by tbl.relname, idx.relname
    `,
    [SCHEMA, MIGRATED_TABLES],
  );

  return result.rows;
}

async function main() {
  const databaseUrl = getRequiredEnv("DATABASE_URL");
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '0'");

    const lockedTables = [...MIGRATED_TABLES, ...EXTRA_LOCKED_TABLES]
      .map((tableName) => quoteQualified(tableName))
      .join(", ");
    await client.query(`lock table ${lockedTables} in access exclusive mode`);
    console.log("Locked target tables.");

    await ensurePreflight(client);
    console.log("Preflight checks passed.");

    const foreignKeys = await getForeignKeys(client);
    const constraints = await getConstraints(client);
    const indexes = await getIndexes(client);
    const constraintsToDrop = [...constraints].sort((left, right) => {
      const leftPriority = left.constraint_type === "f" ? 0 : 1;
      const rightPriority = right.constraint_type === "f" ? 0 : 1;
      return leftPriority - rightPriority;
    });

    const countsBefore = new Map<string, number>();
    for (const tableName of MIGRATED_TABLES) {
      countsBefore.set(tableName, await queryCount(client, tableName));
    }
    console.log(
      `Captured metadata for ${MIGRATED_TABLES.length} tables, ${foreignKeys.length} foreign keys, ${constraints.length} constraints, and ${indexes.length} standalone indexes.`,
    );

    for (const tableName of MIGRATED_TABLES) {
      await client.query(`
        create temp table ${quoteIdent(mapTableName(tableName))} on commit drop as
        select
          id as old_id,
          row_number() over (order by id)::integer as new_id
        from ${quoteQualified(tableName)}
      `);

      await client.query(
        `alter table ${quoteQualified(tableName)} add column ${quoteIdent(tempColumnName("id"))} integer`,
      );
    }
    console.log("Created mapping tables and temp ID columns.");

    for (const fk of foreignKeys) {
      await client.query(
        `alter table ${quoteQualified(fk.table_name)} add column ${quoteIdent(tempColumnName(fk.column_name))} integer`,
      );
    }

    await client.query(
      `alter table ${quoteQualified("tasks")} add column ${quoteIdent(tempColumnName("campaign_id"))} integer`,
    );
    console.log("Added temp foreign key columns.");

    for (const tableName of MIGRATED_TABLES) {
      await client.query(`
        update ${quoteQualified(tableName)} as target
        set ${quoteIdent(tempColumnName("id"))} = mapping.new_id
        from ${quoteIdent(mapTableName(tableName))} as mapping
        where target.id = mapping.old_id
      `);
    }
    console.log("Backfilled temp primary key columns.");

    for (const fk of foreignKeys) {
      await client.query(`
        update ${quoteQualified(fk.table_name)} as child
        set ${quoteIdent(tempColumnName(fk.column_name))} = mapping.new_id
        from ${quoteIdent(mapTableName(fk.foreign_table_name))} as mapping
        where child.${quoteIdent(fk.column_name)} is not null
          and child.${quoteIdent(fk.column_name)} = mapping.old_id
      `);
    }

    await client.query(`
      update ${quoteQualified("tasks")} as task
      set ${quoteIdent(tempColumnName("campaign_id"))} = mapping.new_id
      from ${quoteIdent(mapTableName("campaigns"))} as mapping
      where task.campaign_id is not null
        and task.campaign_id::uuid = mapping.old_id
    `);
    console.log("Backfilled temp foreign key columns.");

    for (const tableName of MIGRATED_TABLES) {
      const nullIdCheck = await client.query<CountRow>(
        `
          select count(*)::bigint as row_count
          from ${quoteQualified(tableName)}
          where ${quoteIdent(tempColumnName("id"))} is null
        `,
      );
      if (Number(nullIdCheck.rows[0]?.row_count ?? "0") !== 0) {
        throw new Error(`Backfill failed for ${tableName}.${tempColumnName("id")}`);
      }
    }

    for (const fk of foreignKeys) {
      const nullFkCheck = await client.query<CountRow>(
        `
          select count(*)::bigint as row_count
          from ${quoteQualified(fk.table_name)}
          where ${quoteIdent(fk.column_name)} is not null
            and ${quoteIdent(tempColumnName(fk.column_name))} is null
        `,
      );
      if (Number(nullFkCheck.rows[0]?.row_count ?? "0") !== 0) {
        throw new Error(
          `Backfill failed for ${fk.table_name}.${tempColumnName(fk.column_name)}`,
        );
      }
    }

    const nullTaskCampaigns = await client.query<CountRow>(
      `
        select count(*)::bigint as row_count
        from ${quoteQualified("tasks")}
        where campaign_id is not null
          and ${quoteIdent(tempColumnName("campaign_id"))} is null
      `,
    );
    if (Number(nullTaskCampaigns.rows[0]?.row_count ?? "0") !== 0) {
      throw new Error("Backfill failed for tasks.__new_campaign_id");
    }
    console.log("Backfill validation passed.");

    for (const constraint of constraintsToDrop) {
      await client.query(
        `alter table ${quoteQualified(constraint.table_name)} drop constraint ${quoteIdent(constraint.constraint_name)}`,
      );
    }
    console.log("Dropped existing constraints.");

    for (const index of indexes) {
      await client.query(`drop index ${quoteQualified(index.index_name)}`);
    }
    console.log("Dropped standalone indexes.");

    for (const fk of foreignKeys) {
      await client.query(
        `alter table ${quoteQualified(fk.table_name)} drop column ${quoteIdent(fk.column_name)}`,
      );
      await client.query(
        `alter table ${quoteQualified(fk.table_name)} rename column ${quoteIdent(tempColumnName(fk.column_name))} to ${quoteIdent(fk.column_name)}`,
      );
      if (fk.is_nullable === "NO") {
        await client.query(
          `alter table ${quoteQualified(fk.table_name)} alter column ${quoteIdent(fk.column_name)} set not null`,
        );
      }
    }
    console.log("Swapped foreign key columns.");

    for (const tableName of MIGRATED_TABLES) {
      await client.query(
        `alter table ${quoteQualified(tableName)} drop column ${quoteIdent("id")}`,
      );
      await client.query(
        `alter table ${quoteQualified(tableName)} rename column ${quoteIdent(tempColumnName("id"))} to ${quoteIdent("id")}`,
      );
      await client.query(
        `alter table ${quoteQualified(tableName)} alter column ${quoteIdent("id")} set not null`,
      );
      await client.query(
        `alter table ${quoteQualified(tableName)} alter column ${quoteIdent("id")} add generated by default as identity`,
      );
      await client.query(
        `
          select setval(
            pg_get_serial_sequence($1, 'id'),
            coalesce((select max(id) from ${quoteQualified(tableName)}), 0) + 1,
            false
          )
        `,
        [`${SCHEMA}.${tableName}`],
      );
    }
    console.log("Swapped primary key columns and attached identities.");

    await client.query(
      `alter table ${quoteQualified("tasks")} drop column ${quoteIdent("campaign_id")}`,
    );
    await client.query(
      `alter table ${quoteQualified("tasks")} rename column ${quoteIdent(tempColumnName("campaign_id"))} to ${quoteIdent("campaign_id")}`,
    );
    console.log("Swapped tasks.campaign_id.");

    for (const constraint of constraints.filter((item) => item.constraint_type !== "f")) {
      await client.query(
        `alter table ${quoteQualified(constraint.table_name)} add constraint ${quoteIdent(constraint.constraint_name)} ${constraint.constraint_def}`,
      );
    }
    console.log("Recreated primary, unique, and check constraints.");

    for (const index of indexes) {
      await client.query(index.index_def);
    }
    console.log("Recreated standalone indexes.");

    for (const constraint of constraints.filter((item) => item.constraint_type === "f")) {
      await client.query(
        `alter table ${quoteQualified(constraint.table_name)} add constraint ${quoteIdent(constraint.constraint_name)} ${constraint.constraint_def}`,
      );
    }
    console.log("Recreated foreign key constraints.");

    for (const tableName of MIGRATED_TABLES) {
      const countAfter = await queryCount(client, tableName);
      const countBefore = countsBefore.get(tableName);
      if (countBefore !== countAfter) {
        throw new Error(
          `Row count mismatch for ${tableName}: before=${countBefore}, after=${countAfter}`,
        );
      }

      const nullIds = await client.query<CountRow>(
        `
          select count(*)::bigint as row_count
          from ${quoteQualified(tableName)}
          where id is null
        `,
      );
      if (Number(nullIds.rows[0]?.row_count ?? "0") !== 0) {
        throw new Error(`Null ids remain in ${tableName}`);
      }
    }

    for (const fk of foreignKeys) {
      const orphanCheck = await client.query<CountRow>(
        `
          select count(*)::bigint as row_count
          from ${quoteQualified(fk.table_name)} as child
          left join ${quoteQualified(fk.foreign_table_name)} as parent
            on child.${quoteIdent(fk.column_name)} = parent.id
          where child.${quoteIdent(fk.column_name)} is not null
            and parent.id is null
        `,
      );
      if (Number(orphanCheck.rows[0]?.row_count ?? "0") !== 0) {
        throw new Error(
          `Foreign key validation failed for ${fk.table_name}.${fk.column_name}`,
        );
      }
    }

    const invalidTaskCampaignRefs = await client.query<CountRow>(
      `
        select count(*)::bigint as row_count
        from ${quoteQualified("tasks")} as task
        left join ${quoteQualified("campaigns")} as campaign
          on task.campaign_id = campaign.id
        where task.campaign_id is not null
          and campaign.id is null
      `,
    );
    if (Number(invalidTaskCampaignRefs.rows[0]?.row_count ?? "0") !== 0) {
      throw new Error("tasks.campaign_id contains invalid campaign references after migration");
    }
    console.log("Post-migration validation passed.");

    await client.query("commit");
    console.log("UUID-backed tables successfully migrated to integer IDs.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
