# HQ — AI Agent Headquarters

HQ is the mission control dashboard for PSX. It is a web-based control panel where businesses manage a team of AI agents that handle day-to-day operations — planning, execution, communication, and automation. Think of it as a headquarters where operators supervise, chat with, and coordinate their AI workforce.

## Vision

The ultimate goal is to be a centralized headquarters for businesses where they can create, configure, and deploy a team of AI agents to execute daily business tasks, plan initiatives, and automate workflows. Each agent specializes in a domain and operators interact with them through a unified chat and dashboard interface.

## Architecture

HQ has two halves that run independently:

1. **Frontend** — React SPA built by Vite and served from `dist/`.
2. **Backend** — Hono + tRPC Node server that owns the database (Drizzle ORM) and exposes task/comment CRUD over HTTP (`/api/trpc/*`).

```
Browser (HQ)  ──wss──▶  Tailscale proxy (443)  ──▶  OpenClaw Gateway (18789)
              ──http──▶  HQ Node server (/api/trpc/*)  ──▶  Database
```

### Gateway Connection

- **Protocol**: WebSocket (protocol version 3)
- **Client ID**: `openclaw-control-ui` (must match the server's `GATEWAY_CLIENT_IDS.CONTROL_UI` enum exactly)
- **Client mode**: `ui` (from `GATEWAY_CLIENT_MODES`)
- **Auth**: Token-based (`gateway.auth.token` in OpenClaw config)
- **Role**: `operator` with scopes `operator.admin`, `operator.approvals`

The handshake flow:
1. WS opens → client waits up to 750ms for a `connect.challenge` event
2. On challenge (or timeout), client sends a `connect` request with credentials
3. Server responds with `hello-ok` containing features, snapshot, and policy
4. Reconnection uses exponential backoff (800ms → 15s cap, factor 1.7)

### Gateway Config Requirements

The OpenClaw gateway must have these configured for HQ to connect:

```yaml
gateway:
  controlUi:
    allowedOrigins:
      - "http://localhost:5174"   # HQ local dev origin
    allowInsecureAuth: true       # Required when HQ runs on http:// (not https://)
```

Without `allowInsecureAuth`, the gateway rejects control-ui connections from non-HTTPS origins with "control ui requires HTTPS or localhost (secure context)".

## Tech Stack

- **Framework**: React 19 + TypeScript 5.9
- **Build**: Vite 7 with `@vitejs/plugin-react`
- **Routing**: React Router 7 (BrowserRouter)
- **Styling**: Tailwind CSS 4 + `tw-animate-css`
- **Components**: shadcn/ui (Radix UI primitives + CVA + tailwind-merge)
- **Icons**: Lucide React
- **Font**: Geist
- **Package manager**: Bun
- **Backend**: Hono + tRPC on Node
- **ORM**: Drizzle
- **Toasts**: Sonner

## Project Structure

```
hq/
├── src/
│   ├── main.tsx                    # App entry — providers, router, gateway config
│   ├── layout.tsx                  # Shell layout: TopNav + main content + messenger panel
│   ├── index.css                   # Tailwind base styles + custom keyframes
│   ├── pages/
│   │   ├── dashboard.tsx           # Overview page (placeholder)
│   │   └── tasks.tsx               # Kanban board page
│   ├── hooks/
│   │   ├── use-gateway.tsx         # GatewayProvider context + subscribe API + agents list
│   │   ├── use-chat.ts             # Chat state: history, streaming, send (per session)
│   │   ├── use-messenger-panel.tsx # Messenger slide-panel state (open/close, agent selection)
│   │   ├── use-task-active.ts      # Track live agent activity per task via gateway events
│   │   ├── use-trpc.tsx            # tRPC + React Query provider
│   │   └── use-mobile.ts           # Responsive breakpoint hook
│   ├── lib/
│   │   ├── gateway-client.ts       # WebSocket client (connect, RPC, reconnect)
│   │   ├── trpc.ts                 # tRPC client setup
│   │   └── utils.ts                # cn() helper (clsx + tailwind-merge)
│   └── components/
│       ├── top-nav.tsx             # Top navigation bar (logo, nav links, messenger toggle, theme)
│       ├── messenger/
│       │   ├── messenger-panel.tsx # Slide-out chat panel (agent list → chat view)
│       │   └── message-content.tsx # Rendered message content (markdown, etc.)
│       ├── tasks/
│       │   ├── kanban-board.tsx    # Full kanban board (columns + create/detail dialogs)
│       │   ├── kanban-column.tsx   # Single status column with task cards
│       │   ├── task-card.tsx       # Individual task card (with live shimmer when agent active)
│       │   ├── task-create-dialog.tsx  # Create task modal
│       │   ├── task-detail-sheet.tsx   # Task detail side sheet (properties + comments)
│       │   └── task-status-dropdown.tsx # Status selector dropdown
│       ├── theme-provider.tsx      # Dark/light/system theme context
│       ├── theme-toggle.tsx        # Theme switcher button
│       └── ui/                     # shadcn/ui primitives (button, input, sheet, etc.)
├── worker/
│   ├── app.ts                      # Shared Hono app factory
│   ├── index.ts                    # Compatibility re-export for backend app
│   ├── lib/
│   │   └── notify-hook.ts         # POST to OpenClaw /hooks/tasks endpoint
│   ├── db/
│   │   └── client.ts              # Drizzle database client factory
│   └── trpc/
│       ├── context.ts             # Request context (db, hooksUrl, hooksToken, waitUntil)
│       ├── init.ts                # tRPC router + procedure setup
│       ├── router.ts              # Root router (merges task + comment)
│       └── procedures/
│           ├── task.ts            # Task CRUD (list, get, create, update, delete)
│           └── comment.ts         # Comment add/delete on tasks
├── server/
│   └── index.ts                    # Node server entry — serves API + built SPA
├── shared/
│   ├── schema.ts                  # Drizzle schema (tasks, comments tables)
│   ├── types.ts                   # TASK_STATUSES, STATUS_LABELS, TaskStatus
│   └── slug.ts                    # Task ID generation from title
├── .env                           # VITE_GATEWAY_URL, VITE_GATEWAY_TOKEN
├── vite.config.ts
├── package.json
└── tsconfig.json                  # Path aliases: @/* → ./src/*, @shared/* → ./shared/*
```

## Layout

The app uses a top-nav layout (no sidebar):

```
┌────────────────────────────────────────────────────┐
│  TopNav  [HQ logo] [Tasks]           [⌘K] [theme]  │
├───────────────────────────────────┬────────────────┤
│                                   │  Messenger     │
│           Main Content            │  Panel (420px) │
│           (flex-1)                │  (toggle ⌘K)   │
│                                   │                │
└───────────────────────────────────┴────────────────┘
```

- `layout.tsx` renders `TopNav` + flex row of `<main>` (Outlet) + messenger panel
- Messenger panel slides in/out via `w-0`/`w-[420px]` transition
- Panel state managed by `useMessengerPanel` context (toggle, open, close, agent selection)
- Last selected agent persisted in localStorage (`hq:messenger:agentId`)

## Routes

| Path | Component | Description |
|---|---|---|
| `/` | `Dashboard` | Overview page (placeholder) |
| `/tasks` | `Tasks` → `KanbanBoard` | Kanban task management board |

## Key Hooks

### `use-gateway.tsx`
React context wrapping `GatewayClient`. On `hello-ok`, fetches the agent list via `agents.list` RPC. Exposes:
- `client` — GatewayClient instance for RPC
- `connected` — boolean
- `agents` — list of agents (filtered, excludes "main")
- `subscribe(handler)` — register for real-time gateway events

### `use-chat.ts`
Per-session chat hook. Session key defaults to `agent:{agentId}:main`. Handles:
- Load history via `chat.history` RPC
- Send via `chat.send` RPC
- Subscribe to `chat` events for streaming (delta/final/aborted/error)
- Monotonic fetch ID to prevent stale history overwrites

### `use-task-active.ts`
Subscribes to gateway `chat` events and returns `true` while a task's session has active streaming (`delta` state). Used by `TaskCard` to show a shimmer animation on the top edge.

### `use-messenger-panel.tsx`
Manages the slide-out messenger panel state. Toggle hotkey: `⌘K`. Persists selected agent in localStorage.

## Task Notification Flow

Task and comment mutations notify agents via HTTP POST from the HQ backend to OpenClaw's hook mapping system:

1. **Backend** — `worker/lib/notify-hook.ts` POSTs to `{OPENCLAW_HOOKS_URL}/hooks/tasks` with task fields as body
2. **Hook mapping** — OpenClaw config maps the POST body fields to session key and message templates (e.g. `sessionKey: "task:{{taskId}}"`, `messageTemplate: "Task #{{taskId}} created: {{title}}"`)
3. **Actions**: `created`, `updated`, `deleted` (from `task.ts`), `commented`, `comment_deleted` (from `comment.ts`)
4. All calls are fire-and-forget via `ctx.waitUntil()` — mutations return immediately
5. For delete operations, the existing record is fetched before deletion so the hook has full context

## Task Card Active Shimmer

When the gateway streams `chat` events for a task's session, the task card shows a 1px animated gradient sweep across its top edge (`shimmer-edge` keyframe in `index.css`). This indicates the agent is actively working on the task. Managed by `useTaskActive(taskId)`.

## Backend Server

The backend app lives in `worker/app.ts`, and the Node runtime entry lives in `server/index.ts`:
- CORS enabled on `/api/*`
- Health check at `/api/health`
- tRPC router mounted at `/api/trpc/*`
- Context provides `db` (Drizzle), `hooksUrl`, `hooksToken`, and `waitUntil`
- Env requires `DATABASE_URL`, `OPENCLAW_HOOKS_URL`, `OPENCLAW_HOOKS_TOKEN`
- Production serves the built SPA from `dist/` in the same process

### tRPC Procedures

- `task.list` — query all tasks (optional status filter), includes comments
- `task.get` — query single task by ID with ordered comments
- `task.create` — create task with slug-based ID from title
- `task.update` — partial update by ID
- `task.delete` — delete by ID
- `task.comment.add` — add comment to task
- `task.comment.delete` — delete comment by ID

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_GATEWAY_URL` | WebSocket URL for the OpenClaw gateway | `ws://localhost:18789` |
| `VITE_GATEWAY_TOKEN` | Auth token for gateway connection | `""` |
| `DATABASE_URL` | Database connection string (backend) | — |
| `OPENCLAW_HOOKS_URL` | OpenClaw gateway base URL for hooks (backend) | — |
| `OPENCLAW_HOOKS_TOKEN` | Bearer token for hook endpoint auth (backend) | — |

**Important**: When connecting through Tailscale, use port 443 (omit port from URL) since Tailscale proxies HTTPS on 443 to the gateway's actual port 18789.

## Available Gateway RPC Methods

The gateway exposes these methods (from the hello-ok handshake):

- **Chat**: `chat.send`, `chat.history`, `chat.abort`
- **Agents**: `agents.list`, `agents.files.list`, `agents.files.get`, `agents.files.set`, `agent`, `agent.identity.get`, `agent.wait`
- **Sessions**: `sessions.list`, `sessions.preview`, `sessions.patch`, `sessions.reset`, `sessions.delete`, `sessions.compact`
- **Config**: `config.get`, `config.set`, `config.apply`, `config.patch`, `config.schema`
- **Health/Status**: `health`, `status`, `usage.status`, `usage.cost`
- **Approvals**: `exec.approvals.get`, `exec.approvals.set`, `exec.approval.request`, `exec.approval.resolve`
- **Channels**: `channels.status`, `channels.logout`
- **Nodes**: `node.list`, `node.describe`, `node.invoke`, `node.pair.*`, `device.pair.*`
- **Cron**: `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`
- **Skills**: `skills.status`, `skills.bins`, `skills.install`, `skills.update`
- **Misc**: `logs.tail`, `models.list`, `wizard.*`, `tts.*`, `send`, `wake`

## Gateway Events

Real-time events streamed from the gateway:
- `chat` — chat message deltas and finals (payload: `{ runId, sessionKey, state, message }`)
- `presence` — node connect/disconnect
- `tick` — periodic heartbeat
- `health` — system health updates
- `exec.approval.requested` / `exec.approval.resolved` — approval workflows
- `node.pair.requested` / `node.pair.resolved` — node pairing
- `cron` — cron job events

## Development

```bash
cd hq
bun install
bun run dev
```

This starts Vite on `http://localhost:5174` and the backend API on `http://127.0.0.1:8787`.

For production:

```bash
bun run build
bun run start
```

Make sure the OpenClaw gateway is running and accessible. Set `VITE_GATEWAY_URL` and `VITE_GATEWAY_TOKEN` in `.env`.

## Known TODOs

- `dashboard.tsx`: Placeholder — needs agent overview, health status, presence, etc.
- No device-level auth — currently relies on `allowInsecureAuth` flag
