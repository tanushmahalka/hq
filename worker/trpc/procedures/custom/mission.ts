import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { missions, campaigns, objectives } from "../../../../shared/custom/schema";
import { MISSION_STATUSES } from "../../../../shared/custom/types";
import { router, orgProcedure } from "../../init";
import { notifyAgent } from "../../../lib/notify-agent";
import { fetchMissionChain } from "../../../lib/mission-chain";

export const missionRouter = router({
  chain: orgProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return fetchMissionChain(ctx.db, input.campaignId);
    }),

  list: orgProcedure
    .input(
      z
        .object({
          agentId: z.string().optional(),
          status: z.enum(MISSION_STATUSES).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.agentId) conditions.push(eq(missions.agentId, input.agentId));
      if (input?.status) conditions.push(eq(missions.status, input.status));
      if (!ctx.isAgent && ctx.organizationId) {
        conditions.push(eq(missions.organizationId, ctx.organizationId));
      }

      const where =
        conditions.length > 1
          ? and(...conditions)
          : conditions[0] ?? undefined;

      const rows = await ctx.db.query.missions.findMany({
        where,
        with: {
          objectives: {
            with: { campaigns: { orderBy: (c, { asc }) => [asc(c.sortOrder)] } },
            orderBy: (o, { asc }) => [asc(o.sortOrder)],
          },
        },
        orderBy: (m, { desc }) => [desc(m.createdAt)],
      });
      return rows;
    }),

  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(missions.id, input.id)];
      if (!ctx.isAgent && ctx.organizationId) {
        conditions.push(eq(missions.organizationId, ctx.organizationId));
      }

      const mission = await ctx.db.query.missions.findFirst({
        where: conditions.length > 1 ? and(...conditions) : conditions[0],
        with: {
          objectives: {
            with: { campaigns: { orderBy: (c, { asc }) => [asc(c.sortOrder)] } },
            orderBy: (o, { asc }) => [asc(o.sortOrder)],
          },
        },
      });
      return mission ?? null;
    }),

  create: orgProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        status: z.enum(MISSION_STATUSES).optional(),
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.isAgent ? input.organizationId : ctx.organizationId;

      const [mission] = await ctx.db
        .insert(missions)
        .values({
          agentId: input.agentId,
          title: input.title,
          description: input.description,
          status: input.status ?? "active",
          organizationId: orgId,
        })
        .returning();

      const sessionKey = `agent:${input.agentId}:mission`;
      ctx.waitUntil(
        notifyAgent(ctx, {
          agentId: input.agentId,
          message: JSON.stringify({
            type: "mission.created",
            mission: {
              id: mission.id,
              title: input.title,
              description: input.description ?? null,
            },
          }),
          sessionKey,
        })
      );

      return mission;
    }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: z.enum(MISSION_STATUSES).optional(),
        metadata: z.record(z.unknown()).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [mission] = await ctx.db
        .update(missions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(missions.id, id))
        .returning();

      if (mission) {
        const sessionKey = `agent:${mission.agentId}:mission`;
        ctx.waitUntil(
          notifyAgent(ctx, {
            agentId: mission.agentId,
            message: JSON.stringify({
              type: "mission.updated",
              mission: {
                id: mission.id,
                title: mission.title,
                description: mission.description,
                status: mission.status,
              },
            }),
            sessionKey,
          })
        );
      }

      return mission;
    }),

  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [mission] = await ctx.db
        .select()
        .from(missions)
        .where(eq(missions.id, input.id));

      if (mission) {
        await ctx.db.delete(missions).where(eq(missions.id, input.id));

        const sessionKey = `agent:${mission.agentId}:mission`;
        ctx.waitUntil(
          notifyAgent(ctx, {
            agentId: mission.agentId,
            message: JSON.stringify({
              type: "mission.deleted",
              mission: { id: mission.id, title: mission.title },
            }),
            sessionKey,
          })
        );
      }

      return { success: true };
    }),
});
