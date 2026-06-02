import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  agentLists,
  agentListRows,
} from "../../../../drizzle/schema/custom.ts";
import { router, orgProcedure, publicProcedure } from "../../init.ts";
import type { Context } from "../../context.ts";
import {
  AGENT_LIST_API,
  listListInput,
  listGetInput,
  listCreateInput,
  listUpdateInput,
  listDeleteInput,
  rowAddInput,
  rowAddManyInput,
  rowUpdateInput,
  rowDeleteInput,
} from "./agent-list-spec.ts";

/**
 * Load a list and assert the caller may access it. Agents (bearer token)
 * bypass the org check; session users may only touch lists in their org.
 */
async function getAuthorizedList(ctx: Context, listId: number) {
  const list = await ctx.db.query.agentLists.findFirst({
    where: eq(agentLists.id, listId),
  });
  if (!list) {
    throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
  }
  if (
    !ctx.isAgent &&
    ctx.organizationId &&
    list.organizationId &&
    list.organizationId !== ctx.organizationId
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "List not in your organization" });
  }
  return list;
}

export const agentListRouter = router({
  list: orgProcedure
    .input(listListInput.optional())
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.agentId)
        conditions.push(eq(agentLists.agentId, input.agentId));
      if (!ctx.isAgent && ctx.organizationId) {
        conditions.push(eq(agentLists.organizationId, ctx.organizationId));
      }

      const where =
        conditions.length > 1 ? and(...conditions) : conditions[0] ?? undefined;

      return await ctx.db.query.agentLists.findMany({
        where,
        orderBy: (l, { desc }) => [desc(l.createdAt)],
      });
    }),

  get: orgProcedure.input(listGetInput).query(async ({ ctx, input }) => {
    const conditions = [eq(agentLists.id, input.id)];
    if (!ctx.isAgent && ctx.organizationId) {
      conditions.push(eq(agentLists.organizationId, ctx.organizationId));
    }

    const list = await ctx.db.query.agentLists.findFirst({
      where: conditions.length > 1 ? and(...conditions) : conditions[0],
      with: {
        rows: { orderBy: (r, { asc }) => [asc(r.sortOrder)] },
      },
    });
    return list ?? null;
  }),

  create: orgProcedure
    .input(listCreateInput)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.isAgent ? input.organizationId : ctx.organizationId;
      const [list] = await ctx.db
        .insert(agentLists)
        .values({
          title: input.title,
          description: input.description,
          jsonSchema: input.jsonSchema,
          agentId: input.agentId,
          organizationId: orgId ?? null,
        })
        .returning();
      return list;
    }),

  update: orgProcedure
    .input(listUpdateInput)
    .mutation(async ({ ctx, input }) => {
      await getAuthorizedList(ctx, input.id);
      const { id, ...data } = input;
      const [list] = await ctx.db
        .update(agentLists)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(agentLists.id, id))
        .returning();
      return list;
    }),

  delete: orgProcedure
    .input(listDeleteInput)
    .mutation(async ({ ctx, input }) => {
      await getAuthorizedList(ctx, input.id);
      await ctx.db.delete(agentLists).where(eq(agentLists.id, input.id));
      return { success: true };
    }),

  addRow: orgProcedure.input(rowAddInput).mutation(async ({ ctx, input }) => {
    await getAuthorizedList(ctx, input.listId);
    const [row] = await ctx.db
      .insert(agentListRows)
      .values({
        listId: input.listId,
        data: input.data,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    return row;
  }),

  addRows: orgProcedure
    .input(rowAddManyInput)
    .mutation(async ({ ctx, input }) => {
      await getAuthorizedList(ctx, input.listId);
      const rows = await ctx.db
        .insert(agentListRows)
        .values(
          input.rows.map((r, i) => ({
            listId: input.listId,
            data: r.data,
            sortOrder: r.sortOrder ?? i,
          })),
        )
        .returning();
      return rows;
    }),

  updateRow: orgProcedure
    .input(rowUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.agentListRows.findFirst({
        where: eq(agentListRows.id, input.id),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });
      }
      await getAuthorizedList(ctx, existing.listId);

      const { id, ...data } = input;
      const [row] = await ctx.db
        .update(agentListRows)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(agentListRows.id, id))
        .returning();
      return row;
    }),

  deleteRow: orgProcedure
    .input(rowDeleteInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.agentListRows.findFirst({
        where: eq(agentListRows.id, input.id),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });
      }
      await getAuthorizedList(ctx, existing.listId);
      await ctx.db
        .delete(agentListRows)
        .where(eq(agentListRows.id, input.id));
      return { success: true };
    }),

  /**
   * Self-describing endpoint: returns the live JSON Schema for every operation,
   * derived from the Zod definitions. The agent can fetch this any time to get
   * the current API shape — it cannot drift from the code.
   */
  apiSchema: publicProcedure.query(() => {
    return {
      name: "Agent Lists API",
      baseUrl: "/api/trpc",
      auth: "Authorization: Bearer <AGENT_API_TOKEN>",
      transport:
        "tRPC v11 with superjson. Query: GET /api/trpc/<method>?input=<urlencoded {\"json\": <args>}>. " +
        'Mutation: POST /api/trpc/<method> with JSON body {"json": <args>}. ' +
        'Result is returned at result.data.json in the response body.',
      rowShapeNote:
        "Each row's `data` keys come from its parent list's json_schema.properties. " +
        "Fetch a list via custom.agentList.get to learn its column shape before adding rows.",
      operations: AGENT_LIST_API.map((op) => ({
        method: op.method,
        type: op.type,
        summary: op.summary,
        input: z.toJSONSchema(op.input),
      })),
    };
  }),
});
