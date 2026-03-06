import { Link, useSearchParams } from "react-router";
import { Mail, ShieldAlert, UserX } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useUserInvitations } from "@/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function NoAccess() {
  const { data: session } = useSession();
  const [searchParams] = useSearchParams();
  const invitations = useUserInvitations(Boolean(session));
  const pendingInvites = (invitations.data ?? []).filter(
    (invite) => invite.status === "pending"
  );
  const reason = searchParams.get("reason");
  const hasPendingInvites = pendingInvites.length > 0;

  const heading =
    reason === "no-active-org"
      ? "Organization not activated"
      : hasPendingInvites
        ? "Invite pending"
        : "Not authorized";

  const description =
    reason === "no-active-org"
      ? "You are signed in, but HQ could not activate your organization automatically."
      : hasPendingInvites
        ? "Your account is signed in, but access is still waiting on an invitation flow to complete."
        : "This account does not currently have access to this HQ deployment.";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-muted">
            {hasPendingInvites ? (
              <ShieldAlert className="size-5" />
            ) : (
              <UserX className="size-5" />
            )}
          </div>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Ask your HQ admin to send or confirm the invite for{" "}
            <span className="font-medium text-foreground">
              {session?.user.email ?? "your email"}
            </span>
            . Invite links remain locked to the exact invited email address.
          </div>

          {pendingInvites.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">Pending invitations</div>
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{invite.email}</span>
                      <Badge variant="outline">{invite.role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDate(invite.expiresAt)}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link to={`/app/invite/${invite.id}`}>Open invite</Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button asChild variant="outline">
              <Link to="/app/login">Back to login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
