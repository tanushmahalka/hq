# HQ Frontend Style Guide — "Palantir meets Apple"

Reference: `src/components/tasks/task-detail-sheet.tsx` is the gold standard for design patterns in HQ.

**Design philosophy**: Agents look incredibly busy, humans feel incredibly calm. Premium enterprise aesthetic — think Linear, Vercel, Palantir. Not cyberpunk, not hacker terminal. Expensive, autonomous, clean.

---

## Core Principles

- **Premium & calm** — dark, layered surfaces with subtle depth. Glass-like panels. No visual noise.
- **Quiet by default** — muted foregrounds, low-opacity placeholders, subtle borders. Content speaks, chrome whispers.
- **Dark-mode first** — design for dark, verify in light. Use semantic colors (`foreground`, `muted-foreground`, `border`) and `--swarm-*` tokens for accent colors.
- **Readable density** — compact but not cramped. Enough breathing room for 8-hour workdays. Never sacrifice readability for density.
- **Subtle motion** — slow, elegant animations. Glows and shimmers indicate agent activity. Never aggressive or flashy.

---

## Color System

### Semantic tokens (use these for general UI)
- `foreground` / `muted-foreground` / `background` / `card` / `border` — standard shadcn tokens
- `primary` — maps to deep violet in dark mode

### Swarm tokens (use these for agent/status/accent purposes)
Defined in `index.css` under `.dark`:
| Token | Value | Usage |
|-------|-------|-------|
| `--swarm-violet` | `oklch(0.65 0.18 280)` | Primary accent, active states, shimmers, logo |
| `--swarm-violet-dim` | `oklch(0.65 0.18 280 / 12%)` | Subtle violet backgrounds |
| `--swarm-mint` | `oklch(0.75 0.14 165)` | Success, done, operational states |
| `--swarm-mint-dim` | `oklch(0.75 0.14 165 / 10%)` | Subtle success backgrounds |
| `--swarm-blue` | `oklch(0.68 0.15 245)` | Info, secondary accent |
| `--swarm-blue-dim` | `oklch(0.68 0.15 245 / 10%)` | Subtle info backgrounds |
| `--swarm-surface` | `oklch(0.16 0.008 270)` | Elevated surface |
| `--swarm-surface-hover` | `oklch(0.19 0.01 270)` | Hovered surface |
| `--swarm-glass` | `oklch(0.14 0.007 270 / 85%)` | Glassmorphism panel background |

### Dark mode backgrounds (layered depth)
```
Deepest:  oklch(0.10 0.005 270)  — layout shell
Base:     oklch(0.12 0.005 270)  — main content area
Surface:  oklch(0.13 0.005 270)  — --background
Card:     oklch(0.16 0.008 270)  — --card, panels
Elevated: oklch(0.20 0.01  270)  — --muted, hover states
```

All backgrounds carry a slight blue-violet hue (`270` hue angle) — never pure neutral gray.

### Status colors (used for dots, not large colored areas)
| Status | Color | Class |
|--------|-------|-------|
| Todo | Gray | `text-gray-400` |
| Doing | Violet | `text-[var(--swarm-violet)]` |
| Stuck | Red | `text-red-400` |
| In Review | Amber | `text-amber-400` |
| Done | Mint | `text-[var(--swarm-mint)]` |

Use `-400` variants (not `-500`) for softer, more premium tones.

---

## Typography

| Element | Classes |
|---------|---------|
| Page/sheet title | `text-2xl font-normal` (never bold for titles) |
| Section heading | `text-sm font-normal` |
| Body text | `text-sm` |
| Secondary/meta text | `text-[11px] text-muted-foreground` |
| Muted meta text | `text-[11px] text-muted-foreground/70` |
| Placeholder text | `placeholder:text-muted-foreground/50` |
| Empty state text | `text-xs text-muted-foreground/50 text-center` |

Font weights are deliberately light — `font-normal` for headings, `font-medium` for card titles and nav labels. Never use `font-bold` or `font-semibold` for headings.

Logo text uses `font-medium tracking-wide`.

### Monospace (`font-mono`)

Use monospace (Geist Mono) for **machine/system data** — it creates a visual distinction between "data the system produces" and "content humans write." Rule: **mono = machine, sans = human.**

| Use mono for | Example |
|--------------|---------|
| Timestamps & dates | `Feb 21, 14:30`, due date inputs |
| Agent/user names | Assignee, assignor, agent list names |
| Numeric counts | Column task counts, badge numbers |
| Status labels | Dropdown trigger text (`Doing`, `In Review`) |
| IDs & codes | Task IDs, API keys, code snippets |

| Keep sans-serif for | Example |
|---------------------|---------|
| Task titles & descriptions | Human-written content |
| Section headings & labels | "Status", "Priority", "Description" |
| Button text & nav links | "Tasks", "Files", action buttons |
| Comments & chat messages | Conversational content |
| Placeholder text | Always `placeholder:font-sans` when input is mono |

When an input field shows mono for its value, use `placeholder:font-sans` so the placeholder hint stays readable:
```tsx
<input className="font-mono placeholder:font-sans placeholder:text-muted-foreground/50" />
```

---

## Layout Patterns

### Split-panel (sheet/detail views)
```
┌─────────────────┬──────────────────┐
│  Left (540px)   │  Right (flex-1)  │
│  Properties     │  Tabs + Content  │
│  fixed-width    │  min-w-0         │
└─────────────────┴──────────────────┘
```
- Left: `w-[540px] shrink-0 flex flex-col overflow-y-auto border-r`
- Right: `flex-1 flex flex-col min-w-0 overflow-hidden`

### Full-height flex columns
For any panel with a scrollable body and pinned footer:
```tsx
<div className="flex flex-col h-full">
  <div className="flex-1 overflow-y-auto p-6 space-y-6">
    {/* scrollable content */}
  </div>
  <form className="relative border-t bg-muted/30 shrink-0">
    {/* pinned input */}
  </form>
</div>
```

### Property rows (key-value display)
```tsx
<div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0">
  <div className="flex items-center gap-2 text-muted-foreground w-28 shrink-0">
    <Icon className="size-4" />
    <span className="text-sm">{label}</span>
  </div>
  <div className="flex-1 min-w-0">{children}</div>
</div>
```
- Label column: fixed `w-28`, icon + text, `text-muted-foreground`
- Dividers: `border-b border-border/50` (half-opacity borders), `last:border-b-0`

---

## Spacing

| Context | Value |
|---------|-------|
| Page padding | `p-5` |
| Panel padding | `px-6 py-4` |
| Panel header | `px-4 py-3` |
| Between sections | `mt-4` with `border-t` |
| Between list items | `space-y-6` (comments), `space-y-3` (messages) |
| Between cards | `space-y-1.5` |
| Property row vertical | `py-2.5` |
| Card internal padding | `p-3.5` |
| Compact gaps | `gap-1`, `gap-1.5`, `gap-2` |
| Column gaps | `gap-3` |

---

## Colors & Borders

- **Borders**: `border-border/40` (default cards), `border-border/50` (dividers), `border-border` (stronger)
- **Backgrounds**: `bg-background` (base), `bg-card` (panels/cards), `bg-muted/30` (input areas), `bg-muted` (avatars)
- **Glassmorphism panels**: use `swarm-glass` class (adds backdrop-filter blur + translucent bg)
- **Status indicators**: small `swarm-status-dot` (7px circles) with status colors. Add `.active` for glow effect.
- **Priority icons**: `text-red-400` (urgent), `text-amber-400 fill-amber-400` (important) — softer `-400` variants
- **Mentions**: `text-blue-500 dark:text-blue-400 font-medium`
- **Hover destructive**: `hover:text-destructive hover:bg-destructive/10`

---

## Icons

- **Library**: Lucide React exclusively
- **Sizes**: `size-4` standard, `size-3` in metadata/footer, `size-3.5` for small buttons, `size-5` for page headers
- **Color**: inherit from parent text color. Never apply color directly to icons except for status indicators and priority.

---

## Interactive Elements

### Inline editable fields (text inputs, textareas)
```tsx
<input
  className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 w-full"
  onBlur={() => save(field, value)}
/>
```
- No visible border — feels like static text until focused
- Save on blur, not on keystroke
- `bg-transparent border-none outline-none`

### Inline textareas (title, description)
```tsx
<textarea
  className="w-full flex-1 text-sm bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed"
/>
```

### Buttons
- Primary actions: `<Button>` component
- Icon-only: `<Button size="icon" variant="ghost" className="size-7">`
- Ghost with muted text: `text-muted-foreground/40 hover:text-foreground`
- Dangerous hover: plain `<button>` with `text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10`
- Reveal on hover: `opacity-0 group-hover:opacity-100 transition-opacity`

### Select/Dropdown triggers (borderless)
```tsx
<SelectTrigger className="h-7 w-auto gap-1.5 border-none shadow-none px-2 text-xs font-medium">
```

---

## Cards

```tsx
<div className="group relative cursor-pointer overflow-hidden rounded-lg border border-border/40 bg-card p-3.5 swarm-card">
```
- `rounded-lg border-border/40 bg-card p-3.5`
- Hover via `swarm-card` class: brightens border to `oklch(1 0 0 / 12%)`, adds soft shadow
- Use `group` for hover-reveal children
- Active/doing cards get a violet shimmer on top edge (`swarm-shimmer` animation)

### Active card shimmer
```tsx
{(active || isDoing) && (
  <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
    <div
      className="h-full w-full"
      style={{
        background: "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
        opacity: active ? 0.6 : 0.25,
        animation: active ? "swarm-shimmer 2s ease-in-out infinite" : "swarm-shimmer 4s linear infinite",
      }}
    />
  </div>
)}
```

### Active pulse dot (for "doing" status)
```tsx
<div className="relative flex size-2">
  <div className="animate-pulse-soft absolute inline-flex h-full w-full rounded-full opacity-75"
       style={{ backgroundColor: "var(--swarm-violet)" }} />
  <div className="relative inline-flex size-2 rounded-full"
       style={{ backgroundColor: "var(--swarm-violet)" }} />
</div>
```

---

## Panels & Columns (Kanban)

```tsx
<div className="flex flex-col min-w-[280px] flex-1 rounded-xl border border-border/50 bg-card/50 dark:swarm-glass">
```
- `rounded-xl` (larger radius than cards)
- `bg-card/50` light mode, `swarm-glass` in dark mode (glassmorphism)
- No thick colored top borders — use `swarm-status-dot` in the header instead
- Column header: status dot + label (`font-normal`) + plain count (`text-xs text-muted-foreground/60`)

---

## Tabs

```tsx
<div className="flex items-center gap-0 border-b shrink-0">
  <button
    className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
      isActive
        ? "border-foreground text-foreground font-medium"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`}
  >
    <Icon className="size-4" />
    {label}
  </button>
</div>
```
- Active: `border-foreground` (bottom border), `font-medium`
- Inactive: `border-transparent text-muted-foreground`
- Counter badge: `text-[11px] text-muted-foreground font-normal`

---

## Avatars / User indicators

```tsx
<div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0">
  <span className="text-xs font-medium">{initial}</span>
</div>
```
- Simple circle with initial — no images unless explicitly provided
- Sizes: `size-7` standard, `size-5` compact (session messages)

---

## Logo

```tsx
<div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.65_0.18_280)] to-[oklch(0.68_0.15_245)] text-white shadow-sm">
  <Bot className="size-4" />
</div>
<span className="font-medium text-sm tracking-wide">HQ</span>
```
- Violet-to-blue gradient mark, `rounded-lg`, `shadow-sm`
- Text: `font-medium tracking-wide`

---

## Empty States

```tsx
<p className="text-xs text-muted-foreground/50 text-center py-8">
  No messages yet.
</p>
```
- Simple centered text, no illustrations
- Use `/50` opacity for even quieter empty states

---

## Loading States

- Spinner: `animate-spin rounded-full h-8 w-8 border-b-2 border-primary`
- Streaming cursor: `inline-block w-0.5 h-3.5 ml-0.5 bg-foreground/40 animate-pulse`
- Active indicator: violet shimmer on top edge (`h-px` + `swarm-shimmer` keyframe)

---

## Form Pages (login, signup, onboarding)

```tsx
<div className="flex min-h-screen items-center justify-center px-4">
  <Card className="w-full max-w-sm">
    <CardHeader className="text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.65_0.18_280)] to-[oklch(0.68_0.15_245)] text-white mb-2">
        <Icon className="size-5" />
      </div>
      <CardTitle className="text-xl">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <form className="space-y-4">
        {/* Label + Input pairs with space-y-2 */}
      </form>
    </CardContent>
  </Card>
</div>
```
- Centered card, `max-w-sm`
- Icon badge uses gradient logo style (not flat `bg-primary`)
- Form spacing: `space-y-4` between fields, `space-y-2` between label and input
- Error text: `text-sm text-destructive`

---

## CSS Utility Classes

Defined in `index.css`:
| Class | Purpose |
|-------|---------|
| `swarm-glass` | Glassmorphism panel: translucent bg + 20px backdrop blur |
| `swarm-card` | Premium card hover: brightened border + soft shadow |
| `swarm-status-dot` | 7px status indicator circle. Add `.active` for glow. |
| `animate-pulse-soft` | Gentle scale+opacity pulse (2s cycle) |

---

## Animations

| Keyframe | Duration | Usage |
|----------|----------|-------|
| `swarm-shimmer` | 2s (active), 4s (passive) | Violet gradient sweep on card top edge |
| `swarm-glow` | continuous | Subtle opacity pulse for glowing elements |
| `pulse-soft` | 2s | Status dot pulse (doing state) |

All animations use `ease-in-out` or `cubic-bezier(0.4, 0, 0.2, 1)`. Never use `linear` for UI animations except passive shimmers.

---

## Anti-patterns (do NOT do)

- No `font-bold` or `font-semibold` on headings
- No neon or high-saturation accent colors — use `-400` variants, not `-500` or `-600`
- No CRT scanlines, subpixel effects, or retro terminal aesthetics
- No monospace fonts in general UI — only for raw data values (IDs, timestamps, code)
- No thick colored borders on columns or panels — use small status dots instead
- No visible input borders for inline editable fields
- No decorative illustrations or empty-state graphics
- No toast-style success messages for inline saves (save silently on blur)
- No modal confirmations for non-destructive actions
- No aggressive glow effects — glows should be subtle, low-opacity halos
- No colored backgrounds on cards (use `bg-card` with subtle border changes)
- No neon green (`#ccff00`), cyan (`#00ffff`), or other cyberpunk palette colors
