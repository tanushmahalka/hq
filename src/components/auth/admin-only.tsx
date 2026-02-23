import { useSession } from "@/lib/auth-client";
import { useAdminView } from "@/hooks/use-admin-view";

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { isAdminView } = useAdminView();

  if (!session || session.user.role !== "admin" || !isAdminView) {
    return null;
  }

  return <>{children}</>;
}
