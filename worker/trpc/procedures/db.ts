import { z } from "zod";
import { router, adminProcedure } from "../init";
import { listTables, getTableData } from "../../lib/agent-db";

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
});
