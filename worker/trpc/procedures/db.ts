import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure, adminProcedure } from "../init.ts";
import { listTables, getTableData, executeSQL } from "../../lib/agent-db.ts";
import { getPool } from "../../db/local-pg.ts";
import { agentDatabases } from "../../../shared/schema.ts";

export const dbRouter = router({
  agents: adminProcedure.query(({ ctx }) => {
    return Array.from(ctx.agentDatabases.keys()).map((id) => ({ id }));
  }),

  tables: adminProcedure
    .input(z.object({ agentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const dbUrl = ctx.agentDatabases.get(input.agentId);
      if (!dbUrl) throw new Error(`No database configured for agent: ${input.agentId}`);
      return listTables(dbUrl);
    }),

  table: adminProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
        tableName: z.string().min(1),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const dbUrl = ctx.agentDatabases.get(input.agentId);
      if (!dbUrl) throw new Error(`No database configured for agent: ${input.agentId}`);
      return getTableData(dbUrl, input.tableName, input.limit, input.offset);
    }),

  register: authedProcedure
    .input(z.object({ agentId: z.string().min(1), dbUrl: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(agentDatabases)
        .values({ agentId: input.agentId, dbUrl: input.dbUrl })
        .onConflictDoUpdate({
          target: agentDatabases.agentId,
          set: { dbUrl: input.dbUrl, updatedAt: new Date() },
        });
      ctx.agentDatabases.set(input.agentId, input.dbUrl);
      return { agentId: input.agentId };
    }),

  provision: authedProcedure
    .input(z.object({ agentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.localPgAdminUrl) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "LOCAL_PG_ADMIN_URL not configured",
        });
      }

      if (ctx.agentDatabases.has(input.agentId)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Database already exists for agent: ${input.agentId}`,
        });
      }

      const safeName = input.agentId.replace(/[^a-zA-Z0-9_]/g, "_");
      const roleName = `agent_${safeName}`;
      const dbName = `agent_${safeName}`;
      const password = crypto.randomUUID().replace(/-/g, "");

      const adminPool = getPool(ctx.localPgAdminUrl);

      // Create role (ignore if exists)
      await adminPool.query(
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${roleName}') THEN
            CREATE ROLE "${roleName}" WITH LOGIN PASSWORD '${password}';
          END IF;
        END $$`
      );

      // Create database (ignore if exists)
      const { rows: existing } = await adminPool.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [dbName]
      );
      if (existing.length === 0) {
        await adminPool.query(`CREATE DATABASE "${dbName}" OWNER "${roleName}"`);
      }

      // Grant privileges
      await adminPool.query(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${roleName}"`);

      // Build connection URL from admin URL, replacing credentials and database
      const agentUrl = new URL(ctx.localPgAdminUrl);
      agentUrl.username = roleName;
      agentUrl.password = password;
      agentUrl.pathname = `/${dbName}`;
      // Remove sslmode params for local connections
      agentUrl.searchParams.delete("sslmode");
      agentUrl.searchParams.delete("channel_binding");

      const dbUrl = agentUrl.toString();

      // Register in the agent_databases table
      await ctx.db
        .insert(agentDatabases)
        .values({ agentId: input.agentId, dbUrl })
        .onConflictDoUpdate({
          target: agentDatabases.agentId,
          set: { dbUrl, updatedAt: new Date() },
        });
      ctx.agentDatabases.set(input.agentId, dbUrl);

      return { agentId: input.agentId, dbName, roleName };
    }),

  execute: authedProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
        sql: z.string().min(1),
        params: z.array(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dbUrl = ctx.agentDatabases.get(input.agentId);
      if (!dbUrl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No database configured for agent: ${input.agentId}`,
        });
      }
      return executeSQL(dbUrl, input.sql, input.params);
    }),
});
