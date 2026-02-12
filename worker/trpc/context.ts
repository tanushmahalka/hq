import { createDb, type Database } from "../db/client";

export interface Env {
  DATABASE_URL: string;
  OPENCLAW_HOOKS_URL: string;
  OPENCLAW_HOOKS_TOKEN: string;
}

export interface Context {
  db: Database;
  hooksUrl: string;
  hooksToken: string;
  waitUntil: (promise: Promise<unknown>) => void;
}

export function createContext(
  env: Env,
  executionCtx: { waitUntil: (promise: Promise<unknown>) => void }
): Context {
  return {
    db: createDb(env.DATABASE_URL),
    hooksUrl: env.OPENCLAW_HOOKS_URL,
    hooksToken: env.OPENCLAW_HOOKS_TOKEN,
    waitUntil: executionCtx.waitUntil.bind(executionCtx),
  };
}
