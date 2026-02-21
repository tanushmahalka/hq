import { neon } from "@neondatabase/serverless";

export async function listTables(dbUrl: string) {
  const sql = neon(dbUrl);
  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  return rows.map((r) => r.table_name as string);
}

export async function getTableData(
  dbUrl: string,
  tableName: string,
  limit = 100,
  offset = 0,
) {
  // Validate table name to prevent SQL injection (only allow alphanumeric + underscores)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error("Invalid table name");
  }

  const sql = neon(dbUrl);

  const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;

  // Table name is validated above so safe to interpolate.
  // Use .query() for string-based SQL with $N placeholders.
  const rows = await sql.query(
    `SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  return {
    columns: columns.map((c) => ({
      name: c.column_name as string,
      type: c.data_type as string,
    })),
    rows,
  };
}
