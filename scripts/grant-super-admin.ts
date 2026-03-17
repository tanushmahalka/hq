import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization as organizationPlugin, admin } from "better-auth/plugins";
import * as authSchema from "../drizzle/schema/auth.ts";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const databaseUrl = getRequiredEnv("DATABASE_URL");
  const secret = getRequiredEnv("BETTER_AUTH_SECRET");
  const baseURL = getRequiredEnv("BETTER_AUTH_URL");
  const email = getRequiredEnv("SUPER_ADMIN_EMAIL").toLowerCase();
  const name = process.env.SUPER_ADMIN_NAME;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  const sql = neon(databaseUrl);
  const db = drizzle({
    client: sql,
    schema: authSchema,
  });
  const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret,
    baseURL,
    trustedOrigins: [
      baseURL,
      ...(process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
        : []),
    ],
    emailAndPassword: { enabled: true },
    plugins: [
      organizationPlugin({
        allowUserToCreateOrganization: false,
        creatorRole: "admin",
      }),
      admin({ defaultRole: "user" }),
    ],
  });

  let user = await db.query.user.findFirst({
    where: eq(authSchema.user.email, email),
  });

  if (!user) {
    if (!name || !password) {
      throw new Error(
        "SUPER_ADMIN_NAME and SUPER_ADMIN_PASSWORD are required when creating a new super-admin user."
      );
    }

    const result = await auth.api.createUser({
      body: {
        email,
        name,
        password,
        role: "admin",
      },
    });

    user = result.user;
    console.log(`Created super-admin user ${email}`);
    return;
  }

  if (user.role !== "admin") {
    await db
      .update(authSchema.user)
      .set({ role: "admin" })
      .where(eq(authSchema.user.id, user.id));
    console.log(`Promoted ${email} to super-admin`);
    return;
  }

  console.log(`${email} is already a super-admin`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
