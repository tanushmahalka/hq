import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./shared/schema.ts",
    "./shared/auth-schema.ts",
    "./shared/custom/schema.ts",
    "./drizzle/schema/core.ts",
    "./drizzle/schema/seo.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
