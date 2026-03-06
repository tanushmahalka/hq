import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Timer,
  Clock,
  CalendarClock,
  User,
  Power,
  Bot,
  ChevronRight,
} from "lucide-react";
import type { CronJob } from "@/hooks/use-cron";
import { useCronSessions, type CronSession } from "@/hooks/use-cron-sessions";
import { useGateway, type Agent } from "@/hooks/use-gateway";
import { SessionMessageList } from "@/components/chat/session-blocks";
import { MessageContent } from "@/components/messenger/message-content";
import { LoaderFive } from "@/components/ui/loader";

// --- Helpers ---

function formatScheduleDetail(schedule: unknown): string {
  if (!schedule) return "—";
  if (typeof schedule === "string") return schedule;
  if (typeof schedule === "object" && schedule !== null) {
    const s = schedule as Record<string, unknown>;
    if (s.expr) return String(s.expr);
    if (s.everyMs) {
      const sec = Math.round(Number(s.everyMs) / 1000);
      if (sec < 60) return `Every ${sec}s`;
      if (sec < 3600) return `Every ${Math.round(sec / 60)} min`;
      return `Every ${Math.round(sec / 3600)}h`;
    }
    if (s.at) return new Date(String(s.at)).toLocaleString();
    if (s.kind) return String(s.kind);
  }
  return "—";
}

function formatDateTimeMs(ms?: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

function extractSessionLabel(key: string): string {
  // Extract a readable label from session key like "agent:foo:cron:bar:run:123"
  const runMatch = key.match(/run:(\d+)/);
  if (runMatch) return `Run #${runMatch[1]}`;
  // Fallback: last segment
  const parts = key.split(":");
  return parts.slice(-2).join(":");
}

function extractSessionTimestamp(session: CronSession): string {
  const first = session.messages[0];
  if (!first?.timestamp) return "";
  return formatDateTimeMs(first.timestamp);
}

// --- Main Component ---

interface CronDetailSheetProps {
  job: CronJob | null;
  agents: Agent[];
  onClose: () => void;
}

export function CronDetailSheet({ job, agents, onClose }: CronDetailSheetProps) {
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  if (!job) return null;

  const agent = job.agentId ? agents.find((a) => a.id === job.agentId) : null;
  const rawName = agent?.name ?? agent?.identity?.name ?? job.agentId;
  const nameMatch = rawName?.match(/^(.+?)\s*\(\s*(.+?)\s*\)$/);
  const agentName = nameMatch ? nameMatch[1].trim() : rawName;
  const agentRole = nameMatch ? nameMatch[2] : null;
  const scheduleTzRaw =
    job.schedule && typeof job.schedule === "object"
      ? (job.schedule as Record<string, unknown>).tz
      : null;
  const scheduleTz = typeof scheduleTzRaw === "string" ? scheduleTzRaw : null;

  return (
    <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-full sm:max-w-[1000px] p-0 flex flex-row overflow-hidden gap-0"
      >
        <SheetDescription className="sr-only">
          View automation details and session history
        </SheetDescription>

        {/* Left panel: Cron properties */}
        <div className="w-[540px] shrink-0 flex flex-col overflow-y-auto border-r">
          {/* Header */}
          <div className="px-6 pt-14 pb-4">
            <div className="flex items-center gap-2.5">
              <Timer className="size-5 text-[var(--swarm-violet)]" />
              <SheetTitle className="text-2xl font-normal!">
                {job.name || job.id}
              </SheetTitle>
            </div>
          </div>

          {/* Properties */}
          <div className="px-6 space-y-0">
            <PropertyRow icon={<CalendarClock className="size-4" />} label="Schedule">
              <span className="text-sm font-mono">
                {formatScheduleDetail(job.schedule)}
              </span>
            </PropertyRow>

            {scheduleTz && (
              <PropertyRow icon={<Clock className="size-4" />} label="Timezone">
                <span className="text-sm font-mono">
                  {String(scheduleTz)}
                </span>
              </PropertyRow>
            )}

            <PropertyRow icon={<Power className="size-4" />} label="Status">
              <div className="flex items-center gap-2">
                <div
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor: job.enabled === false
                      ? "var(--muted-foreground)"
                      : "var(--swarm-mint)",
                  }}
                />
                <span className="text-sm font-mono">
                  {job.enabled === false ? "Disabled" : "Enabled"}
                </span>
              </div>
            </PropertyRow>

            {agentName && (
              <PropertyRow icon={<User className="size-4" />} label="Agent">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono">{agentName}</span>
                  {agentRole && (
                    <span className="text-[10px] font-mono text-muted-foreground/40 rounded-full border border-border/50 px-1.5 py-px leading-tight">
                      {agentRole}
                    </span>
                  )}
                </div>
              </PropertyRow>
            )}

            <PropertyRow icon={<Clock className="size-4" />} label="Last Run">
              <span className="text-sm font-mono">
                {formatDateTimeMs(job.state?.lastRunAtMs)}
              </span>
            </PropertyRow>

            <PropertyRow icon={<CalendarClock className="size-4" />} label="Next Run">
              <span className="text-sm font-mono">
                {formatDateTimeMs(job.state?.nextRunAtMs)}
              </span>
            </PropertyRow>

            {job.state?.lastStatus && (
              <PropertyRow icon={<Power className="size-4" />} label="Last Status">
                <div className="flex items-center gap-2">
                  <div
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor: job.state.lastStatus === "ok"
                        ? "var(--swarm-mint)"
                        : "var(--color-red-400)",
                    }}
                  />
                  <span className="text-sm font-mono">{job.state.lastStatus}</span>
                  {job.state.lastDurationMs != null && (
                    <span className="text-[10px] font-mono text-muted-foreground/40">
                      {(job.state.lastDurationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </PropertyRow>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />
        </div>

        {/* Right panel: Sessions */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b pt-14 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px border-foreground text-foreground font-medium">
              <Bot className="size-4" />
              Sessions
            </div>
          </div>

          {/* Session list */}
          <CronSessionList
            cronId={job.id}
            expandedSession={expandedSession}
            onToggleSession={(key) =>
              setExpandedSession((prev) => (prev === key ? null : key))
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// --- Sub-components ---

function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-2 text-muted-foreground w-28 shrink-0">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function CronSessionList({
  cronId,
  expandedSession,
  onToggleSession,
}: {
  cronId: string;
  expandedSession: string | null;
  onToggleSession: (key: string) => void;
}) {
  const { sessions, stream, isStreaming, loading, error } = useCronSessions(cronId);
  const { agents } = useGateway();
  const agentEmoji = agents[0]?.identity?.emoji;

  return (
    <div className="flex-1 overflow-y-auto">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <LoaderFive text="Loading sessions..." />
        </div>
      )}

      {!loading && sessions.length === 0 && !error && (
        <p className="text-xs text-muted-foreground/50 text-center py-8">
          No sessions found for this automation.
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive text-center py-4">{error}</p>
      )}

      <div className="divide-y divide-border/30">
        {sessions.map((session) => {
          const isExpanded = expandedSession === session.key;
          const label = extractSessionLabel(session.key);
          const timestamp = extractSessionTimestamp(session);
          const msgCount = session.messages.length;

          return (
            <div key={session.key}>
              <button
                onClick={() => onToggleSession(session.key)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
              >
                <ChevronRight
                  className={`size-3.5 text-muted-foreground/40 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono truncate">{label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/40">
                      {msgCount} msg{msgCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {timestamp && (
                    <span className="text-[10px] font-mono text-muted-foreground/30">
                      {timestamp}
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/20 bg-muted/10 max-h-[60vh] overflow-y-auto">
                  <div className="p-4 space-y-3">
                    {session.messages.length === 0 && (
                      <p className="text-xs text-muted-foreground/50 text-center py-4">
                        Empty session.
                      </p>
                    )}
                    <SessionMessageList messages={session.messages} agentEmoji={agentEmoji} />
                    {isStreaming && expandedSession === session.key && stream && (
                      <div className="flex gap-2.5">
                        <div className="size-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[9px]">{agentEmoji ?? "🤖"}</span>
                        </div>
                        <div className="flex-1 min-w-0 text-sm text-muted-foreground leading-relaxed">
                          <MessageContent text={stream} />
                          <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-foreground/40 animate-pulse" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
