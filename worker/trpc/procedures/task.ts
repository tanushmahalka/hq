import { z } from "zod";
import { eq } from "drizzle-orm";
import { tasks } from "../../../shared/schema";
import { TASK_STATUSES } from "../../../shared/types";
import { router, publicProcedure } from "../init";
import { generateTaskSlug } from "../../../shared/slug";

export const taskRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          status: z.enum(TASK_STATUSES).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where = input?.status ? eq(tasks.status, input.status) : undefined;
      const rows = await ctx.db.query.tasks.findMany({
        where,
        with: { comments: true },
        orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
      });
      return rows;
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: eq(tasks.id, input.id),
        with: { comments: { orderBy: (c, { asc }) => [asc(c.createdAt)] } },
      });
      return task ?? null;
    }),

  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        status: z.enum(TASK_STATUSES).optional(),
        assignor: z.string().optional(),
        assignee: z.string().optional(),
        dueDate: z.date().optional(),
        urgent: z.boolean().optional(),
        important: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateTaskSlug(input.title);
      const [task] = await ctx.db
        .insert(tasks)
        .values({
          id,
          title: input.title,
          description: input.description,
          status: input.status ?? "todo",
          assignor: input.assignor,
          assignee: input.assignee,
          dueDate: input.dueDate,
          urgent: input.urgent ?? false,
          important: input.important ?? false,
        })
        .returning();
      return task;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: z.enum(TASK_STATUSES).optional(),
        assignor: z.string().nullable().optional(),
        assignee: z.string().nullable().optional(),
        dueDate: z.date().nullable().optional(),
        urgent: z.boolean().optional(),
        important: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [task] = await ctx.db
        .update(tasks)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();
      return task;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
      return { success: true };
    }),
});
