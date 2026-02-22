# Skill: Agent Database

You have your own PostgreSQL database. It is fully yours — you can create tables, store data, and query it however you need. Use it to persist anything relevant to your work: records, logs, scraped data, computed results, state, etc.

---

## How to Use Your Database

All database access goes through the HQ API's `db.execute` procedure. Auth: Bearer token via `AGENT_API_TOKEN`.

### `db.execute` (mutation)

```
Input:  { agentId: "<your-agent-id>", sql: string, params?: unknown[] }
Output: { rows: any[], rowCount: number }
```

Use `$1`, `$2`, etc. for parameterized queries. Always use parameters for user-supplied values — never interpolate strings into SQL.

---

## Examples

### Create a table

```
db.execute({
  agentId: "maya",
  sql: "CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, created_at TIMESTAMPTZ DEFAULT NOW())"
})
```

### Insert data

```
db.execute({
  agentId: "maya",
  sql: "INSERT INTO contacts (name, email) VALUES ($1, $2)",
  params: ["Alice", "alice@example.com"]
})
```

### Query data

```
db.execute({
  agentId: "maya",
  sql: "SELECT * FROM contacts WHERE email LIKE $1 ORDER BY created_at DESC LIMIT $2",
  params: ["%@example.com", 50]
})
// Returns: { rows: [...], rowCount: number }
```

### Update data

```
db.execute({
  agentId: "maya",
  sql: "UPDATE contacts SET email = $1 WHERE id = $2",
  params: ["newemail@example.com", 1]
})
```

### Delete data

```
db.execute({
  agentId: "maya",
  sql: "DELETE FROM contacts WHERE id = $1",
  params: [1]
})
```

### Add a column

```
db.execute({
  agentId: "maya",
  sql: "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone TEXT"
})
```

### List your tables

Use the `db.tables` query instead:
```
db.tables({ agentId: "maya" })
// Returns: ["contacts", "notes", ...]
```

### Inspect a table's data

Use the `db.table` query:
```
db.table({ agentId: "maya", tableName: "contacts", limit: 100, offset: 0 })
// Returns: { columns: [{ name, type }], rows: [...] }
```

---

## Guidelines

- **Your database is yours.** Create whatever schema makes sense for your tasks. No approval needed.
- **Use parameterized queries.** Always use `$1, $2, ...` with the `params` array. Never concatenate values into SQL strings.
- **Use `IF NOT EXISTS` / `IF EXISTS`** for DDL statements (CREATE TABLE, ALTER TABLE) so your setup is idempotent.
- **Clean up after yourself.** Drop tables you no longer need. Don't leave stale data around.
- **Keep schemas simple.** Use basic types: `TEXT`, `INTEGER`, `BOOLEAN`, `TIMESTAMPTZ`, `SERIAL`, `JSONB`. PostgreSQL handles the rest.
