# Skill: HQ Custom Page Developer

You are an AI agent building custom pages for HQ — a mission control dashboard for AI agent swarms. This document teaches you how to correctly create, register, and style pages in this codebase.

---

## Quick Start — Adding a Custom Page

1. Create your page component in `src/pages/custom/<your-page>.tsx`
2. Add an entry to `src/pages/custom/registry.ts`
3. Done — the page auto-appears in nav and routing

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
// src/pages/custom/registry.ts — append your entry
import type { CustomPageEntry } from "./types";

const customPages: CustomPageEntry[] = [
  // ... existing entries
  {
    id: "seo-dashboard",
    label: "SEO",
    icon: "search",                              // lucide icon name, kebab-case
    component: () => import("./seo-dashboard"),   // dynamic import
  },
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

**Always use `@/` imports, never relative paths like `../../`.**

---

## Project Structure

```
src/
├── pages/
│   ├── custom/              ← YOUR PAGES GO HERE
│   │   ├── types.ts         ← CustomPageEntry interface
│   │   ├── registry.ts      ← add entries here (auto-registers in nav + routes)
│   │   └── example.tsx      ← reference template
│   ├── dashboard.tsx
│   └── tasks.tsx
├── hooks/
│   ├── use-gateway.tsx      ← WebSocket client (agents, events, RPC)
│   ├── use-chat.ts          ← chat messaging per session
│   ├── use-trpc.tsx         ← tRPC + React Query provider
│   └── use-messenger-panel.tsx
├── lib/
│   ├── gateway-client.ts    ← raw WebSocket client class
│   ├── trpc.ts              ← tRPC client setup
│   └── utils.ts             ← cn() helper
├── components/
│   ├── ui/                  ← shadcn primitives (Button, Input, Sheet, etc.)
│   ├── tasks/               ← kanban board, task cards, detail sheet
│   ├── messenger/           ← chat panel
│   └── top-nav.tsx
shared/
├── schema.ts                ← Drizzle tables (tasks, comments)
├── types.ts                 ← TASK_STATUSES, TaskStatus, STATUS_LABELS
└── slug.ts                  ← task ID generation
worker/
├── trpc/procedures/         ← task.ts, comment.ts
└── index.ts                 ← Hono entry
```

---

## Available Hooks

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

#### Available RPC Methods

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

// Queries
const { data: tasks } = trpc.task.list.useQuery({ status: "doing" });
const { data: task } = trpc.task.get.useQuery({ id: taskId }, { enabled: !!taskId });

// Mutations
const utils = trpc.useUtils();
const createTask = trpc.task.create.useMutation({
  onSuccess: () => utils.task.list.invalidate(),
});
createTask.mutate({ title: "New task", status: "todo" });
```

#### Available Procedures

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
// Full-height page
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
const { data } = trpc.task.get.useQuery(
  { id: taskId! },
  { enabled: !!taskId }
);

// Mutation with cache invalidation
const utils = trpc.useUtils();
const mutation = trpc.task.update.useMutation({
  onSuccess: () => {
    utils.task.list.invalidate();
    utils.task.get.invalidate({ id: taskId! });
  },
});

// Local state synced with server
const [title, setTitle] = useState("");
useEffect(() => {
  if (task) setTitle(task.title);
}, [task]);

// Save on blur
const save = (field: string, value: unknown) => {
  if (!taskId || !task) return;
  if (value === task[field]) return; // skip if unchanged
  mutation.mutate({ id: taskId, [field]: value });
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

### Context + Provider + Hook Pattern

```tsx
const MyContext = createContext<Value | null>(null);

export function MyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial);
  return <MyContext.Provider value={{ state }}>{children}</MyContext.Provider>;
}

export function useMyContext() {
  const ctx = useContext(MyContext);
  if (!ctx) throw new Error("useMyContext must be used within MyProvider");
  return ctx;
}
```

---

## Anti-Patterns (Never Do These)

- No `font-bold` or `font-semibold` on headings
- No visible borders on inline editable fields
- No neon/cyberpunk colors (`#ccff00`, `#00ffff`)
- No CRT scanlines or retro terminal aesthetics
- No decorative illustrations or empty-state graphics
- No toast messages for inline saves (save silently on blur)
- No modal confirmations for non-destructive actions
- No monospace for general UI text
- No relative imports (`../../`) — use `@/` aliases
- No Heroicons, emoji, or non-Lucide icons
- No `font-bold` column headers
- No thick colored borders on panels
- No aggressive glow effects

---

## Backend — Adding tRPC Procedures

If your custom page needs new server-side data:

### 1. Add procedure in `worker/trpc/procedures/`

```tsx
import { z } from "zod";
import { router, orgProcedure } from "../init";

export const myRouter = router({
  list: orgProcedure
    .input(z.object({ filter: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.query.myTable.findMany({
        where: input?.filter ? eq(myTable.field, input.filter) : undefined,
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });
    }),

  create: orgProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(myTable).values(input).returning();
      return row;
    }),
});
```

### 2. Register in `worker/trpc/router.ts`

```tsx
export const appRouter = router({
  task: mergeRouters(taskRouter, router({ comment: commentRouter })),
  my: myRouter,  // ← add here
});
```

### 3. Add Drizzle schema in `shared/schema.ts`

```tsx
export const myTable = pgTable("my_table", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## Checklist Before Submitting

- [ ] Page file is in `src/pages/custom/` with `export default`
- [ ] Entry added to `src/pages/custom/registry.ts`
- [ ] Icon is a valid Lucide name (browse at lucide.dev/icons)
- [ ] Uses `@/` imports, never relative
- [ ] Headings use `font-normal`, never bold
- [ ] Inline edits use `bg-transparent border-none outline-none` + save-on-blur
- [ ] `cn()` used for conditional classes
- [ ] Machine data in `font-mono`, human content in sans
- [ ] No anti-pattern violations
- [ ] `npx tsc --noEmit` passes
