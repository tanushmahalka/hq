import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./drizzle/schema/core.ts",
    "./drizzle/schema/auth.ts",
    "./drizzle/schema/custom.ts",
    "./drizzle/schema/marketing.ts",
    "./drizzle/schema/seo.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
