# Skill: HQ Custom Page Developer

You are an AI agent building custom pages and backend procedures for HQ — a mission control dashboard for AI agent swarms. You operate in a sandboxed `custom/` directory on both frontend and backend. **You must never modify core files.**

---

## Sandbox Boundary — What You Can and Cannot Touch

### YOU CAN EDIT (custom sandbox)

| Area | Files | Purpose |
|------|-------|---------|
| Custom pages | `src/pages/custom/*.tsx` | Your page components |
| Page registry | `src/pages/custom/registry.ts` | Register pages (append entries) |
| Custom procedures | `worker/trpc/procedures/custom/*.ts` | Your tRPC routers |
| Procedure registry | `worker/trpc/procedures/custom/registry.ts` | Register routers (append entries) |
| Custom schema | `shared/custom/schema.ts` | Your Drizzle table definitions |

### YOU MUST NEVER EDIT (core files)

| Area | Files | Why |
|------|-------|-----|
| Core pages | `src/pages/dashboard.tsx`, `tasks.tsx`, etc. | Core app pages |
| Core components | `src/components/**/*` (anything outside custom) | Shared UI |
| Core hooks | `src/hooks/*` | App-wide state |
| Core lib | `src/lib/*` | Utilities |
| Core schema | `shared/schema.ts`, `shared/types.ts` | Core DB tables |
| Core procedures | `worker/trpc/procedures/task.ts`, `comment.ts`, `db.ts` | Core CRUD |
| Routing | `src/main.tsx` | App entry (auto-loads your pages) |
| Navigation | `src/components/top-nav.tsx` | Nav bar (auto-shows your tabs) |
| Router | `worker/trpc/router.ts` | tRPC root (auto-merges your routers) |
| DB client | `worker/db/client.ts` | DB setup (auto-includes your schema) |
| Worker entry | `worker/index.ts` | Hono app |
| Config | `vite.config.ts`, `tsconfig.json`, `package.json` | Build config |

**Everything you register in `custom/` directories is automatically wired into routing, navigation, tRPC, and the database — no core file changes needed.**

---

## Quick Start — Adding a Custom Page

1. Create your page component in `src/pages/custom/<your-page>.tsx`
2. Append an entry to `src/pages/custom/registry.ts`
3. Done — the page auto-appears in nav and routing at `/custom/<id>`

### Example

```tsx
// src/pages/custom/seo-dashboard.tsx
import { useGateway } from "@/hooks/use-gateway";

export default function SeoDashboard() {
  const { connected, agents } = useGateway();

  return (
    <div className="flex flex-col h-full p-5">
      <h1 className="text-2xl font-normal mb-4">SEO Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Gateway {connected ? "connected" : "disconnected"}
      </p>
    </div>
  );
}
```

```tsx
// src/pages/custom/registry.ts — APPEND your entry to the array
import type { CustomPageEntry } from "./types";
import { exampleRouter } from "./example";

const customPages: CustomPageEntry[] = [
  { id: "example", label: "Example", icon: "sparkles", component: () => import("./example") },
  // ↓ ADD YOUR ENTRY HERE ↓
  { id: "seo-dashboard", label: "SEO", icon: "search", component: () => import("./seo-dashboard") },
];

export default customPages;
```

### Registry Entry Shape

```ts
interface CustomPageEntry {
  id: string;          // URL slug → /custom/:id
  label: string;       // nav tab label
  icon: string;        // lucide icon name (kebab-case): "search", "bar-chart-3", "sparkles"
  component: () => Promise<{ default: React.ComponentType }>;
}
```

---

## Quick Start — Adding a Custom Backend Procedure

If your page needs server-side data, you add procedures the same way — only in `custom/`.

### 1. Create your router in `worker/trpc/procedures/custom/<name>.ts`

```tsx
// worker/trpc/procedures/custom/keywords.ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, orgProcedure } from "../../init";
import { keywords } from "../../../../shared/custom/schema";

export const keywordsRouter = router({
  list: orgProcedure
    .query(async ({ ctx }) => {
      return ctx.db.query.keywords.findMany({
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });
    }),

  create: orgProcedure
    .input(z.object({ term: z.string().min(1), rank: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(keywords).values({
        id: crypto.randomUUID(),
        ...input,
      }).returning();
      return row;
    }),
});
```

### 2. Append to `worker/trpc/procedures/custom/registry.ts`

```tsx
import type { CustomRouterEntry } from "./types";
import { exampleRouter } from "./example";
import { keywordsRouter } from "./keywords";

const customRouters: CustomRouterEntry[] = [
  { key: "example", router: exampleRouter },
  // ↓ ADD YOUR ENTRY HERE ↓
  { key: "keywords", router: keywordsRouter },
];

export default customRouters;
```

### 3. Add your table to `shared/custom/schema.ts`

```tsx
// shared/custom/schema.ts — APPEND your tables here
import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const keywords = pgTable("keywords", {
  id: text("id").primaryKey(),
  term: text("term").notNull(),
  rank: integer("rank").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 4. Use from your custom page

```tsx
// src/pages/custom/seo-dashboard.tsx
import { trpc } from "@/lib/trpc";

export default function SeoDashboard() {
  const { data: keywords } = trpc.custom.keywords.list.useQuery();
  //                          ^^^^^^ ^^^^^^^^ ^^^^
  //                          namespace from router.ts
  //                                   key from registry
  //                                            procedure name

  return (
    <div className="flex flex-col h-full p-5">
      <h1 className="text-2xl font-normal mb-4">SEO Dashboard</h1>
      {/* render keywords */}
    </div>
  );
}
```

Custom procedures are namespaced under `trpc.custom.<key>.<procedure>`.

### Registry Entry Shape

```ts
interface CustomRouterEntry {
  key: string;        // namespace key → trpc.custom.<key>
  router: AnyRouter;  // tRPC router instance
}
```

---

## Architecture Overview

```
Browser (HQ)  ──wss──▶  OpenClaw Gateway (real-time agent comms)
              ──http──▶  Cloudflare Worker (/api/trpc/*)  ──▶  Database
```

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Routing**: React Router 7 (BrowserRouter)
- **Components**: shadcn/ui (Radix + CVA + tailwind-merge)
- **Icons**: Lucide React exclusively
- **State**: tRPC + React Query for server data, React context for client state
- **Backend**: Hono + tRPC on Cloudflare Workers, Drizzle ORM
- **Package manager**: Bun

### Path Aliases

```
@/*       → ./src/*
@shared/* → ./shared/*
```

**Always use `@/` imports for frontend, never relative paths like `../../`.** Backend files in `worker/` use relative imports since they're outside the `@/` alias.

---

## Project Structure

```
src/
├── pages/
│   ├── custom/                          ← ✅ YOUR PAGES
│   │   ├── types.ts                     ← CustomPageEntry interface (read-only)
│   │   ├── registry.ts                  ← append entries here
│   │   └── example.tsx                  ← reference template
│   ├── dashboard.tsx                    ← ❌ CORE — do not touch
│   └── tasks.tsx                        ← ❌ CORE
├── hooks/                               ← ❌ CORE — use, don't modify
│   ├── use-gateway.tsx
│   ├── use-chat.ts
│   ├── use-trpc.tsx
│   └── use-messenger-panel.tsx
├── lib/                                 ← ❌ CORE — use, don't modify
│   ├── gateway-client.ts
│   ├── trpc.ts
│   └── utils.ts                         ← cn() helper — import this
├── components/                          ← ❌ CORE — use, don't modify
│   ├── ui/                              ← shadcn primitives (Button, Input, etc.)
│   ├── tasks/
│   ├── messenger/
│   └── top-nav.tsx
shared/
├── custom/
│   └── schema.ts                        ← ✅ YOUR TABLES
├── schema.ts                            ← ❌ CORE
├── types.ts                             ← ❌ CORE (but import from here)
└── slug.ts                              ← ❌ CORE
worker/
├── trpc/
│   ├── procedures/
│   │   ├── custom/                      ← ✅ YOUR PROCEDURES
│   │   │   ├── types.ts                 ← CustomRouterEntry interface (read-only)
│   │   │   ├── registry.ts             ← append entries here
│   │   │   └── example.ts              ← reference template
│   │   ├── task.ts                      ← ❌ CORE
│   │   └── comment.ts                   ← ❌ CORE
│   ├── router.ts                        ← ❌ CORE (auto-merges your routers)
│   ├── init.ts                          ← ❌ CORE (import router, orgProcedure from here)
│   └── context.ts                       ← ❌ CORE
├── db/
│   └── client.ts                        ← ❌ CORE (auto-includes your schema)
└── index.ts                             ← ❌ CORE
```

---

## Available Hooks (use these, don't modify them)

### `useGateway()`

Access the WebSocket connection to the agent swarm.

```tsx
import { useGateway } from "@/hooks/use-gateway";

const { client, connected, agents, subscribe } = useGateway();
```

| Field | Type | Description |
|-------|------|-------------|
| `client` | `GatewayClient \| null` | Make RPC calls: `client.request("method", params)` |
| `connected` | `boolean` | WebSocket connection status |
| `agents` | `Agent[]` | List of connected agents (`id`, `name`, `identity`) |
| `subscribe` | `(handler) => unsubscribe` | Listen to real-time events |

#### Available Gateway RPC Methods

```ts
// Chat
client.request("chat.send", { sessionKey, message, idempotencyKey })
client.request("chat.history", { sessionKey, limit })
client.request("chat.abort", { sessionKey })

// Agents
client.request("agents.list")
client.request("agents.files.list", { agentId })
client.request("agents.files.get", { agentId, path })

// Sessions
client.request("sessions.list", { agentId })
client.request("sessions.preview", { sessionKey })

// Config
client.request("config.get")
client.request("config.set", { path, value })

// System
client.request("health")
client.request("status")
client.request("usage.cost")
client.request("models.list")

// Cron
client.request("cron.list")
client.request("cron.add", { ... })
```

#### Subscribing to Events

```tsx
useEffect(() => {
  return subscribe((evt) => {
    if (evt.event !== "chat") return;
    const { sessionKey, state, message } = evt.payload;
    // state: "delta" | "final" | "aborted" | "error"
  });
}, [subscribe]);
```

Event types: `chat`, `presence`, `tick`, `health`, `exec.approval.requested`, `cron`

### `useChat(agentId, sessionSuffix?)`

Chat with a specific agent.

```tsx
import { useChat } from "@/hooks/use-chat";

const { messages, stream, isStreaming, loading, error, sendMessage } = useChat(agentId);
```

### `trpc` (tRPC Client)

Server data via tRPC + React Query.

```tsx
import { trpc } from "@/lib/trpc";

// Core procedures (read-only data)
const { data: tasks } = trpc.task.list.useQuery({ status: "doing" });
const { data: task } = trpc.task.get.useQuery({ id: taskId }, { enabled: !!taskId });

// Your custom procedures (under trpc.custom.*)
const { data } = trpc.custom.myRouter.list.useQuery();
const mutation = trpc.custom.myRouter.create.useMutation({
  onSuccess: () => utils.custom.myRouter.list.invalidate(),
});
```

#### Core Procedures (use but don't modify)

```
task.list       — query tasks (optional status filter)
task.get        — get single task by ID
task.create     — create task (title required)
task.update     — partial update by ID
task.delete     — delete by ID
task.comment.add    — add comment
task.comment.delete — delete comment
```

---

## Backend Patterns (for custom procedures)

### Imports in custom procedures

```tsx
// From core init (these are the building blocks — use them, don't modify)
import { router, orgProcedure, authedProcedure, publicProcedure } from "../../init";

// Zod for input validation
import { z } from "zod";

// Drizzle operators
import { eq, and, desc } from "drizzle-orm";

// Your custom schema
import { myTable } from "../../../../shared/custom/schema";
```

### Procedure types

| Procedure | Auth | Use case |
|-----------|------|----------|
| `publicProcedure` | None | Public data |
| `authedProcedure` | User or agent | Authenticated access |
| `orgProcedure` | User+org or agent | Most custom procedures (recommended) |
| `adminProcedure` | Admin user only | Admin-only operations |

### Drizzle patterns

```tsx
// Query
ctx.db.query.myTable.findMany({
  where: eq(myTable.field, value),
  orderBy: (t, { desc }) => [desc(t.createdAt)],
});

// Insert
const [row] = await ctx.db.insert(myTable).values({ ... }).returning();

// Update
const [updated] = await ctx.db.update(myTable)
  .set({ field: newValue })
  .where(eq(myTable.id, id))
  .returning();

// Delete
await ctx.db.delete(myTable).where(eq(myTable.id, id));
```

### Schema patterns

```tsx
// shared/custom/schema.ts
import { pgTable, text, integer, boolean, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Use text IDs (slugs) or UUID
export const myTable = pgTable("my_table", {
  id: text("id").primaryKey(),                    // or uuid("id").primaryKey().defaultRandom()
  name: text("name").notNull(),
  count: integer("count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
});
```

---

## Styling Rules

**Design philosophy**: "Palantir meets Apple" — premium, calm, dark-mode first. Agents look busy, humans feel calm.

### Critical Rules

| Rule | Do | Don't |
|------|-----|-------|
| Headings | `font-normal` | `font-bold`, `font-semibold` |
| Inline edits | `bg-transparent border-none outline-none` | Visible borders on editable fields |
| Placeholders | `placeholder:text-muted-foreground/50` | Full-opacity placeholders |
| Save pattern | `onBlur` | `onChange` per keystroke |
| Icons | Lucide React, `size-4` | Heroicons, emoji, any other library |
| Borders | `border-border/40` or `/50` | Full-opacity borders |
| Status colors | `-400` variants (e.g. `text-red-400`) | `-500` or `-600` |
| Class merging | `cn()` from `@/lib/utils` | String concatenation |
| Machine data | `font-mono` (timestamps, IDs, counts) | Mono for human content |
| Human content | `font-sans` (titles, descriptions) | Sans for machine data |

### Layout Patterns

```tsx
// Full-height page (standard page structure)
<div className="flex flex-col h-full p-5">
  <h1 className="text-2xl font-normal mb-4">Page Title</h1>
  {/* content */}
</div>

// Responsive grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">

// Split panel
<div className="flex h-full">
  <div className="w-[240px] shrink-0 border-r flex flex-col">...</div>
  <div className="flex-1 min-w-0">...</div>
</div>

// Property row (key-value)
<div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0">
  <div className="flex items-center gap-2 text-muted-foreground w-28 shrink-0">
    <Icon className="size-4" />
    <span className="text-sm">{label}</span>
  </div>
  <div className="flex-1 min-w-0">{value}</div>
</div>
```

### Card Pattern

```tsx
<div className="group relative overflow-hidden rounded-lg border border-border/40 bg-card p-3.5 swarm-card">
  {/* Active shimmer (when agent is working) */}
  {active && (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
      <div className="h-full w-full"
        style={{
          background: "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
          opacity: 0.6,
          animation: "swarm-shimmer 2s ease-in-out infinite",
        }}
      />
    </div>
  )}
  {/* Card content */}
</div>
```

### Color Tokens

| Token | Usage |
|-------|-------|
| `foreground` / `muted-foreground` | Text |
| `border` / `card` / `background` | Surfaces |
| `--swarm-violet` | Primary accent, active states |
| `--swarm-mint` | Success, done states |
| `--swarm-blue` | Info, secondary accent |
| `--swarm-glass` | Glassmorphism panels |

### Spacing

| Context | Value |
|---------|-------|
| Page padding | `p-5` |
| Panel padding | `px-6 py-4` |
| Card padding | `p-3.5` |
| Property rows | `py-2.5` |
| Between cards | `space-y-1.5` |
| Column gaps | `gap-3` |

### Empty States

```tsx
<p className="text-xs text-muted-foreground/50 text-center py-8">
  No data yet.
</p>
```

Simple centered text. No illustrations. No emoji.

### Loading States

```tsx
// Skeleton (preferred for content)
<Skeleton className="h-8 w-full" />

// Spinner (auth/onboarding only)
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
```

---

## Component Patterns

### Export Conventions

- **Pages**: `export default function PageName()` — always default export
- **Components**: `export function ComponentName()` — always named export
- **Hooks**: `export function useHookName()` — named export
- **Types**: export alongside component or from dedicated `types.ts`

### State Management

```tsx
// tRPC query with conditional fetching
const { data } = trpc.custom.myRouter.get.useQuery(
  { id: itemId! },
  { enabled: !!itemId }
);

// Mutation with cache invalidation
const utils = trpc.useUtils();
const mutation = trpc.custom.myRouter.update.useMutation({
  onSuccess: () => {
    utils.custom.myRouter.list.invalidate();
  },
});

// Local state synced with server
const [title, setTitle] = useState("");
useEffect(() => {
  if (data) setTitle(data.title);
}, [data]);

// Save on blur
const save = (field: string, value: unknown) => {
  if (!itemId || !data) return;
  if (value === data[field]) return; // skip if unchanged
  mutation.mutate({ id: itemId, [field]: value });
};
```

### Async Effect Cleanup

```tsx
useEffect(() => {
  let stale = false;
  client.request("some.method").then((res) => {
    if (stale) return;
    setData(res);
  });
  return () => { stale = true; };
}, [client]);
```

---

## Anti-Patterns (Never Do These)

- **Never edit core files** — only work in `custom/` directories
- No `font-bold` or `font-semibold` on headings
- No visible borders on inline editable fields
- No neon/cyberpunk colors (`#ccff00`, `#00ffff`)
- No CRT scanlines or retro terminal aesthetics
- No decorative illustrations or empty-state graphics
- No toast messages for inline saves (save silently on blur)
- No modal confirmations for non-destructive actions
- No monospace for general UI text
- No relative imports (`../../`) in frontend — use `@/` aliases
- No Heroicons, emoji, or non-Lucide icons
- No `font-bold` column headers
- No thick colored borders on panels
- No aggressive glow effects

---

## Checklist Before Submitting

### Frontend
- [ ] Page file is in `src/pages/custom/` with `export default`
- [ ] Entry appended to `src/pages/custom/registry.ts`
- [ ] Icon is a valid Lucide name (browse at lucide.dev/icons)
- [ ] Uses `@/` imports, never relative
- [ ] Headings use `font-normal`, never bold
- [ ] Inline edits use `bg-transparent border-none outline-none` + save-on-blur
- [ ] `cn()` used for conditional classes
- [ ] Machine data in `font-mono`, human content in sans
- [ ] No anti-pattern violations

### Backend (if applicable)
- [ ] Router file is in `worker/trpc/procedures/custom/`
- [ ] Entry appended to `worker/trpc/procedures/custom/registry.ts`
- [ ] Schema additions are in `shared/custom/schema.ts` only
- [ ] Uses `orgProcedure` (or appropriate procedure type) from `../../init`
- [ ] Input validated with Zod schemas
- [ ] Mutations use `.returning()`
- [ ] No core files modified

### Final
- [ ] `npx tsc --noEmit` passes
- [ ] No core files were modified (only `custom/` directories)
