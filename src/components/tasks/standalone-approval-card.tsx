import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApprovals, type PendingApproval } from "@/hooks/use-approvals";
import { ShieldAlert } from "lucide-react";

function getPreviewText(markdown: string): string {
  return markdown
    .replace(/[`*_>#-]/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function StandaloneApprovalCard({
  approval,
  onOpen,
}: {
  approval: PendingApproval;
  onOpen: () => void;
}) {
  const { resolveApproval, isResolving } = useApprovals();
  const [decision, setDecision] = useState<"approve" | "deny" | null>(null);
  const resolving = isResolving(approval.id);

  const handleResolve = async (nextDecision: "approve" | "deny") => {
    setDecision(nextDecision);
    try {
      await resolveApproval({
        id: approval.id,
        decision: nextDecision,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve approval.");
    } finally {
      setDecision(null);
    }
  };

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 transition-colors hover:border-amber-500/35"
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-amber-500/15 p-1.5 text-amber-700 dark:text-amber-300">
          <ShieldAlert className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-medium leading-snug">{approval.request.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/70">
                <Badge variant="secondary" className="bg-amber-500/15 text-[10px] text-amber-800 dark:text-amber-200">
                  pending approval
                </Badge>
                {approval.request.agentId ? (
                  <Badge variant="outline" className="text-[10px]">
                    {approval.request.agentId}
                  </Badge>
                ) : null}
                <span className="font-mono">{formatTimestamp(approval.createdAtMs)}</span>
              </div>
            </div>
            <span className="max-w-[120px] truncate text-[10px] font-mono text-muted-foreground/45">
              {approval.id}
            </span>
          </div>

          <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-muted-foreground">
            {getPreviewText(approval.request.body)}
          </p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground/75"
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
            >
              Review
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={resolving}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleResolve("deny");
                }}
              >
                {decision === "deny" ? "Denying..." : "Deny"}
              </Button>
              <Button
                size="sm"
                disabled={resolving}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleResolve("approve");
                }}
              >
                {decision === "approve" ? "Approving..." : "Approve"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
