/**
 * Input schemas for the FindAll (AI List Builder) tRPC router.
 * Dependency-light (zod only), mirroring agent-list-spec.ts.
 */
import { z } from "zod";

export const matchConditionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

export const enrichmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["string", "number", "boolean"]).optional(),
  format: z.literal("uri").optional(),
});

export const generatorSchema = z.enum(["preview", "base", "core", "pro"]);

export const findallIngestInput = z.object({
  objective: z.string().min(1),
});

export const findallSuggestEnrichmentsInput = z.object({
  objective: z.string().min(1),
  entityType: z.string().optional(),
  matchConditions: z.array(matchConditionSchema).default([]),
});

export const findallCreateInput = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
  entityType: z.string().optional(),
  matchConditions: z.array(matchConditionSchema).min(1),
  enrichments: z.array(enrichmentSchema).default([]),
  generator: generatorSchema.default("core"),
  matchLimit: z.number().int().min(5).max(1000).default(25),
  description: z.string().optional(),
  agentId: z.string().optional(),
  /** Only honored for agent (bearer) callers; session users are scoped to their org. */
  organizationId: z.string().optional(),
});

export const findallGetInput = z.object({
  id: z.number().int().positive(),
});

export const findallListInput = z
  .object({ agentId: z.string().optional() })
  .optional();

export const findallSyncInput = z.object({
  id: z.number().int().positive(),
});

export const findallEnrichInput = z.object({
  id: z.number().int().positive(),
  enrichments: z.array(enrichmentSchema).min(1),
});

export const findallExtendInput = z.object({
  id: z.number().int().positive(),
  additionalMatchLimit: z.number().int().min(1).max(1000),
});

export const findallCancelInput = z.object({
  id: z.number().int().positive(),
});
