import { createDb, type Database } from "../db/client";

export interface Env {
  DATABASE_URL: string;
}

export interface Context {
  db: Database;
}

export function createContext(env: Env): Context {
  return {
    db: createDb(env.DATABASE_URL),
  };
}
