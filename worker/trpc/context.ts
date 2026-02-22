import { createDb, type Database } from "../db/client";
import { createAuth, type Auth } from "../lib/auth";
import { getPool } from "../db/local-pg";
import { agentDatabases as agentDatabasesTable } from "../../shared/schema";

export interface Env {
  DATABASE_URL: string;
  OPENCLAW_HOOKS_URL?: string;
  OPENCLAW_HOOKS_TOKEN?: string;
  LOCAL_PG_ADMIN_URL?: string;
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
  localPgAdminUrl?: string;
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
    allowedOrigins: env.ALLOWED_ORIGINS,
  });
}

async function loadAgentDatabases(db: Database): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const rows = await db.select().from(agentDatabasesTable);
    for (const row of rows) {
      map.set(row.agentId, row.dbUrl);
    }
  } catch {
    // Table may not exist yet (pre-migration) — return empty map
  }
  return map;
}

export async function createContext(
  env: Env,
  executionCtx: { waitUntil: (promise: Promise<unknown>) => void },
  req: Request
): Promise<Context> {
  const db = createDb(env.DATABASE_URL);

  const agentDatabases = await loadAgentDatabases(db);

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
    localPgAdminUrl: env.LOCAL_PG_ADMIN_URL,
    user,
    session,
    organizationId,
    isAgent,
  };
}
