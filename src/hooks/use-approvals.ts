import { createContext, useContext } from "react";

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

export type ApprovalsContextValue = {
  approvals: PendingApproval[];
  pendingCount: number;
  approvalsOpen: boolean;
  setApprovalsOpen: (open: boolean) => void;
  toggleApprovals: () => void;
  resolveApproval: (input: {
    id: string;
    decision: ApprovalDecision;
    feedback?: string;
  }) => Promise<void>;
  isResolving: (id: string) => boolean;
};

export const ApprovalsContext = createContext<ApprovalsContextValue | null>(null);

export function parseTaskIdFromApprovalSession(sessionKey: string): string | null {
  const match = sessionKey.match(/:task:([^:]+)/);
  return match?.[1] ?? null;
}

export function useApprovals() {
  const context = useContext(ApprovalsContext);
  if (!context) {
    throw new Error("useApprovals must be used within ApprovalProvider");
  }
  return context;
}
