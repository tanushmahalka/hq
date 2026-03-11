import { X } from "lucide-react";
import { ApprovalCard } from "@/components/approvals/approval-card";
import { Button } from "@/components/ui/button";
import { useApprovals } from "@/hooks/use-approvals";

export function ApprovalsPanel({ onClose }: { onClose: () => void }) {
  const { approvals, pendingCount } = useApprovals();

  return (
    <div className="flex h-[360px] flex-col border-t border-border/30 bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/20 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
            Approvals
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/30 tabular-nums">
            {pendingCount}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground/30 hover:text-foreground"
          onClick={onClose}
          title="Close"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {approvals.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground/40">
            No pending approvals.
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
