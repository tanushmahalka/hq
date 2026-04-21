import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin } from "better-auth/plugins";
import { and, eq, gt } from "drizzle-orm";
import {
  invitation as invitationTable,
  user as userTable,
} from "../../drizzle/schema/auth.ts";
import type { Database } from "../db/client.ts";

interface AuthConfig {
  secret: string;
  baseURL: string;
  superAdminEmails?: string;
  allowedOrigins?: string;
}

const PERSISTENT_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 400; // Browser-safe max cookie lifetime
const SESSION_REFRESH_INTERVAL_SECONDS = 60 * 60 * 24; // 1 day
const SESSION_COOKIE_CACHE_MAX_AGE_SECONDS = 60 * 5; // 5 minutes

export function createAuth(db: Database, config: AuthConfig) {
  const superAdminEmailList = config.superAdminEmails
    ? config.superAdminEmails.split(",").map((e) => e.trim().toLowerCase())
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
      // Keep sessions effectively persistent until explicit logout.
      expiresIn: PERSISTENT_SESSION_DURATION_SECONDS,
      updateAge: SESSION_REFRESH_INTERVAL_SECONDS,
      cookieCache: {
        enabled: true,
        maxAge: SESSION_COOKIE_CACHE_MAX_AGE_SECONDS,
      },
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: false,
        creatorRole: "admin",
      }),
      admin({ defaultRole: "user" }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            if (!context?.request) {
              return;
            }

            const path = new URL(context.request.url).pathname;
            const isAdminCreate = path.endsWith("/admin/create-user");
            const isEmailSignup = path.endsWith("/sign-up/email");

            if (!isEmailSignup || isAdminCreate) {
              return;
            }

            const pendingInvite = await db.query.invitation.findFirst({
              where: and(
                eq(invitationTable.email, user.email.toLowerCase()),
                eq(invitationTable.status, "pending"),
                gt(invitationTable.expiresAt, new Date())
              ),
            });

            if (!pendingInvite) {
              throw new Error("Account creation requires a valid invitation.");
            }
          },
          after: async (user) => {
            if (superAdminEmailList.includes(user.email.toLowerCase())) {
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
export {
  PERSISTENT_SESSION_DURATION_SECONDS,
  SESSION_COOKIE_CACHE_MAX_AGE_SECONDS,
  SESSION_REFRESH_INTERVAL_SECONDS,
};
