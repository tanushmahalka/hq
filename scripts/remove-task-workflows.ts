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

async function main() {
  loadProjectEnv();

  const client = new Client({
    connectionString: getRequiredEnv("DATABASE_URL"),
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    const tasksBefore = await client.query<{
      total: string;
      formerly_complex: string;
    }>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE workflow_mode = 'complex')::text AS formerly_complex
      FROM tasks
    `);

    await client.query(`
      DELETE FROM task_sessions;
      DELETE FROM task_subtasks;
      DELETE FROM task_workflows;
    `);

    await client.query(`
      ALTER TABLE tasks
      DROP COLUMN IF EXISTS workflow_mode;

      DROP TABLE IF EXISTS task_sessions;
      DROP TABLE IF EXISTS task_subtasks;
      DROP TABLE IF EXISTS task_workflows;

      DROP TYPE IF EXISTS task_session_role;
      DROP TYPE IF EXISTS task_subtask_status;
      DROP TYPE IF EXISTS task_workflow_status;
      DROP TYPE IF EXISTS task_workflow_mode;
    `);

    const tasksAfter = await client.query<{ total: string }>(`
      SELECT COUNT(*)::text AS total
      FROM tasks
    `);

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          ok: true,
          tasksBefore: Number(tasksBefore.rows[0]?.total ?? 0),
          formerlyComplexTasks: Number(tasksBefore.rows[0]?.formerly_complex ?? 0),
          tasksAfter: Number(tasksAfter.rows[0]?.total ?? 0),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
