import { Navigate } from "react-router";
import { useSession } from "@/lib/auth-client";

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

  if (isPending) {
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
    return <Navigate to="/onboarding/create-org" replace />;
  }

  if (requireAdmin && session.user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
