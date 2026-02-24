# HQ Frontend Style Guide

## Customer Profile

Our user is a **CEO running a $20M agency**. Not a developer. Not technical. They manage their entire business through AI agents and need to feel in control, not overwhelmed. They use this tool all day — it's their cockpit.

- They scan, they don't study. Information hierarchy matters more than information density.
- They think in outcomes ("is this mission healthy?"), not data points ("3/5 objectives, 2,847/10,000 visits").
- They trust the tool when it feels calm and premium. They distrust it when it feels busy or technical.
- Every screen should feel like opening a luxury business tool — trustworthy, clear, and effortless.

## Design Mindset

**Always design from first principles, not convention.** Before adding a component, ask: what does the customer actually need here? What are they trying to decide? What can be removed?

- **Customer-first** — Every design decision starts with "what does the CEO need to see/do?" If a pattern doesn't serve that, change it. Don't be afraid to completely redesign something that isn't working, even if it was just built.
- **Orient, then inform** — Compact views (lists, rows, summaries) should help the user identify and select. Detail views should inform. Don't mix the two.
- **Less is more** — If you're adding a third row of metadata to a list item, you've gone too far. If you're showing KPI numbers in a navigation context, move them to the detail view.
- **Question inherited patterns** — Don't copy a pattern just because it exists elsewhere in the codebase. Ask if it serves the customer in this specific context. A card pattern that works for tasks may not work for missions.

**Design philosophy:** Light, warm, spacious. The AI agents are doing the complex work — the interface should feel calm, confident, and human. Think Notion's warmth, Linear's precision, the dashboard of a luxury car. Not a server monitoring terminal.

Reference: `src/components/tasks/task-detail-sheet.tsx` and `src/pages/dashboard.tsx`.

---

## Core Principles

- **Light-first** — Design for light mode, verify in dark. Default theme is light. Both modes use warm neutrals, never cold grays.
- **Spacious & readable** — Generous padding (`p-12` on pages), large type for headings, plenty of breathing room. This person uses this tool all day — comfort matters.
- **Human over technical** — No monospace for names or labels. No uppercase tracking-widest patterns. No hex codes or IDs visible unless necessary. Use plain language.
- **Warm neutrals** — Backgrounds carry a subtle cream undertone (hue 75). Never pure white, never cold gray. The warmth is almost invisible but creates an inviting feel.
- **Quiet chrome** — The interface should disappear. Borders are subtle, buttons are understated, status indicators are small. Content and people's names come first.

---

## Fonts

### Three font roles

| Font | Class | Use |
|------|-------|-----|
| **Instrument Serif** | `font-display` | Page titles, greetings, sheet titles. The warm, editorial voice of the product. |
| **Geist** (sans) | default | Everything else — body text, labels, buttons, nav, descriptions, comments. The workhorse. |
| **Geist Mono** | `font-mono` | Only for truly machine data: timestamps in the status bar, code snippets, IDs. Very sparingly. |

Instrument Serif is loaded via Google Fonts in `index.html`. The `.font-display` class is defined in `index.css`.

---

## Typography Scale

| Element | Classes |
|---------|---------|
| Page greeting / hero title | `font-display text-6xl font-normal` |
| Page title (e.g. "Tasks") | `font-display text-5xl font-normal` |
| Sheet / detail title | `font-display text-4xl font-normal` |
| Dialog title | `font-display text-2xl font-normal` |
| Section heading | `text-sm font-medium text-muted-foreground` |
| Body text | `text-sm` |
| Card title | `text-sm font-medium` |
| Card description | `text-[13px] text-muted-foreground` |
| Metadata / footer text | `text-xs text-muted-foreground/60` |
| Placeholder text | `placeholder:text-muted-foreground/50` |
| Empty state | `text-sm text-muted-foreground/40 text-center` |

**Key rules:**
- Page-level headings always use `font-display` (Instrument Serif).
- Never use `font-bold` or `font-semibold` on headings. Use `font-normal` for display, `font-medium` for card titles and nav.
- Monospace (`font-mono`) is reserved for the status bar and truly numeric/system data. Never for names, labels, or status text visible to the user.

---

## Color System

### Theme approach

Light mode is the default. Both modes use warm neutrals — light mode has a cream undertone (hue 75), dark mode has a warm violet undertone (hue 265 instead of cold 270).

### Semantic tokens

Use these everywhere. Never hardcode oklch values in components.

- `background` — Page canvas
- `card` — Cards, panels, popovers
- `foreground` / `muted-foreground` — Text hierarchy
- `border` — Borders (use `/40` or `/50` opacity variants for subtlety)
- `primary` — Violet accent (deeper in light mode for contrast, lighter in dark)

### Swarm tokens (defined in both `:root` and `.dark`)

| Token | Purpose |
|-------|---------|
| `--swarm-violet` | Brand accent, active states, shimmer animations |
| `--swarm-violet-dim` | Subtle violet tint for active card backgrounds |
| `--swarm-mint` | Success, "done" status |
| `--swarm-blue` | Info, secondary accent |
| `--swarm-surface` / `--swarm-surface-hover` | Elevated surfaces |

### Status colors

| Status | Dot color |
|--------|-----------|
| Todo | `text-gray-400` |
| Doing | `text-[var(--swarm-violet)]` |
| Stuck | `text-red-400` |
| Done | `text-[var(--swarm-mint)]` |

Use `-400` variants for softer tones. Status is shown via small dots, never large colored areas.

### Priority colors (light + dark)

- **Urgent active:** `border-red-300/40 bg-red-50 text-red-600` (light) / `border-red-400/30 bg-red-950/40 text-red-300` (dark)
- **Important active:** `border-amber-300/40 bg-amber-50 text-amber-600` (light) / `border-amber-400/30 bg-amber-950/40 text-amber-300` (dark)

---

## Spacing

| Context | Value |
|---------|-------|
| **Page padding** | `p-12` (generous — this is not a dense dev tool) |
| Page title top/bottom | `pt-10 pb-6` or `pt-4 pb-8` |
| Panel/sheet padding | `px-6 py-4` |
| Column header | `px-4 py-3.5` |
| Card internal | `p-4` |
| Between cards | `space-y-2` |
| Between columns | `gap-4` |
| Between sections | `mt-4` with `border-t` |
| Comment list | `space-y-6` |

---

## Layout Patterns

### Top-nav shell

```
┌──────────────────────────────────────────────────────────┐
│  TopNav  [HQ logo] [Tasks] [Missions]  [💬] [🌙] [avatar] │
├────────────────────────────────┬─────────────────────────┤
│                                │  Chat Panel (420px)     │
│    Main Content (p-12)         │  [Agent tabs] [✕]       │
│                                │  Messages               │
│                                │  [Input]                │
└────────────────────────────────┴─────────────────────────┘
```

### Page structure

Every page follows this pattern:
```tsx
<div className="flex flex-col h-full p-12">
  <div className="pt-4 pb-8">
    <h1 className="font-display text-5xl font-normal text-foreground">
      Page Title
    </h1>
  </div>
  {/* Content */}
</div>
```

### Split-panel (detail sheets)

```
┌─────────────────┬──────────────────┐
│  Left (540px)   │  Right (flex-1)  │
│  Properties     │  Tabs + Content  │
└─────────────────┴──────────────────┘
```

### List + detail split (missions pattern)

```
┌──────────────────┬────────────────────────────────────┐
│ List (380px)      │ Detail (flex-1, px-10 py-8)        │
│ scrollable        │ scrollable                         │
└──────────────────┴────────────────────────────────────┘
```

List rows are **orient, not inform** — they help the user identify and select, not read everything. Detail lives in the right panel.

### Messenger / Chat Panel

The chat panel uses a **comment-thread style** (like Notion, Linear, Slack), not a phone chat style.

- **All messages left-aligned** — no zig-zag reading pattern
- **User messages**: "You" speaker label + subtle `bg-muted/20 rounded-lg` container
- **Agent messages**: Agent name label + plain text (no container — it's the default speaker)
- **Speaker labels shown when speaker changes** — reduces repetition, cleaner rhythm
- **Timestamps**: Sans-serif (not monospace), muted, shown with speaker label
- **Agent switching**: Horizontal text tabs in panel header (names, not circles/icons). Selected tab is underlined. Like Linear sidebar sections.
- **Input**: Bottom-docked with `border-t border-border/50` separator. Clean textarea with `px-4 py-3`. No pill container. Placeholder: "Message {agent name}..."
- **Send button**: Ghost variant `size-7`, subtle — not a dark circle
- **Streaming indicator**: "Thinking..." in `text-xs text-muted-foreground/40`, then text + cursor
- **Panel width**: 420px total (no agent strip)

### List rows

```tsx
<button className="relative w-full text-left px-5 py-3.5 transition-colors">
  {/* Line 1: Title + status dot */}
  <div className="flex items-center gap-2.5">
    <span className="flex-1 text-sm truncate">{title}</span>
    <span className="size-1.5 rounded-full ..." />
  </div>
  {/* Line 2: Metadata — agent, counts */}
  <div className="flex items-center gap-1.5 mt-1">
    <span className="text-xs text-muted-foreground/50">{meta}</span>
  </div>
  {/* Progress bar flush to bottom — doubles as separator */}
  <div className="absolute inset-x-0 bottom-0 h-[2px] bg-border/15">
    <div style={{ width: `${progress}%` }} className="h-full rounded-r-full" />
  </div>
</button>
```

Key principles:
- **Title is the hero** — `text-sm`, the only non-muted text
- **One metadata line** — agent name, human-readable counts with dot separators ("3 of 5 objectives" not "3/5 obj")
- **No emoji in list rows** — emoji is for detail views and cards where there's room to breathe. In lists it's visual noise.
- **No KPI chips or numbers** — that's detail-level data. The progress bar gives health at a glance.
- **Progress bar as bottom border** — 2px, flush to edges, replaces both a border separator and a numeric progress indicator. Uses status-colored fill (violet for active, mint for complete).
- **Selected state**: left accent border (3px violet) + `bg-muted/40` — intentional, like Linear
- **Hover**: `bg-muted/20`

### Property rows

```tsx
<div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0">
  <div className="flex items-center gap-2 text-muted-foreground w-28 shrink-0">
    <Icon className="size-4" />
    <span className="text-sm">{label}</span>
  </div>
  <div className="flex-1 min-w-0">{children}</div>
</div>
```

---

## Cards

```tsx
<div className="group relative cursor-pointer overflow-hidden rounded-xl border border-border/40 bg-card p-4 swarm-card">
```

- `rounded-xl` — softer, friendlier radius
- `p-4` — comfortable internal padding
- `swarm-card` class for hover: soft shadow in light mode, brightened border in dark mode
- `group` for hover-reveal children (delete buttons, etc.)

### Active card shimmer

When an agent is working on a task, a subtle violet gradient sweeps across the top edge:

```tsx
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
```

---

## Columns (Kanban)

```tsx
<div className="flex flex-col min-w-[290px] flex-1 rounded-2xl border border-border/40 bg-card/60 dark:bg-card/40">
```

- `rounded-2xl` — larger radius than cards for visual hierarchy
- Semi-transparent card background — columns recede, cards pop
- Column header: status dot + label (`font-medium`) + plain count (`text-xs`)

---

## Interactive Elements

### Inline editable fields

```tsx
<input
  className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 w-full"
  onBlur={() => save(field, value)}
/>
```

- No visible border — feels like static text until focused
- Save on blur, not on keystroke

### Buttons

- Primary: `<Button>` component (shadcn)
- Icon-only: `<Button size="icon" variant="ghost" className="size-7">`
- Muted ghost: `text-muted-foreground/40 hover:text-foreground`
- Destructive hover: `text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10`
- Reveal on hover: `opacity-0 group-hover:opacity-100 transition-opacity`

### Dropdowns

```tsx
<SelectTrigger className="h-7 w-auto gap-1.5 border-none shadow-none px-2 text-xs font-medium">
```

No monospace on dropdown triggers. Clean, sans-serif text.

---

## Icons

- **Library:** Lucide React exclusively
- **Sizes:** `size-4` standard, `size-3` metadata, `size-3.5` small buttons, `size-5` page headers
- **Color:** Inherit from parent. Only apply color directly for status dots and priority icons.

---

## Empty States

```tsx
<p className="text-sm text-muted-foreground/40 text-center py-12">
  No tasks yet
</p>
```

Simple centered text. Friendly language ("No tasks yet" not "No tasks"). No illustrations.

---

## CSS Utility Classes

| Class | Purpose |
|-------|---------|
| `font-display` | Instrument Serif — for page titles and hero text |
| `swarm-card` | Card hover effect (soft shadow light, brightened border dark) |
| `swarm-status-dot` | 7px status circle. Add `.active` for glow. |
| `animate-pulse-soft` | Gentle pulse animation (2s cycle) |

---

## Animations

| Keyframe | Duration | Usage |
|----------|----------|-------|
| `swarm-shimmer` | 2s (active), 4s (passive) | Violet gradient sweep on card top edge |
| `pulse-soft` | 2s | Status dot pulse |

Animations should be subtle and calming. Never aggressive or flashy.

---

## Anti-patterns (do NOT do)

- **No monospace for names, labels, or status text.** Only for truly machine data in the status bar.
- **No uppercase + tracking-widest patterns.** That's a developer aesthetic.
- **No `font-bold` or `font-semibold` on headings.** Instrument Serif speaks for itself at `font-normal`.
- **No hardcoded `dark:bg-[oklch(...)]` in components.** Use semantic tokens (`bg-card`, `bg-background`, `bg-muted/30`).
- **No cold grays.** All neutrals carry a warm undertone.
- **No dense/compact layouts.** Pages use `p-12`, not `p-5`. Generous spacing signals premium.
- **No neon or cyberpunk colors.** Violet is the brand, used sparingly. Mint for success. Everything else is warm neutral.
- **No glassmorphism in light mode.** It's a dark-mode technique. Use semi-transparent card backgrounds instead.
- **No decorative illustrations.** Empty states use simple text.
- **No modal confirmations for non-destructive actions.** Save silently on blur.
- **No raw IDs or technical jargon in the UI.** Show human-readable names.
- **No emoji in compact/list contexts.** Emoji is for detail panels and cards with breathing room. In lists and rows, it's visual clutter that hurts scannability.
- **No abbreviations in user-facing text.** Write "3 of 5 objectives" not "3/5 obj". The CEO reads words, not shorthand.
- **No phone-chat patterns in messenger.** No right-aligned bubbles, no dark user bubbles (`bg-foreground text-background`), no three-dot typing indicators, no rounded pill inputs with dark send buttons. This is a business tool, not iMessage.
- **No monospace for agent names, timestamps, or labels in chat.** Monospace is for machine data only (status bar, code snippets).
