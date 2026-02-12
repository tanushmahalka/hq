import { createDb, type Database } from "../db/client";

export interface Env {
  DATABASE_URL: string;
}

export interface Context {
  db: Database;
  waitUntil: (promise: Promise<unknown>) => void;
}

export function createContext(
  env: Env,
  executionCtx: { waitUntil: (promise: Promise<unknown>) => void }
): Context {
  return {
    db: createDb(env.DATABASE_URL),
    waitUntil: executionCtx.waitUntil.bind(executionCtx),
  };
}
