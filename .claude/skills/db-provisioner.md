# Skill: Database Provisioner

You are the lead agent responsible for provisioning and registering databases for other agents. Each agent gets its own isolated PostgreSQL database to store data as they see fit.

---

## How It Works

Agent databases are tracked in a central **registry** (the `agent_databases` table in HQ's main database). The registry maps each agent ID to a connection URL. There are two ways to give an agent a database:

1. **Provision** — creates a brand-new database on the local PostgreSQL server
2. **Register** — records an existing database URL (e.g. a Neon database) in the registry

---

## Available tRPC Procedures

All procedures are on the `db` router. Auth: Bearer token via `AGENT_API_TOKEN`.

### `db.provision` (mutation)

Creates a new PostgreSQL database and role on the local PG server, then registers it.

```
Input:  { agentId: string }
Output: { agentId, dbName, roleName }
```

- Creates role `agent_<agentId>` with a random password
- Creates database `agent_<agentId>` owned by that role
- Stores the connection URL in the registry
- **Fails** if the agent already has a database (409 Conflict)
- **Fails** if `LOCAL_PG_ADMIN_URL` is not configured (412 Precondition Failed)

### `db.register` (mutation)

Registers an existing database URL for an agent. Use this for Neon databases or any pre-existing PostgreSQL instance.

```
Input:  { agentId: string, dbUrl: string }
Output: { agentId }
```

- Upserts — if the agent already has a database, the URL is updated
- The URL can point to any PostgreSQL-compatible database (local, Neon, Supabase, etc.)

### `db.agents` (query)

Lists all agents that have a registered database.

```
Input:  (none)
Output: [{ id: string }, ...]
```

### `db.execute` (mutation)

Runs SQL on an agent's database. Use this to set up tables, seed data, or run migrations for a newly provisioned agent.

```
Input:  { agentId: string, sql: string, params?: unknown[] }
Output: { rows: any[], rowCount: number }
```

---

## Provisioning Workflow

When a new agent needs a database:

1. Call `db.provision({ agentId: "<agent-name>" })`
2. Optionally call `db.execute` to create initial tables:
   ```
   db.execute({
     agentId: "<agent-name>",
     sql: "CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())"
   })
   ```
3. The agent can now use `db.execute` to read/write its own database

When registering an existing external database (e.g. Neon):

1. Call `db.register({ agentId: "<agent-name>", dbUrl: "postgresql://..." })`
2. Done — the agent's database is now accessible through `db.execute`, `db.tables`, etc.

---

## Infrastructure

- **Local PG** (`LOCAL_PG_ADMIN_URL`) — the PostgreSQL server where new databases are provisioned. Runs on the same EC2 instance as the agents.
- **HQ Database** (`DATABASE_URL`, Neon) — stores the registry table (`agent_databases`) alongside HQ's own tables. This is NOT where agent databases live.
- Each provisioned agent gets its own isolated database and role — agents cannot access each other's data.
