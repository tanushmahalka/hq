import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ApprovalCard } from "@/components/approvals/approval-card";
import type { PendingApproval } from "@/hooks/use-approvals";

export function StandaloneApprovalSheet({
  approval,
  onClose,
}: {
  approval: PendingApproval | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={Boolean(approval)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" showCloseButton className="w-full sm:max-w-[720px] p-0 overflow-y-auto">
        <SheetTitle className="sr-only">
          Approval details
        </SheetTitle>
        <SheetDescription className="sr-only">
          Review a pending approval and respond with approval or denial feedback.
        </SheetDescription>
        <div className="px-6 py-14">
          {approval ? <ApprovalCard approval={approval} className="border-0 shadow-none" /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
