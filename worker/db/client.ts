import { neon } from "@neondatabase/serverless";
import * as schema from "../../shared/schema.ts";
import * as authSchema from "../../shared/auth-schema.ts";
import * as customSchema from "../../shared/custom/schema.ts";
import * as seoSchema from "../../drizzle/schema/seo.ts";
import { drizzle } from "drizzle-orm/neon-http";

const mergedSchema = {
  ...schema,
  ...authSchema,
  ...customSchema,
  ...seoSchema,
};

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, {
    schema: mergedSchema,
  });
}

export type Database = ReturnType<typeof createDb>;
