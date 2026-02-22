import pg from "pg";

const pools = new Map<string, pg.Pool>();

export function getPool(url: string): pg.Pool {
  let pool = pools.get(url);
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: 5 });
    pools.set(url, pool);
  }
  return pool;
}
