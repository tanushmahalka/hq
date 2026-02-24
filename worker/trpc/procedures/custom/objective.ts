import { z } from "zod";
import { eq } from "drizzle-orm";
import { objectives, missions } from "../../../../shared/custom/schema";
import { OBJECTIVE_STATUSES } from "../../../../shared/custom/types";
import { router, orgProcedure } from "../../init";
import { notifyAgent } from "../../../lib/notify-agent";

export const objectiveRouter = router({
  list: orgProcedure
    .input(z.object({ missionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.objectives.findMany({
        where: eq(objectives.missionId, input.missionId),
        with: { campaigns: { orderBy: (c, { asc }) => [asc(c.sortOrder)] } },
        orderBy: (o, { asc }) => [asc(o.sortOrder)],
      });
      return rows;
    }),

  create: orgProcedure
    .input(
      z.object({
        missionId: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().optional(),
        hypothesis: z.string().optional(),
        targetMetric: z.string().optional(),
        targetValue: z.string().optional(),
        currentValue: z.string().optional(),
        dueDate: z.date().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [objective] = await ctx.db
        .insert(objectives)
        .values({
          missionId: input.missionId,
          title: input.title,
          description: input.description,
          hypothesis: input.hypothesis,
          targetMetric: input.targetMetric,
          targetValue: input.targetValue,
          currentValue: input.currentValue,
          dueDate: input.dueDate,
          sortOrder: input.sortOrder ?? 0,
        })
        .returning();

      // Notify the agent that owns this mission
      const mission = await ctx.db.query.missions.findFirst({
        where: eq(missions.id, input.missionId),
      });
      if (mission) {
        const sessionKey = `agent:${mission.agentId}:mission`;
        ctx.waitUntil(
          notifyAgent(ctx, {
            agentId: mission.agentId,
            message: JSON.stringify({
              type: "objective.created",
              objective: {
                id: objective.id,
                title: input.title,
                missionId: input.missionId,
              },
            }),
            sessionKey,
          })
        );
      }

      return objective;
    }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        hypothesis: z.string().nullable().optional(),
        targetMetric: z.string().nullable().optional(),
        targetValue: z.string().nullable().optional(),
        currentValue: z.string().nullable().optional(),
        status: z.enum(OBJECTIVE_STATUSES).optional(),
        dueDate: z.date().nullable().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [objective] = await ctx.db
        .update(objectives)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(objectives.id, id))
        .returning();

      return objective;
    }),

  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(objectives).where(eq(objectives.id, input.id));
      return { success: true };
    }),
});
