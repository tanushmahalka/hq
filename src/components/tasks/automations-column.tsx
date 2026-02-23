import { useState } from "react";
import { ChevronRight, Timer } from "lucide-react";
import { useCron, type CronJob } from "@/hooks/use-cron";
import { useGateway, type Agent } from "@/hooks/use-gateway";
import { useSession } from "@/lib/auth-client";
import { useAdminView } from "@/hooks/use-admin-view";
import { CronDetailSheet } from "./cron-detail-sheet";

// --- Human-readable cron parsing ---

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatTime(hour: string, minute: string): string {
  const h = parseInt(hour, 10);
  const m = minute.padStart(2, "0");
  if (h === 0) return `12:${m} AM`;
  if (h < 12) return `${h}:${m} AM`;
  if (h === 12) return `12:${m} PM`;
  return `${h - 12}:${m} PM`;
}

function parseCronExpr(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Every minute
  if (
    minute === "*" &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return "Every minute";
  }

  // Every N minutes: */N * * * *
  if (
    minute.startsWith("*/") &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    const n = parseInt(minute.slice(2), 10);
    if (n === 1) return "Every minute";
    return `Every ${n} minutes`;
  }

  // Every hour at :MM
  if (
    minute !== "*" &&
    !minute.includes("/") &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return `Every hour at :${minute.padStart(2, "0")}`;
  }

  // Every N hours: 0 */N * * *
  if (
    hour.startsWith("*/") &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    const n = parseInt(hour.slice(2), 10);
    if (n === 1) return "Every hour";
    return `Every ${n} hours`;
  }

  // Specific time, figure out frequency
  const hasTime =
    minute !== "*" &&
    hour !== "*" &&
    !minute.includes("/") &&
    !hour.includes("/");

  if (hasTime) {
    const time = formatTime(hour, minute);

    // Daily: M H * * *
    if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
      return `Daily at ${time}`;
    }

    // Specific weekdays: M H * * 1-5 or M H * * 1,3,5
    if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
      if (dayOfWeek === "1-5" || dayOfWeek === "MON-FRI")
        return `Weekdays at ${time}`;
      if (dayOfWeek === "0,6" || dayOfWeek === "SAT,SUN")
        return `Weekends at ${time}`;
      const days = dayOfWeek.split(",").map((d) => {
        const n = parseInt(d, 10);
        return isNaN(n) ? d : (DAYS[n] ?? d);
      });
      if (days.length === 1) return `Every ${days[0]} at ${time}`;
      return `${days.join(", ")} at ${time}`;
    }

    // Monthly: M H D * *
    if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
      const suffix =
        dayOfMonth === "1"
          ? "st"
          : dayOfMonth === "2"
            ? "nd"
            : dayOfMonth === "3"
              ? "rd"
              : "th";
      return `Monthly on the ${dayOfMonth}${suffix} at ${time}`;
    }

    // Yearly: M H D Mo *
    if (dayOfMonth !== "*" && month !== "*" && dayOfWeek === "*") {
      const mo = parseInt(month, 10);
      const monthName = isNaN(mo) ? month : (MONTHS[mo - 1] ?? month);
      return `${monthName} ${dayOfMonth} at ${time}`;
    }
  }

  return expr;
}

function formatSchedule(schedule: unknown): string {
  if (!schedule || typeof schedule === "string") return String(schedule || "—");
  if (typeof schedule === "object" && schedule !== null) {
    const s = schedule as Record<string, unknown>;
    if (s.expr) return parseCronExpr(String(s.expr));
    if (s.everyMs) {
      const sec = Math.round(Number(s.everyMs) / 1000);
      if (sec < 60) return `Every ${sec}s`;
      if (sec < 3600) return `Every ${Math.round(sec / 60)} min`;
      return `Every ${Math.round(sec / 3600)}h`;
    }
    if (s.at) return `Once at ${new Date(String(s.at)).toLocaleString()}`;
    if (s.kind) return String(s.kind);
  }
  return "—";
}

// --- Relative time ---

function formatNextRun(nextRunAtMs?: number): string | null {
  if (!nextRunAtMs) return null;
  const diff = nextRunAtMs - Date.now();
  if (diff < 0) return "overdue";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "< 1m";
  const hrs = Math.floor(mins / 60);
  if (hrs < 1) return `${mins}m`;
  const days = Math.floor(hrs / 24);
  if (days < 1) return `${hrs}h ${mins % 60}m`;
  return `${days}d ${hrs % 24}h`;
}

// --- Components ---

function CronCard({
  job,
  agents,
  isAdmin,
  onClick,
}: {
  job: CronJob;
  agents: Agent[];
  isAdmin: boolean;
  onClick: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const label = job.name || job.id;
  const schedule = formatSchedule(job.schedule);
  const hasRun = !!job.state?.lastRunAtMs;
  const nextRunLabel =
    job.enabled !== false ? formatNextRun(job.state?.nextRunAtMs) : null;
  const agent = job.agentId ? agents.find((a) => a.id === job.agentId) : null;
  const rawName = agent?.name ?? agent?.identity?.name ?? job.agentId;
  // Parse "Name ( Role )" format into separate parts
  const nameMatch = rawName?.match(/^(.+?)\s*\(\s*(.+?)\s*\)$/);
  const agentName = nameMatch ? nameMatch[1].trim() : rawName;
  const agentRole = nameMatch ? nameMatch[2] : null;

  return (
    <div
      className="group relative overflow-hidden rounded-lg border border-border/40 bg-card p-3.5 swarm-card cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug line-clamp-2">
          {label}
        </span>
        <div
          className="mt-0.5 size-2 shrink-0 rounded-full"
          style={{
            backgroundColor:
              job.enabled === false
                ? "var(--muted-foreground)"
                : hasRun
                  ? "var(--swarm-mint)"
                  : "currentColor",
          }}
          title={
            job.enabled === false
              ? "Disabled"
              : hasRun
                ? "Ran successfully"
                : "Never run"
          }
        />
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground/70 truncate">
        {schedule}
      </p>

      {nextRunLabel && (
        <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/40">
          next in {nextRunLabel}
        </p>
      )}

      {agentName && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-muted-foreground/60">
            {agentName}
          </span>
          {agentRole && (
            <span className="text-[10px] font-mono text-muted-foreground/40 rounded-full border border-border/50 px-1.5 py-px leading-tight">
              {agentRole}
            </span>
          )}
        </div>
      )}

      {isAdmin && (
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setShowRaw(!showRaw);
          }}
        >
          <ChevronRight
            className={`size-3 transition-transform ${showRaw ? "rotate-90" : ""}`}
          />
          raw
        </button>
      )}
      {showRaw && (
        <pre className="mt-1 text-[10px] font-mono text-muted-foreground/40 bg-muted/30 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
          {JSON.stringify(job, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AutomationsColumn() {
  const { jobs, isLoading } = useCron();
  const { agents } = useGateway();
  const { data: session } = useSession();
  const { isAdminView } = useAdminView();
  const isAdmin = session?.user.role === "admin" && isAdminView;
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);

  return (
    <>
      <div className="flex flex-col min-w-[280px] flex-1 rounded-xl border border-[var(--swarm-violet-dim)] bg-card/50 dark:swarm-glass">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <Timer className="size-4 text-[var(--swarm-violet)]" />
          <h2 className="text-sm font-normal text-foreground">Automations</h2>
          <span className="font-mono text-[11px] text-muted-foreground/60 tabular-nums">
            {isLoading ? "—" : jobs.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
          {isLoading ? (
            <p className="text-xs text-muted-foreground/50 text-center py-8">
              Loading...
            </p>
          ) : jobs.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 text-center py-8">
              No automations
            </p>
          ) : (
            jobs.map((job) => (
              <CronCard
                key={job.id}
                job={job}
                agents={agents}
                isAdmin={isAdmin}
                onClick={() => setSelectedJob(job)}
              />
            ))
          )}
        </div>
      </div>

      <CronDetailSheet
        job={selectedJob}
        agents={agents}
        onClose={() => setSelectedJob(null)}
      />
    </>
  );
}
