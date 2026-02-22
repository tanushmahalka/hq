import { createDb, type Database } from "../db/client";
import { createAuth, type Auth } from "../lib/auth";

export interface Env {
  DATABASE_URL: string;
  OPENCLAW_HOOKS_URL?: string;
  OPENCLAW_HOOKS_TOKEN?: string;
  MAYA_DATABASE_URL?: string;
  ARIA_DATABASE_URL?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  ADMIN_EMAILS?: string;
  AGENT_API_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}

export interface Context {
  db: Database;
  hooksUrl?: string;
  hooksToken?: string;
  waitUntil: (promise: Promise<unknown>) => void;
  agentDatabases: Map<string, string>;
  user: { id: string; email: string; name: string; role?: string | null } | null;
  session: { id: string; activeOrganizationId?: string | null } | null;
  organizationId: string | null;
  isAgent: boolean;
}

export function createAuthInstance(env: Env, db: Database): Auth {
  return createAuth(db, {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    adminEmails: env.ADMIN_EMAILS,
  });
}

export async function createContext(
  env: Env,
  executionCtx: { waitUntil: (promise: Promise<unknown>) => void },
  req: Request
): Promise<Context> {
  const db = createDb(env.DATABASE_URL);

  const agentDatabases = new Map<string, string>();
  if (env.MAYA_DATABASE_URL) agentDatabases.set("maya", env.MAYA_DATABASE_URL);
  if (env.ARIA_DATABASE_URL) agentDatabases.set("aria", env.ARIA_DATABASE_URL);

  let user: Context["user"] = null;
  let session: Context["session"] = null;
  let organizationId: string | null = null;
  let isAgent = false;

  // Check bearer token first (agent access)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && env.AGENT_API_TOKEN) {
    const token = authHeader.slice(7);
    if (token === env.AGENT_API_TOKEN) {
      isAgent = true;
    }
  }

  // If not agent, try session auth
  if (!isAgent) {
    try {
      const auth = createAuthInstance(env, db);
      const result = await auth.api.getSession({
        headers: req.headers,
      });
      if (result) {
        user = {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        };
        session = {
          id: result.session.id,
          activeOrganizationId: result.session.activeOrganizationId,
        };
        organizationId = result.session.activeOrganizationId ?? null;
      }
    } catch {
      // No valid session — leave user/session as null
    }
  }

  return {
    db,
    hooksUrl: env.OPENCLAW_HOOKS_URL,
    hooksToken: env.OPENCLAW_HOOKS_TOKEN,
    waitUntil: executionCtx.waitUntil.bind(executionCtx),
    agentDatabases,
    user,
    session,
    organizationId,
    isAgent,
  };
}
