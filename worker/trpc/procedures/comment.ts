import { z } from "zod";
import { eq } from "drizzle-orm";
import { taskComments, tasks } from "../../../shared/schema.ts";
import { router, authedProcedure } from "../init.ts";
import { extractMentions, notifyMentionedAgents } from "../../lib/mentions.ts";

export const commentRouter = router({
  add: authedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        author: z.string().min(1),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [comment] = await ctx.db
        .insert(taskComments)
        .values({
          taskId: input.taskId,
          author: input.author,
          content: input.content,
        })
        .returning();

      // Extract @[agentId] mentions and notify via hooks
      const mentionedAgents = extractMentions(input.content);
      if (mentionedAgents.length > 0) {
        const task = await ctx.db.query.tasks.findFirst({
          where: eq(tasks.id, input.taskId),
        });
        if (task) {
          ctx.waitUntil(
            notifyMentionedAgents(
              ctx,
              mentionedAgents,
              task.id,
              task.title,
              input.author,
              input.content,
            )
          );
        }
      }

      return comment;
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [comment] = await ctx.db
        .select()
        .from(taskComments)
        .where(eq(taskComments.id, input.id));

      if (comment) {
        await ctx.db.delete(taskComments).where(eq(taskComments.id, input.id));
      }
      return { success: true };
    }),
});
