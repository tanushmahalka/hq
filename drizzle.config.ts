import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./shared/schema.ts", "./shared/auth-schema.ts", "./drizzle/schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
