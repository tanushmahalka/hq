import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageContent } from "@/components/messenger/message-content";
import { cn } from "@/lib/utils";
import { parseTaskIdFromApprovalSession, useApprovals, type PendingApproval } from "@/hooks/use-approvals";

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function ApprovalCard({
  approval,
  className,
}: {
  approval: PendingApproval;
  className?: string;
}) {
  const { resolveApproval, isResolving } = useApprovals();
  const [feedback, setFeedback] = useState("");
  const resolving = isResolving(approval.id);
  const taskId = parseTaskIdFromApprovalSession(approval.request.sessionKey);
  const hasFeedback = feedback.trim().length > 0;

  const handleResolve = async (decision: "approve" | "deny") => {
    try {
      await resolveApproval({
        id: approval.id,
        decision,
        feedback,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve approval.");
    }
  };

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <CardHeader className="gap-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm leading-snug">{approval.request.title}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/70">
              <Badge variant="secondary" className="text-[10px]">
                pending
              </Badge>
              {taskId ? (
                <Badge variant="outline" className="text-[10px]">
                  task:{taskId}
                </Badge>
              ) : null}
              {approval.request.agentId ? (
                <Badge variant="outline" className="text-[10px]">
                  {approval.request.agentId}
                </Badge>
              ) : null}
              <span className="font-mono">{formatTimestamp(approval.createdAtMs)}</span>
            </div>
          </div>
          <span className="max-w-[180px] truncate text-[10px] font-mono text-muted-foreground/50">
            {approval.id}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 border-t border-border/40 px-4 py-4">
        <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-sm leading-relaxed">
          <MessageContent text={approval.request.body} />
        </div>

        <div className="text-[11px] text-muted-foreground/60">
          <span className="font-medium text-foreground/70">Session:</span>{" "}
          <span className="font-mono break-all">{approval.request.sessionKey}</span>
        </div>

        <Textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Optional feedback for the agent"
          className="min-h-24 resize-y bg-background"
          disabled={resolving}
        />
      </CardContent>

      <CardFooter className="justify-end gap-2 border-t border-border/40 px-4 py-3">
        <Button
          variant="outline"
          onClick={() => void handleResolve("deny")}
          disabled={resolving}
        >
          {hasFeedback ? "Deny with Feedback" : "Deny"}
        </Button>
        <Button onClick={() => void handleResolve("approve")} disabled={resolving}>
          {hasFeedback ? "Allow with Feedback" : "Allow"}
        </Button>
      </CardFooter>
    </Card>
  );
}
