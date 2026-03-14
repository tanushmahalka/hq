import dns from "node:dns";
import net from "node:net";
import * as schema from "../../shared/schema.ts";
import * as authSchema from "../../shared/auth-schema.ts";
import * as customSchema from "../../shared/custom/schema.ts";
import * as seoSchema from "../../drizzle/schema/seo.ts";
import { drizzle } from "drizzle-orm/node-postgres";

const mergedSchema = {
  ...schema,
  ...authSchema,
  ...customSchema,
  ...seoSchema,
};

const databases = new Map<
  string,
  ReturnType<typeof drizzle<typeof mergedSchema>>
>();

function readBooleanEnv(name: string): boolean | undefined {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return undefined;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return undefined;
}

function readIntEnv(name: string): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function createIpv4OnlyStream() {
  const socket = new net.Socket();
  const baseConnect = socket.connect.bind(socket);

  socket.connect = function connect(
    port: number,
    host: string,
  ): net.Socket {
    if (typeof host === "string" && net.isIP(host) === 0) {
      dns.lookup(host, { family: 4, all: true }, (error, addresses) => {
        if (error) {
          socket.emit("error", error);
          return;
        }

        const address = addresses[0]?.address;
        if (!address) {
          socket.emit("error", new Error(`No IPv4 address found for ${host}`));
          return;
        }

        baseConnect(port, address);
      });
      return socket;
    }

    return baseConnect(port, host);
  } as typeof socket.connect;

  return socket;
}

function getDbConnectionConfig(databaseUrl: string) {
  const isProduction = process.env.NODE_ENV === "production";
  const forceIpv4 = readBooleanEnv("HQ_DB_FORCE_IPV4") ?? !isProduction;
  const max = readIntEnv("HQ_DB_POOL_MAX") ?? (isProduction ? 10 : 1);
  const min = readIntEnv("HQ_DB_POOL_MIN") ?? 1;
  const idleTimeoutMillis = readIntEnv("HQ_DB_IDLE_TIMEOUT_MS") ?? 30_000;
  const connectionTimeoutMillis = readIntEnv("HQ_DB_CONNECT_TIMEOUT_MS") ?? 10_000;

  return {
    connectionString: databaseUrl,
    ...(forceIpv4 ? { stream: createIpv4OnlyStream } : {}),
    keepAlive: true,
    max,
    min,
    idleTimeoutMillis,
    connectionTimeoutMillis,
  };
}

export function createDb(databaseUrl: string) {
  let db = databases.get(databaseUrl);
  if (!db) {
    db = drizzle({
      connection: getDbConnectionConfig(databaseUrl),
      schema: mergedSchema,
    });
    databases.set(databaseUrl, db);
  }
  return db;
}

export type Database = ReturnType<typeof createDb>;
