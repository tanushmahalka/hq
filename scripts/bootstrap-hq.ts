import { and, eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin } from "better-auth/plugins";
import {
  member as memberTable,
  organization as organizationTable,
  user as userTable,
} from "../shared/auth-schema.ts";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const databaseUrl = getEnv("DATABASE_URL");
  const secret = getEnv("BETTER_AUTH_SECRET");
  const baseURL = getEnv("BETTER_AUTH_URL");
  const orgName = getEnv("BOOTSTRAP_ORG_NAME");
  const orgSlug = getEnv("BOOTSTRAP_ORG_SLUG");
  const adminName = getEnv("BOOTSTRAP_ADMIN_NAME");
  const adminEmail = getEnv("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const adminPassword = getEnv("BOOTSTRAP_ADMIN_PASSWORD");

  const sql = neon(databaseUrl);
  const db = drizzle({
    client: sql,
    schema: {
      user: userTable,
      member: memberTable,
      organization: organizationTable,
    },
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
      organization({
        allowUserToCreateOrganization: false,
        creatorRole: "admin",
      }),
      admin({ defaultRole: "user" }),
    ],
  });

  let adminUser = await db.query.user.findFirst({
    where: eq(userTable.email, adminEmail),
  });

  if (!adminUser) {
    const result = await auth.api.createUser({
      body: {
        email: adminEmail,
        name: adminName,
        password: adminPassword,
        role: "user",
      },
    });
    adminUser = result.user;
    console.log(`Created customer bootstrap user ${adminEmail}`);
  } else {
    console.log(`Reusing existing customer bootstrap user ${adminEmail}`);
  }

  let organization = await db.query.organization.findFirst({
    where: eq(organizationTable.slug, orgSlug),
  });

  if (!organization) {
    const existingOrganization = await db.query.organization.findFirst();
    if (existingOrganization) {
      organization = existingOrganization;
      console.log(
        `Reusing existing organization ${organization.name} (${organization.id})`
      );
    } else {
      organization = await auth.api.createOrganization({
        body: {
          name: orgName,
          slug: orgSlug,
          userId: adminUser.id,
        },
      });
      console.log(`Created organization ${orgName}`);
    }
  } else {
    console.log(`Reusing organization ${organization.name}`);
  }

  const existingMembership = await db.query.member.findFirst({
    where: and(
      eq(memberTable.userId, adminUser.id),
      eq(memberTable.organizationId, organization.id)
    ),
  });

  if (!existingMembership) {
    await auth.api.addMember({
      body: {
        userId: adminUser.id,
        role: "admin",
        organizationId: organization.id,
      },
    });
    console.log(`Added ${adminEmail} to ${organization.name} as org admin`);
  } else {
    console.log(`Admin membership already exists for ${adminEmail}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
