import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Building2, Mail, UserPlus } from "lucide-react";
import { authClient, ensureActiveOrganization, useSession } from "@/lib/auth-client";
import { acceptInvitation, getPublicInvitation } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function InvitePage() {
  const { invitationId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session, refetch } = useSession();
  const inviteQuery = useQuery({
    queryKey: ["public-invitation", invitationId],
    queryFn: () => getPublicInvitation(invitationId),
    enabled: Boolean(invitationId),
    retry: false,
  });
  const invite = inviteQuery.data;
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const inviteState = useMemo(() => {
    if (!invite) return null;
    if (invite.status !== "pending") return "closed";
    if (invite.isExpired) return "expired";
    if (session && session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return "mismatch";
    }
    return "valid";
  }, [invite, session]);

  async function refreshAuthState() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["organization", "members"] }),
      queryClient.invalidateQueries({ queryKey: ["organization", "invitations"] }),
      queryClient.invalidateQueries({ queryKey: ["organization", "user-invitations"] }),
    ]);
  }

  async function handleAccept() {
    if (!invite) return;

    setSubmitting(true);
    setError("");

    try {
      await acceptInvitation(invite.id);
      await ensureActiveOrganization();
      await refetch();
      await refreshAuthState();
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;

    setSubmitting(true);
    setError("");

    try {
      const { error: signUpError } = await authClient.signUp.email({
        name,
        email: invite.email,
        password,
      });

      if (signUpError) {
        throw new Error(signUpError.message ?? "Failed to create account");
      }

      await handleAccept();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
      setSubmitting(false);
    }
  }

  if (inviteQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (inviteQuery.isError || !invite) {
    return (
      <InviteShell>
        <Card>
          <CardHeader>
            <CardTitle>Invitation unavailable</CardTitle>
            <CardDescription>
              This invite link is invalid or no longer available.
            </CardDescription>
          </CardHeader>
        </Card>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted">
            <Building2 className="size-5" />
          </div>
          <CardTitle>Join {invite.organizationName}</CardTitle>
          <CardDescription>
            {invite.inviterName} invited <span className="font-medium text-foreground">{invite.email}</span>{" "}
            to HQ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{invite.role ?? "member"}</Badge>
            <span>Expires {formatDate(invite.expiresAt)}</span>
          </div>

          {inviteState === "expired" ? (
            <StatusBlock
              title="Invite expired"
              description="Ask your HQ admin to send a fresh invite link."
            />
          ) : null}

          {inviteState === "closed" ? (
            <StatusBlock
              title="Invite already processed"
              description="This invitation is no longer pending."
            />
          ) : null}

          {inviteState === "mismatch" ? (
            <StatusBlock
              title="Signed in with a different email"
              description={`This invite is for ${invite.email}. Sign in with the matching account to accept it.`}
            />
          ) : null}

          {inviteState === "valid" && session ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{session.user.email}</span>.
              </div>
              <Button onClick={handleAccept} disabled={submitting}>
                {submitting ? "Joining..." : "Accept invitation"}
              </Button>
            </div>
          ) : null}

          {inviteState === "valid" && !session && invite.hasExistingAccount ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                An account already exists for <span className="font-medium text-foreground">{invite.email}</span>.
                Sign in first, then accept the invitation.
              </div>
              <Button asChild>
                <Link
                  to={`/app/login?redirectTo=${encodeURIComponent(`/app/invite/${invite.id}`)}`}
                >
                  Sign in to accept
                </Link>
              </Button>
            </div>
          ) : null}

          {inviteState === "valid" && !session && !invite.hasExistingAccount ? (
            <form className="space-y-4" onSubmit={handleCreateAccount}>
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                This email does not have an HQ account yet. Create it here and the invite will be accepted immediately.
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="invite-email" value={invite.email} readOnly className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password">Password</Label>
                <Input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" disabled={submitting}>
                <UserPlus className="mr-2 size-4" />
                {submitting ? "Creating account..." : "Create account and join"}
              </Button>
            </form>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      {children}
    </div>
  );
}

function StatusBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed p-4">
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
