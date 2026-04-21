import * as schema from "../../drizzle/schema/core.ts";
import * as authSchema from "../../drizzle/schema/auth.ts";
import * as customSchema from "../../drizzle/schema/custom.ts";
import * as marketingSchema from "../../drizzle/schema/marketing.ts";
import * as seoSchema from "../../drizzle/schema/seo.ts";
import { drizzle } from "drizzle-orm/node-postgres";

const mergedSchema = {
  ...schema,
  ...authSchema,
  ...customSchema,
  ...marketingSchema,
  ...seoSchema,
};

const databases = new Map<
  string,
  ReturnType<typeof drizzle<typeof mergedSchema>>
>();

export function createDb(databaseUrl: string) {
  let db = databases.get(databaseUrl);
  if (!db) {
    db = drizzle(databaseUrl, { schema: mergedSchema });
    databases.set(databaseUrl, db);
  }
  return db;
}

export type Database = ReturnType<typeof createDb>;
