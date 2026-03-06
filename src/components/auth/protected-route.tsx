import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { authClient, useSession } from "@/lib/auth-client";
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

  useEffect(() => {
    let cancelled = false;

    if (!requireOrg || !session || session.session.activeOrganizationId || resolvingOrg) {
      return;
    }

    setResolvingOrg(true);

    (async () => {
      try {
        const { data: orgs } = await authClient.organization.list();
        if (!cancelled && orgs && orgs.length > 0) {
          await authClient.organization.setActive({
            organizationId: orgs[0].id,
          });
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

  if (isPending || resolvingOrg) {
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
    return <Navigate to="/no-access" replace />;
  }

  if (requireAdmin && (session.user.role !== "admin" || !isAdminView)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
