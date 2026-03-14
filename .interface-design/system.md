# HQ Design System

## Direction & Feel

**Who:** A CEO running a $20M agency. Not technical. They manage their business through AI agents and need to feel in control, not overwhelmed. They scan, they don't study. They use this tool all day.

**What they do:** Supervise, coordinate, and communicate with a team of AI agents handling business operations — tasks, missions, approvals, workflows.

**Feel:** Warm like a luxury notebook. Calm like a reading app. Spacious like a well-designed office. The AI agents do the complex work — the interface stays composed and confident. Think Notion's warmth, Linear's precision, the dashboard of a luxury car.

**Signature:** The activity shimmer — a 1px violet gradient sweep across card edges when agents are active. It's the heartbeat of intelligence in motion. No other product signals "AI working" this way.

---

## Typography

Three font roles, never mix:

| Font | Class | Use |
|------|-------|-----|
| **Instrument Serif** | `font-display` | Page titles, greetings, sheet titles. The warm editorial voice. |
| **Geist** (sans) | default | Everything else — body, labels, buttons, nav, descriptions. |
| **Geist Mono** | `font-mono` | Machine data only: timestamps in status bar, code snippets, IDs, file paths. Never for names, labels, or status text. |

### Scale

| Element | Classes |
|---------|---------|
| Page greeting / hero | `font-display text-6xl font-normal` |
| Page title | `font-display text-5xl font-normal` |
| Sheet / detail title | `font-display text-4xl font-normal` |
| Dialog title | `font-display text-2xl font-normal` |
| Section heading | `text-sm font-medium text-muted-foreground` |
| Body text | `text-sm` |
| Card title | `text-sm font-medium` |
| Card description | `text-[13px] text-muted-foreground` |
| Metadata / footer | `text-xs text-muted-foreground/60` |
| Placeholder | `placeholder:text-muted-foreground/50` |
| Empty state | `text-sm text-muted-foreground/40 text-center` |

**Rules:** Never `font-bold` or `font-semibold` on headings. `font-normal` for display, `font-medium` for card titles and nav only.

---

## Color System

### Philosophy

Warm neutrals throughout. Light mode has a cream undertone (hue 75). Dark mode has a warm violet undertone (hue 265). Never pure white, never cold gray.

### Token Architecture

**Light mode base:**
- `--background: oklch(0.975 0.003 75)` — warm cream canvas
- `--card: oklch(0.995 0.002 75)` — near-white with warmth
- `--foreground: oklch(0.17 0.005 260)` — warm near-black
- `--muted-foreground: oklch(0.48 0.008 260)` — warm mid-gray
- `--border: oklch(0.91 0.005 75)` — barely-there warm line
- `--primary: oklch(0.50 0.19 280)` — deep violet

**Dark mode base:**
- `--background: oklch(0.14 0.004 265)` — warm dark
- `--card: oklch(0.17 0.006 265)` — one step up
- `--foreground: oklch(0.93 0.004 75)` — warm off-white
- `--border: oklch(1 0 0 / 8%)` — white at 8% opacity
- `--primary: oklch(0.62 0.18 280)` — lighter violet for contrast

### Swarm Tokens

| Token | Purpose |
|-------|---------|
| `--swarm-violet` | Brand accent, active states, shimmer |
| `--swarm-violet-dim` | Subtle violet tint for active backgrounds |
| `--swarm-mint` | Success, "done" status |
| `--swarm-blue` | Info, secondary accent |
| `--swarm-surface` / `--swarm-surface-hover` | Elevated surfaces |

### Status Colors

| Status | Indicator |
|--------|-----------|
| Todo | `bg-gray-400` dot |
| Doing | `bg-[var(--swarm-violet)]` dot |
| Stuck | `bg-red-400` dot |
| Done | `bg-[var(--swarm-mint)]` dot |

Status shown via small dots (7px), never large colored areas. Use `swarm-status-dot` class with `.active` for glow.

### Priority Colors

- **Urgent active:** `bg-red-100 text-red-700` / dark: `bg-red-950 text-red-300`
- **Important active:** `bg-amber-100 text-amber-700` / dark: `bg-amber-950 text-amber-300`
- **Inactive:** `opacity-40`

---

## Depth Strategy

**Approach: Surface color shifts + subtle borders.** No drop shadows on cards at rest. Hover gets a soft shadow.

- Borders at low opacity: `border-border/40` for cards, `border-border/50` for property dividers
- Cards slightly lighter than canvas (light mode) or slightly raised (dark mode)
- `swarm-card` class handles hover: soft shadow in light, brightened border in dark
- Semi-transparent card backgrounds for columns: `bg-card/60 dark:bg-card/40`

---

## Spacing

| Context | Value |
|---------|-------|
| Page padding | `p-12` |
| Page title area | `pt-4 pb-8` |
| Panel/sheet padding | `px-6 py-4` |
| Column header | `px-4 py-3.5` |
| Card internal | `p-4` |
| Between cards | `space-y-2` |
| Between columns | `gap-4` |
| Between sections | `mt-4` with `border-t` |
| Comment list | `space-y-6` |

---

## Border Radius

| Element | Radius |
|---------|--------|
| Base | `--radius: 0.625rem` |
| Buttons/inputs | `rounded-md` (base - 2px) |
| Cards | `rounded-xl` (base + 4px) |
| Columns/sections | `rounded-2xl` (base + 8px) |
| Agent avatars | `rounded-lg` |

---

## Component Patterns

### Page Structure

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

### Cards

```tsx
<div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card p-4 swarm-card">
```

With active shimmer:
```tsx
{active && (
  <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
    <div className="h-full w-full"
      style={{
        background: "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
        opacity: 0.5,
        animation: "swarm-shimmer 2s ease-in-out infinite",
      }}
    />
  </div>
)}
```

### Property Rows

```tsx
<div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0">
  <div className="flex items-center gap-2 text-muted-foreground w-28 shrink-0">
    <Icon className="size-4" />
    <span className="text-sm">{label}</span>
  </div>
  <div className="flex-1 min-w-0">{children}</div>
</div>
```

### Inline Editable Fields

```tsx
<input
  className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 w-full"
  onBlur={() => save(field, value)}
/>
```

Save on blur. No visible border — feels like static text until focused.

### Buttons

- Icon-only: `<Button size="icon" variant="ghost" className="size-7">`
- Muted ghost: `text-muted-foreground/40 hover:text-foreground`
- Destructive hover: `text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10`
- Reveal on hover: `opacity-0 group-hover:opacity-100 transition-opacity`

### Dropdowns

```tsx
<SelectTrigger className="h-7 w-auto gap-1.5 border-none shadow-none px-2 text-xs font-medium">
```

### Empty States

```tsx
<p className="text-sm text-muted-foreground/40 text-center py-12">
  No tasks yet
</p>
```

Simple centered text. Friendly language. No illustrations.

### Tab Navigation

```tsx
<button className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px ${
  isActive
    ? "border-foreground text-foreground font-medium"
    : "border-transparent text-muted-foreground hover:text-foreground"
}`}>
```

### Split Panel (Detail Sheets)

Left panel 540px (properties), right panel flex-1 (tabs + content). Sheet width `sm:max-w-[1000px]`.

### Messenger / Chat Panel

Comment-thread style (not phone chat). All messages left-aligned. Speaker labels shown when speaker changes. Panel width 420px.

- User messages: "You" label + `bg-muted/20 rounded-lg` container
- Agent messages: name label + plain text (no container)
- Input: `border-t border-border/50`, clean textarea `px-4 py-3`
- Send: ghost button `size-7`

---

## Icons

Lucide React exclusively. Sizes: `size-4` standard, `size-3` metadata, `size-3.5` small buttons, `size-5` page headers. Inherit color from parent.

---

## Animations

| Animation | Duration | Use |
|-----------|----------|-----|
| `swarm-shimmer` | 2s | Violet gradient sweep on active card edges |
| `pulse-soft` | 2s | Status dot pulse |
| `topbar-hue-shift` | 4s | Top bar gradient when any agent active |
| `swarm-card` hover | 0.25s | Card lift on hover |
| Collapsible open/close | 200ms/150ms | Accordion content |

All animations subtle and calming. Never aggressive.

---

## Anti-patterns

- No monospace for names, labels, or status text
- No `uppercase tracking-widest` patterns (developer aesthetic)
- No `font-bold`/`font-semibold` on headings
- No hardcoded oklch in components — use semantic tokens
- No cold grays — all neutrals warm
- No dense layouts — `p-12` pages, generous spacing
- No neon/cyberpunk colors — violet sparingly, mint for success
- No glassmorphism in light mode
- No decorative illustrations
- No modal confirmations for non-destructive actions
- No raw IDs or technical jargon in UI
- No emoji in list/compact contexts
- No abbreviations — "3 of 5 objectives" not "3/5 obj"
- No phone-chat patterns in messenger (no right-aligned bubbles, no dark send buttons)
