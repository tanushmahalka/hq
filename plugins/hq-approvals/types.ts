export type ApprovalDecision = "approve" | "deny";

export type PendingApproval = {
  id: string;
  request: {
    title: string;
    body: string;
    sessionKey: string;
    agentId?: string | null;
  };
  createdAtMs: number;
  resolvedAtMs?: number;
  decision?: ApprovalDecision;
  feedback?: string | null;
  resolvedBy?: string | null;
};

export type ApprovalStoreFile = {
  approvals: PendingApproval[];
};

export type ResolveApprovalInput = {
  id: string;
  decision: ApprovalDecision;
  feedback?: string | null;
  resolvedBy?: string | null;
};
