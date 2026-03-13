import { z } from "zod";
import { eq } from "drizzle-orm";
import { campaigns, objectives, missions } from "../../../../shared/custom/schema.ts";
import { CAMPAIGN_STATUSES } from "../../../../shared/custom/types.ts";
import { router, orgProcedure } from "../../init.ts";
import { notifyAgent } from "../../../lib/notify-agent.ts";

export const campaignRouter = router({
  list: orgProcedure
    .input(z.object({ objectiveId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.campaigns.findMany({
        where: eq(campaigns.objectiveId, input.objectiveId),
        orderBy: (c, { asc }) => [asc(c.sortOrder)],
      });
      return rows;
    }),

  create: orgProcedure
    .input(
      z.object({
        objectiveId: z.number().int().positive(),
        title: z.string().min(1),
        description: z.string().optional(),
        hypothesis: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .insert(campaigns)
        .values({
          objectiveId: input.objectiveId,
          title: input.title,
          description: input.description,
          hypothesis: input.hypothesis,
          startDate: input.startDate,
          endDate: input.endDate,
          sortOrder: input.sortOrder ?? 0,
        })
        .returning();

      // Walk up: objective → mission → agent
      const objective = await ctx.db.query.objectives.findFirst({
        where: eq(objectives.id, input.objectiveId),
      });
      if (objective) {
        const mission = await ctx.db.query.missions.findFirst({
          where: eq(missions.id, objective.missionId),
        });
        if (mission) {
          const sessionKey = `agent:${mission.agentId}:mission`;
          ctx.waitUntil(
            notifyAgent(ctx, {
              agentId: mission.agentId,
              message: JSON.stringify({
                type: "campaign.created",
                campaign: {
                  id: campaign.id,
                  title: input.title,
                  objectiveId: input.objectiveId,
                },
              }),
              sessionKey,
            })
          );
        }
      }

      return campaign;
    }),

  update: orgProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        hypothesis: z.string().nullable().optional(),
        learnings: z.string().nullable().optional(),
        status: z.enum(CAMPAIGN_STATUSES).optional(),
        startDate: z.date().nullable().optional(),
        endDate: z.date().nullable().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [campaign] = await ctx.db
        .update(campaigns)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(campaigns.id, id))
        .returning();

      return campaign;
    }),

  delete: orgProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(campaigns).where(eq(campaigns.id, input.id));
      return { success: true };
    }),
});
