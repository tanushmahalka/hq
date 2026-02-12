import { z } from "zod";
import { eq } from "drizzle-orm";
import { taskComments } from "../../../shared/schema";
import { router, publicProcedure } from "../init";

export const commentRouter = router({
  add: publicProcedure
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
      return comment;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(taskComments)
        .where(eq(taskComments.id, input.id));
      return { success: true };
    }),
});
