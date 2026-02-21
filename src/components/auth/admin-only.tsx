import { useSession } from "@/lib/auth-client";

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  if (!session || session.user.role !== "admin") {
    return null;
  }

  return <>{children}</>;
}
