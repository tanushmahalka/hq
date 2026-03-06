import { eq } from "drizzle-orm";
import { createDb } from "../worker/db/client";
import { createAuth } from "../worker/lib/auth";
import { user as userTable } from "../shared/auth-schema";

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

  const db = createDb(databaseUrl);
  const auth = createAuth(db, {
    secret,
    baseURL,
    superAdminEmails: process.env.SUPER_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS,
    allowedOrigins: process.env.ALLOWED_ORIGINS,
  });

  let user = await db.query.user.findFirst({
    where: eq(userTable.email, email),
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
      .update(userTable)
      .set({ role: "admin" })
      .where(eq(userTable.id, user.id));
    console.log(`Promoted ${email} to super-admin`);
    return;
  }

  console.log(`${email} is already a super-admin`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
