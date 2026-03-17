# HQ

HQ is the PSX control UI for managing agents, tasks, missions, and OpenClaw gateway activity.

## Runtime model

- Frontend: React SPA built by Vite into `dist/`
- Backend: Hono + tRPC Node server bundled into `dist-server/server/index.js`
- Production: one Node process serves both `/api/*` and the built SPA

## Local development

```bash
bun install
bun run dev
```

That starts:
- Vite on `http://127.0.0.1:5174`
- The backend API on `http://127.0.0.1:8787`

Vite proxies `/api/*` to the backend automatically.

## Production build

```bash
bun run build
bun run start
```

The production server expects the built frontend in `dist/` and serves it from the same process as the API.

## Required environment

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

Commonly used optional variables:
- `ALLOWED_ORIGINS`
- `OPENCLAW_HOOKS_URL`
- `OPENCLAW_HOOKS_TOKEN`
- `AGENT_API_TOKEN`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ENDPOINT_URL`
- `S3_PUBLIC_BASE_URL`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `VITE_GATEWAY_URL`
- `VITE_GATEWAY_TOKEN`

Database tuning variables:
- `HQ_DB_FORCE_IPV4` to force IPv4-only Postgres sockets. Defaults to `true` outside production and `false` in production.
- `HQ_DB_POOL_MAX` / `HQ_DB_POOL_MIN` to tune the Node Postgres pool size. Defaults to `1/1` outside production and `10/1` in production.
- `HQ_DB_CONNECT_TIMEOUT_MS` and `HQ_DB_IDLE_TIMEOUT_MS` to tune connect and idle timeouts.

See [EC2_RUNBOOK.md](/Users/tanushmahalka/Desktop/Programs/psx/hq/EC2_RUNBOOK.md) for the EC2 deployment flow.
