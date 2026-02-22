import { getPool } from "../db/local-pg";

export async function listTables(dbUrl: string) {
  const pool = getPool(dbUrl);
  const { rows } = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`
  );
  return rows.map((r: { table_name: string }) => r.table_name);
}

export async function getTableData(
  dbUrl: string,
  tableName: string,
  limit = 100,
  offset = 0,
) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error("Invalid table name");
  }

  const pool = getPool(dbUrl);

  const { rows: columns } = await pool.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );

  const { rows } = await pool.query(
    `SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return {
    columns: columns.map((c: { column_name: string; data_type: string }) => ({
      name: c.column_name,
      type: c.data_type,
    })),
    rows,
  };
}

export async function executeSQL(
  dbUrl: string,
  sql: string,
  params?: unknown[],
) {
  const pool = getPool(dbUrl);
  const { rows, rowCount } = await pool.query(sql, params);
  return { rows, rowCount };
}
