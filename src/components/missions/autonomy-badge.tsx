import { cn } from "@/lib/utils";
import type { AutonomyLevel } from "@shared/custom/types";
import { AUTONOMY_LEVEL_LABELS } from "@shared/custom/types";

const AUTONOMY_COLORS: Record<AutonomyLevel, string> = {
  notify: "bg-gray-400/15 text-gray-400",
  suggest: "bg-blue-400/15 text-blue-400",
  "act-and-report": "bg-amber-400/15 text-amber-400",
  "full-auto": "bg-[var(--swarm-violet)]/15 text-[var(--swarm-violet)]",
};

export function AutonomyBadge({
  level,
  className,
}: {
  level: AutonomyLevel;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        AUTONOMY_COLORS[level],
        className
      )}
    >
      {AUTONOMY_LEVEL_LABELS[level]}
    </span>
  );
}
