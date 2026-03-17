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
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh session cookie daily
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 min cache to reduce DB lookups
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
