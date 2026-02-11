# HQ — AI Agent Headquarters

HQ is the mission control dashboard for PSX. It is a web-based control panel where businesses manage a team of AI agents that handle day-to-day operations — planning, execution, communication, and automation. Think of it as a headquarters where operators supervise, chat with, and coordinate their AI workforce.

## Vision

The ultimate goal is to be a centralized headquarters for businesses where they can create, configure, and deploy a team of AI agents to execute daily business tasks, plan initiatives, and automate workflows. Each agent specializes in a domain and operators interact with them through a unified chat and dashboard interface.

## Architecture

HQ is a React SPA that connects to an [OpenClaw](../openclaw/) gateway server over WebSocket. It acts as a `control-ui` client — authenticating as an operator with admin and approval scopes.

```
Browser (HQ)  ──wss──▶  Tailscale proxy (port 443)  ──▶  OpenClaw Gateway (port 18789)
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
      - "http://localhost:5173"   # Vite dev server origin
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

## Project Structure

```
hq/
├── src/
│   ├── main.tsx                    # App entry — providers, router, gateway config
│   ├── layout.tsx                  # Shell layout with sidebar + outlet
│   ├── index.css                   # Tailwind base styles
│   ├── pages/
│   │   ├── dashboard.tsx           # Overview page (placeholder)
│   │   └── agent-chat.tsx          # Per-agent chat interface
│   ├── hooks/
│   │   ├── use-gateway.tsx         # GatewayProvider context + subscribe API
│   │   ├── use-chat.ts             # Chat state: history, streaming, send
│   │   └── use-mobile.ts           # Responsive breakpoint hook
│   ├── lib/
│   │   ├── gateway-client.ts       # WebSocket client (connect, RPC, reconnect)
│   │   └── utils.ts                # cn() helper (clsx + tailwind-merge)
│   └── components/
│       ├── app-sidebar.tsx         # Navigation sidebar (dashboard + agents list)
│       ├── theme-provider.tsx      # Dark/light/system theme context
│       ├── theme-toggle.tsx        # Theme switcher button
│       └── ui/                     # shadcn/ui primitives (button, input, sidebar, etc.)
├── .env                            # VITE_GATEWAY_URL, VITE_GATEWAY_TOKEN
├── vite.config.ts
├── package.json
└── tsconfig.json                   # Path alias: @/* → ./src/*
```

## Key Files

### `src/lib/gateway-client.ts`
The core WebSocket client. Adapted from OpenClaw's own `ui/src/ui/gateway.ts`. Handles:
- Connection lifecycle with auto-reconnect and exponential backoff
- Challenge-based handshake (server sends nonce, client responds with connect)
- RPC request/response correlation via `crypto.randomUUID()` IDs
- Sequence number tracking for gap detection on event streams

### `src/hooks/use-gateway.tsx`
React context that wraps `GatewayClient`. Exposes:
- `client` — the GatewayClient instance for RPC calls
- `connected` — boolean connection state
- `snapshot` — initial state snapshot from hello-ok
- `subscribe(handler)` — register for real-time gateway events

### `src/hooks/use-chat.ts`
Per-agent chat hook. Uses the gateway to:
- Load message history via `chat.history` RPC (limit 200)
- Send messages via `chat.send` RPC
- Subscribe to `chat` events for streaming responses

**Note**: The `handleChatEvent` function has a `TODO(human)` — the streaming event handler (delta/final/aborted/error states) is not yet implemented. This means agent responses won't appear in real-time until that is wired up.

### `src/components/app-sidebar.tsx`
Navigation sidebar. Currently has a hardcoded agent list (`[{ id: "kaira", name: "Kaira" }]`). This should eventually be dynamic, populated from the gateway's `agents.list` RPC.

## Routes

| Path | Component | Description |
|---|---|---|
| `/` | `Dashboard` | Overview page (placeholder) |
| `/agent/:agentId` | `AgentChat` | Chat interface for a specific agent |

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_GATEWAY_URL` | WebSocket URL for the OpenClaw gateway | `ws://localhost:18789` |
| `VITE_GATEWAY_TOKEN` | Auth token for gateway connection | `""` |

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
- `chat` — chat message deltas and finals
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
bun dev        # starts Vite dev server on http://localhost:5173
```

Make sure the OpenClaw gateway is running and accessible. Set `VITE_GATEWAY_URL` and `VITE_GATEWAY_TOKEN` in `.env`.

## Known TODOs

- `use-chat.ts`: `handleChatEvent` is stubbed — streaming responses (delta/final/aborted/error) need to be implemented
- `app-sidebar.tsx`: Agent list is hardcoded — should use `agents.list` RPC
- `dashboard.tsx`: Placeholder — needs agent overview, health status, presence, etc.
- No device-level auth — currently relies on `allowInsecureAuth` flag
