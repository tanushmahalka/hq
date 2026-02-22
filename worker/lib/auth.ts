import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { user as userTable } from "../../shared/auth-schema";
import type { Database } from "../db/client";

interface AuthConfig {
  secret: string;
  baseURL: string;
  adminEmails?: string;
  allowedOrigins?: string;
}

export function createAuth(db: Database, config: AuthConfig) {
  const adminEmailList = config.adminEmails
    ? config.adminEmails.split(",").map((e) => e.trim().toLowerCase())
    : [];

  const trustedOrigins = [
    config.baseURL,
    ...(config.allowedOrigins
      ? config.allowedOrigins.split(",").map((o) => o.trim())
      : []),
  ];

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins,
    emailAndPassword: { enabled: true },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh session cookie daily
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 min cache to reduce DB lookups
      },
    },
    plugins: [
      organization({ allowUserToCreateOrganization: true }),
      admin({ defaultRole: "user" }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (adminEmailList.includes(user.email.toLowerCase())) {
              await db
                .update(userTable)
                .set({ role: "admin" })
                .where(eq(userTable.id, user.id));
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
