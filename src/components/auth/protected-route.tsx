import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { ensureActiveOrganization, useSession } from "@/lib/auth-client";
import { useAdminView } from "@/hooks/use-admin-view";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOrg?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireOrg = false,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { data: session, isPending } = useSession();
  const { isAdminView } = useAdminView();
  const [resolvingOrg, setResolvingOrg] = useState(false);
  const [orgResolved, setOrgResolved] = useState(false);
  const [hasOrgMembership, setHasOrgMembership] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!requireOrg) {
      setOrgResolved(false);
      setHasOrgMembership(null);
      return;
    }

    if (!session) {
      setOrgResolved(false);
      setHasOrgMembership(null);
      return;
    }

    if (session.session.activeOrganizationId) {
      setOrgResolved(true);
      setHasOrgMembership(true);
      return;
    }

    if (resolvingOrg) {
      return;
    }

    setResolvingOrg(true);
    setOrgResolved(false);

    (async () => {
      try {
        const result = await ensureActiveOrganization();
        if (!cancelled) {
          setHasOrgMembership(result.hasMembership);
          setOrgResolved(true);
        }
      } finally {
        if (!cancelled) {
          setResolvingOrg(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requireOrg, resolvingOrg, session]);

  if (isPending || (requireOrg && session && !session.session.activeOrganizationId && !orgResolved)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requireOrg && !session.session.activeOrganizationId) {
    return (
      <Navigate
        to={hasOrgMembership ? "/no-access?reason=no-active-org" : "/no-access?reason=no-membership"}
        replace
      />
    );
  }

  if (requireAdmin && (session.user.role !== "admin" || !isAdminView)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
