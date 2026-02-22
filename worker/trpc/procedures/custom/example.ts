import { z } from "zod";
import { router, orgProcedure } from "../../init";

export const exampleRouter = router({
  hello: orgProcedure
    .input(z.object({ name: z.string().optional() }).optional())
    .query(({ input }) => {
      return { greeting: `Hello, ${input?.name ?? "world"}!` };
    }),
});
