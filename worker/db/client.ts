import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../shared/schema.ts";
import * as authSchema from "../../shared/auth-schema.ts";
import * as customSchema from "../../shared/custom/schema.ts";
import * as seoSchema from "../../drizzle/schema/seo.ts";

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle({
    client: sql,
    schema: { ...schema, ...authSchema, ...customSchema, ...seoSchema },
  });
}

export type Database = ReturnType<typeof createDb>;
