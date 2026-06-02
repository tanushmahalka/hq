import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  agentLists,
  findallRuns,
} from "../../../../drizzle/schema/custom.ts";
import { router, orgProcedure } from "../../init.ts";
import type { Context } from "../../context.ts";
import {
  ParallelFindAllClient,
  ParallelFindAllError,
} from "../../../lib/parallel-findall.ts";
import {
  buildListJsonSchema,
  buildEnrichSchema,
} from "../../../lib/findall-mapping.ts";
import {
  startFindallRunWorker,
  reconcileRunResult,
} from "../../../lib/findall-stream.ts";
import { requestHermesJson } from "../../../lib/hermes-chat.ts";
import {
  enrichmentSchema,
  findallIngestInput,
  findallSuggestEnrichmentsInput,
  findallCreateInput,
  findallGetInput,
  findallListInput,
  findallSyncInput,
  findallEnrichInput,
  findallExtendInput,
  findallCancelInput,
} from "./findall-spec.ts";

/** Resolve a Parallel client or fail clearly when the key is unset. */
function getClient(ctx: Context): ParallelFindAllClient {
  if (!ctx.parallel) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Parallel FindAll is not configured. Set PARALLEL_API_KEY on the HQ server.",
    });
  }
  return new ParallelFindAllClient(ctx.parallel);
}

/** Translate Parallel errors into friendly tRPC errors. */
async function callParallel<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ParallelFindAllError) {
      if (error.status === 429) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Parallel FindAll rate limit reached (about 25 runs/hour). Try again shortly.",
        });
      }
      if (error.status === 401 || error.status === 403) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Parallel FindAll rejected the API key. Check PARALLEL_API_KEY.",
        });
      }
      throw new TRPCError({ code: "BAD_GATEWAY", message: error.message });
    }
    throw error;
  }
}

/** Load a run and assert the caller may access it (mirrors getAuthorizedList). */
async function getAuthorizedRun(ctx: Context, id: number) {
  const run = await ctx.db.query.findallRuns.findFirst({
    where: eq(findallRuns.id, id),
  });
  if (!run) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
  }
  if (
    !ctx.isAgent &&
    ctx.organizationId &&
    run.organizationId &&
    run.organizationId !== ctx.organizationId
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Run not in your organization" });
  }
  return run;
}

export const findallRouter = router({
  /** Turn a natural-language objective into a suggested entity type + match conditions. */
  ingest: orgProcedure
    .input(findallIngestInput)
    .mutation(async ({ ctx, input }) => {
      const client = getClient(ctx);
      const res = await callParallel(() =>
        client.ingest({ objective: input.objective }),
      );
      return {
        entityType: res.entity_type,
        matchConditions: res.match_conditions,
      };
    }),

  /** Suggest enrichment columns via Hermes. Degrades to manual when unavailable. */
  suggestEnrichments: orgProcedure
    .input(findallSuggestEnrichmentsInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.hermes) {
        return { enrichments: [], hermesAvailable: false };
      }

      const parsed = await requestHermesJson(ctx.hermes, {
        system:
          "You suggest spreadsheet columns to enrich a list of entities. " +
          'Return STRICT JSON: {"enrichments":[{"name":string,"description":string,' +
          '"type":"string"|"number"|"boolean","format":"uri"(optional)}]}. ' +
          "Each column is a single fact to look up per result. Suggest 3-6 concise, " +
          "business-friendly column names. Add format:\"uri\" for link/website columns. No prose.",
        user: [
          `Objective: ${input.objective}`,
          `Entity type: ${input.entityType ?? "(unknown)"}`,
          `Existing match conditions: ${
            input.matchConditions.map((c) => c.name).join(", ") || "(none)"
          }`,
          "Suggest enrichment columns.",
        ].join("\n"),
      });

      const shape = z.object({ enrichments: z.array(enrichmentSchema) });
      const result = shape.safeParse(parsed);
      return {
        enrichments: result.success ? result.data.enrichments : [],
        hermesAvailable: true,
      };
    }),

  /** Create the list + start a FindAll run, then kick the background worker. */
  create: orgProcedure
    .input(findallCreateInput)
    .mutation(async ({ ctx, input }) => {
      const client = getClient(ctx);
      const orgId = ctx.isAgent ? input.organizationId : ctx.organizationId;

      const jsonSchema = buildListJsonSchema({
        matchConditions: input.matchConditions,
        enrichments: input.enrichments,
      });

      const [list] = await ctx.db
        .insert(agentLists)
        .values({
          title: input.title,
          description: input.description ?? input.objective,
          jsonSchema,
          agentId: input.agentId,
          organizationId: orgId ?? null,
        })
        .returning();

      const created = await callParallel(() =>
        client.createRun({
          objective: input.objective,
          entity_type: input.entityType,
          match_conditions: input.matchConditions,
          generator: input.generator,
          match_limit: input.matchLimit,
          metadata: { hq_list_id: String(list.id) },
        }),
      );
      const findallId = created.findall_id;

      if (input.enrichments.length > 0) {
        try {
          await client.enrich(findallId, {
            processor: "auto",
            output_schema: buildEnrichSchema(input.enrichments),
          });
        } catch (error) {
          console.error("[findall] enrich on create failed:", error);
        }
      }

      const [run] = await ctx.db
        .insert(findallRuns)
        .values({
          findallId,
          listId: list.id,
          objective: input.objective,
          entityType: input.entityType,
          matchConditions: input.matchConditions,
          enrichments: input.enrichments,
          generator: input.generator,
          matchLimit: input.matchLimit,
          status: "running",
          agentId: input.agentId,
          organizationId: orgId ?? null,
        })
        .returning();

      if (ctx.parallel) {
        const parallel = ctx.parallel;
        ctx.waitUntil(
          startFindallRunWorker({ db: ctx.db, parallel, findallId }),
        );
      }

      return { run, listId: list.id };
    }),

  /** Get a single run. */
  get: orgProcedure.input(findallGetInput).query(async ({ ctx, input }) => {
    return getAuthorizedRun(ctx, input.id);
  }),

  /** List runs for the org (newest first) — powers the in-progress section. */
  list: orgProcedure.input(findallListInput).query(async ({ ctx, input }) => {
    const conditions = [];
    if (input?.agentId) conditions.push(eq(findallRuns.agentId, input.agentId));
    if (!ctx.isAgent && ctx.organizationId) {
      conditions.push(eq(findallRuns.organizationId, ctx.organizationId));
    }
    const where =
      conditions.length > 1 ? and(...conditions) : conditions[0] ?? undefined;

    return ctx.db.query.findallRuns.findMany({
      where,
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  }),

  /** Pull /result and replace the list's rows — completeness backstop. */
  sync: orgProcedure.input(findallSyncInput).mutation(async ({ ctx, input }) => {
    const run = await getAuthorizedRun(ctx, input.id);
    const client = getClient(ctx);
    await callParallel(() => reconcileRunResult(ctx.db, client, run));
    return getAuthorizedRun(ctx, input.id);
  }),

  /** Add enrichment columns to an existing run. */
  enrich: orgProcedure
    .input(findallEnrichInput)
    .mutation(async ({ ctx, input }) => {
      const run = await getAuthorizedRun(ctx, input.id);
      const client = getClient(ctx);

      await callParallel(() =>
        client.enrich(run.findallId, {
          processor: "auto",
          output_schema: buildEnrichSchema(input.enrichments),
        }),
      );

      const enrichments = [...(run.enrichments ?? []), ...input.enrichments];
      const jsonSchema = buildListJsonSchema({
        matchConditions: run.matchConditions ?? [],
        enrichments,
      });
      await ctx.db
        .update(agentLists)
        .set({ jsonSchema, updatedAt: new Date() })
        .where(eq(agentLists.id, run.listId));
      const [updated] = await ctx.db
        .update(findallRuns)
        .set({ enrichments, status: "running", updatedAt: new Date() })
        .where(eq(findallRuns.id, run.id))
        .returning();

      if (ctx.parallel) {
        const parallel = ctx.parallel;
        ctx.waitUntil(
          startFindallRunWorker({
            db: ctx.db,
            parallel,
            findallId: run.findallId,
          }),
        );
      }
      return updated;
    }),

  /** Raise the match limit and resume streaming. */
  extend: orgProcedure
    .input(findallExtendInput)
    .mutation(async ({ ctx, input }) => {
      const run = await getAuthorizedRun(ctx, input.id);
      if (run.generator === "preview") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Test runs can't be extended — rerun at a deeper level.",
        });
      }
      const client = getClient(ctx);
      await callParallel(() =>
        client.extend(run.findallId, {
          additional_match_limit: input.additionalMatchLimit,
        }),
      );
      const [updated] = await ctx.db
        .update(findallRuns)
        .set({
          matchLimit: run.matchLimit + input.additionalMatchLimit,
          status: "running",
          updatedAt: new Date(),
        })
        .where(eq(findallRuns.id, run.id))
        .returning();

      if (ctx.parallel) {
        const parallel = ctx.parallel;
        ctx.waitUntil(
          startFindallRunWorker({
            db: ctx.db,
            parallel,
            findallId: run.findallId,
          }),
        );
      }
      return updated;
    }),

  /** Cancel a running search. */
  cancel: orgProcedure
    .input(findallCancelInput)
    .mutation(async ({ ctx, input }) => {
      const run = await getAuthorizedRun(ctx, input.id);
      const client = getClient(ctx);
      await callParallel(() => client.cancel(run.findallId));
      const [updated] = await ctx.db
        .update(findallRuns)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(findallRuns.id, run.id))
        .returning();
      return updated;
    }),
});
