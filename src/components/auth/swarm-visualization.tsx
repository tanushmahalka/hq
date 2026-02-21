import { useEffect, useRef, useState, useMemo } from "react";

const BAR_COUNT = 20;
const TICK_MS = 500;

const MOCK_AGENTS = [
  { name: "PR Outreach", emoji: "📣", role: "Communications" },
  { name: "SEO Writer", emoji: "✍️", role: "Content" },
  { name: "Social Media", emoji: "📱", role: "Distribution" },
  { name: "Analytics", emoji: "📊", role: "Intelligence" },
  { name: "Email Campaigns", emoji: "📧", role: "Marketing" },
  { name: "Content Review", emoji: "🔍", role: "Quality" },
  { name: "Media Monitor", emoji: "📡", role: "Monitoring" },
  { name: "Brand Voice", emoji: "🎙️", role: "Branding" },
  { name: "Link Builder", emoji: "🔗", role: "SEO" },
  { name: "Ad Optimizer", emoji: "📈", role: "Performance" },
  { name: "CRM Sync", emoji: "🔄", role: "Operations" },
  { name: "Report Builder", emoji: "📋", role: "Analytics" },
  { name: "Scheduler", emoji: "🗓️", role: "Planning" },
  { name: "Trend Scout", emoji: "🔮", role: "Research" },
  { name: "Video Editor", emoji: "🎬", role: "Creative" },
  { name: "Copy Editor", emoji: "📝", role: "Content" },
  { name: "Influencer Mgr", emoji: "🤝", role: "Partnerships" },
  { name: "Event Planner", emoji: "🎪", role: "Events" },
  { name: "Crisis Handler", emoji: "🛡️", role: "Risk" },
  { name: "Pitch Writer", emoji: "💼", role: "Sales" },
  { name: "Data Scraper", emoji: "🕷️", role: "Acquisition" },
  { name: "Translator", emoji: "🌐", role: "Localization" },
  { name: "Design Review", emoji: "🎨", role: "Creative" },
  { name: "Compliance", emoji: "⚖️", role: "Legal" },
];

// Depth layers — cards get assigned a depth which controls scale, blur, and opacity
// 0 = far background (blurry, tiny), 1 = mid, 2 = foreground (crisp)
type DepthConfig = {
  scale: number;
  blur: number;
  opacity: number;
};

const DEPTHS: DepthConfig[] = [
  { scale: 0.65, blur: 6, opacity: 0.25 },  // far
  { scale: 0.8, blur: 3, opacity: 0.45 },   // mid
  { scale: 1, blur: 0, opacity: 0.85 },      // near — crisp
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

type AgentState = {
  bars: number[];
  active: boolean;
  activityChance: number;
};

type CardPlacement = {
  depth: number;
  x: number;      // percentage from left
  y: number;      // percentage from top
  rotate: number;  // subtle tilt in degrees
};

export function SwarmVisualization() {
  const [agents, setAgents] = useState<AgentState[]>(() =>
    MOCK_AGENTS.map((_, i) => {
      const rng = seededRandom(i * 7919);
      return {
        bars: Array.from({ length: BAR_COUNT }, () => (rng() > 0.7 ? 1 : 0)),
        active: rng() > 0.6,
        activityChance: 0.15 + rng() * 0.35,
      };
    })
  );

  // Stable card placements — scattered across the panel
  const placements = useMemo<CardPlacement[]>(() => {
    const rng = seededRandom(42);
    return MOCK_AGENTS.map((_, i) => {
      // Distribute depth: ~40% far, ~35% mid, ~25% near
      const depthRoll = rng();
      const depth = depthRoll < 0.4 ? 0 : depthRoll < 0.75 ? 1 : 2;

      // Grid-ish placement with jitter to avoid perfect rows
      const cols = 4;
      const rows = Math.ceil(MOCK_AGENTS.length / cols);
      const col = i % cols;
      const row = Math.floor(i / cols);

      const cellW = 100 / cols;
      const cellH = 100 / rows;

      return {
        depth,
        x: col * cellW + rng() * cellW * 0.5 + cellW * 0.1,
        y: row * cellH + rng() * cellH * 0.4 + cellH * 0.1,
        rotate: (rng() - 0.5) * 4,
      };
    });
  }, []);

  // Tick: shift bars, randomly activate
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((agent) => {
          const firing = Math.random() < agent.activityChance;
          const newBars = [...agent.bars.slice(1), firing ? 1 : 0];
          return {
            ...agent,
            bars: newBars,
            active: firing || newBars.slice(-3).some((b) => b > 0),
          };
        })
      );
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: "oklch(0.09 0.005 270)" }}
    >
      {/* Ambient gradient glow — violet center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, oklch(0.15 0.03 280 / 60%) 0%, transparent 65%)",
        }}
      />

      {/* Cards scattered at varying depths */}
      <div className="absolute inset-0">
        {MOCK_AGENTS.map((mock, i) => {
          const p = placements[i];
          const d = DEPTHS[p.depth];

          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: `scale(${d.scale}) rotate(${p.rotate}deg)`,
                filter: d.blur > 0 ? `blur(${d.blur}px)` : undefined,
                opacity: d.opacity,
                width: "200px",
                zIndex: p.depth,
                transition: "opacity 0.5s",
              }}
            >
              <MockAgentCard
                name={mock.name}
                emoji={mock.emoji}
                role={mock.role}
                bars={agents[i].bars}
                active={agents[i].active}
                index={i}
              />
            </div>
          );
        })}
      </div>

      {/* Top edge fade */}
      <div
        className="absolute inset-x-0 top-0 h-24 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, oklch(0.09 0.005 270), transparent)",
        }}
      />

      {/* Bottom edge fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{
          background: "linear-gradient(to top, oklch(0.09 0.005 270), transparent)",
        }}
      />

      {/* Left edge fade — blends into the form panel */}
      <div
        className="absolute inset-y-0 left-0 w-20 pointer-events-none"
        style={{
          background: "linear-gradient(to right, oklch(0.09 0.005 270), transparent)",
        }}
      />
    </div>
  );
}

function MockAgentCard({
  name,
  emoji,
  role,
  bars,
  active,
  index,
}: {
  name: string;
  emoji: string;
  role: string;
  bars: number[];
  active: boolean;
  index: number;
}) {
  const heightsRef = useRef<number[]>([]);
  if (heightsRef.current.length === 0) {
    const rng = seededRandom(index * 3571);
    heightsRef.current = Array.from({ length: BAR_COUNT }, () => 55 + rng() * 45);
  }
  const idleRef = useRef<number[]>([]);
  if (idleRef.current.length === 0) {
    const rng = seededRandom(index * 9311);
    idleRef.current = Array.from({ length: BAR_COUNT }, () => 6 + rng() * 14);
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-3 transition-colors duration-500 ${
        active
          ? "border-white/[0.08] bg-white/[0.03]"
          : "border-white/[0.04] bg-white/[0.015]"
      }`}
    >
      {/* Shimmer */}
      {active && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, oklch(0.65 0.18 280) 50%, transparent 100%)",
              opacity: 0.4,
              animation: "swarm-shimmer 2s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs">{emoji}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-mono text-white/60 truncate block">
            {name}
          </span>
        </div>
        {active && (
          <div className="relative flex size-1.5 shrink-0">
            <div className="absolute inline-flex h-full w-full rounded-full bg-[oklch(0.65_0.18_280)] opacity-75 animate-pulse" />
            <div className="relative inline-flex size-1.5 rounded-full bg-[oklch(0.65_0.18_280)]" />
          </div>
        )}
      </div>

      {/* Role */}
      <span className="text-[9px] uppercase tracking-wider text-white/15 block mb-2">
        {role}
      </span>

      {/* Bars */}
      <div className="flex items-end gap-[2px] h-[24px]">
        {bars.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-[1px] transition-all duration-300"
            style={{
              height: value > 0
                ? `${heightsRef.current[i]}%`
                : `${idleRef.current[i]}%`,
              backgroundColor: value > 0
                ? "oklch(0.65 0.18 280)"
                : "rgba(255, 255, 255, 0.04)",
              opacity: value > 0 ? 0.75 : 0.5,
              boxShadow: value > 0
                ? "0 0 4px oklch(0.65 0.18 280 / 15%)"
                : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
