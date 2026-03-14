import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import type { EventFrame } from "@/lib/gateway-client";
import { useGateway } from "./use-gateway";
import {
  ApprovalsContext,
  type ApprovalDecision,
  type ApprovalsContextValue,
  type PendingApproval,
} from "./use-approvals";

type ApprovalListPayload = {
  approvals?: PendingApproval[];
};

function upsertApproval(
  current: Record<string, PendingApproval>,
  approval: PendingApproval,
): Record<string, PendingApproval> {
  return {
    ...current,
    [approval.id]: approval,
  };
}

function omitRecord<T extends Record<string, unknown>>(current: T, id: string): T {
  const next = { ...current };
  delete next[id];
  return next;
}

export function ApprovalProvider({ children }: { children: ReactNode }) {
  const { client, connected, subscribe } = useGateway();
  const [approvalsById, setApprovalsById] = useState<Record<string, PendingApproval>>({});
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [resolvingIds, setResolvingIds] = useState<Record<string, boolean>>({});
  const resolveMutation = trpc.approval.resolve.useMutation();

  const reloadApprovals = useCallback(() => {
    if (!client || !connected) {
      return Promise.resolve();
    }
    return client
      .request<ApprovalListPayload>("approval.list", {})
      .then((result) => {
        const next: Record<string, PendingApproval> = {};
        for (const approval of result.approvals ?? []) {
          next[approval.id] = approval;
        }
        setApprovalsById(next);
      })
      .catch(() => {});
  }, [client, connected]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    let stale = false;
    void reloadApprovals().then(() => {
      if (stale) {
        return;
      }
    });
    const intervalId = window.setInterval(() => {
      if (stale) {
        return;
      }
      void reloadApprovals();
    }, 5000);
    return () => {
      stale = true;
      window.clearInterval(intervalId);
    };
  }, [connected, reloadApprovals]);

  useEffect(() => {
    return subscribe((evt: EventFrame) => {
      if (evt.event === "approval.requested") {
        const approval = evt.payload as PendingApproval | undefined;
        if (!approval?.id) {
          return;
        }
        setApprovalsById((current) => upsertApproval(current, approval));
        return;
      }
      if (evt.event === "approval.resolved") {
        const approval = evt.payload as PendingApproval | undefined;
        if (!approval?.id) {
          return;
        }
        setApprovalsById((current) => omitRecord(current, approval.id));
        setResolvingIds((current) => omitRecord(current, approval.id));
      }
    });
  }, [subscribe]);

  const resolveApproval = useCallback(
    async (input: { id: string; decision: ApprovalDecision; feedback?: string }) => {
      setResolvingIds((current) => ({ ...current, [input.id]: true }));
      try {
        await resolveMutation.mutateAsync({
          id: input.id,
          decision: input.decision,
          feedback: input.feedback?.trim() || undefined,
        });
        setApprovalsById((current) => omitRecord(current, input.id));
      } finally {
        setResolvingIds((current) => omitRecord(current, input.id));
      }
    },
    [resolveMutation],
  );

  const toggleApprovals = useCallback(() => {
    setApprovalsOpen((open) => !open);
  }, []);

  const isResolving = useCallback((id: string) => Boolean(resolvingIds[id]), [resolvingIds]);

  const approvals = useMemo(
    () => Object.values(approvalsById).sort((a, b) => a.createdAtMs - b.createdAtMs),
    [approvalsById],
  );

  const value = useMemo<ApprovalsContextValue>(
    () => ({
      approvals,
      pendingCount: approvals.length,
      approvalsOpen,
      setApprovalsOpen,
      toggleApprovals,
      resolveApproval,
      isResolving,
    }),
    [approvals, approvalsOpen, toggleApprovals, resolveApproval, isResolving],
  );

  return <ApprovalsContext.Provider value={value}>{children}</ApprovalsContext.Provider>;
}
