import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, MailPlus, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveMemberRole, useOrganizationInvitations, useOrganizationMembers } from "@/hooks/use-organization";
import { cancelInvitation, inviteMember } from "@/lib/auth-api";
import { useSession } from "@/lib/auth-client";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function TeamPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const roleQuery = useActiveMemberRole(Boolean(session));
  const membersQuery = useOrganizationMembers(roleQuery.data?.role === "admin");
  const invitationsQuery = useOrganizationInvitations(roleQuery.data?.role === "admin");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const pendingInvites = (invitationsQuery.data ?? []).filter(
    (invite) => invite.status === "pending"
  );

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const invitation = await inviteMember({ email, role });
      const inviteUrl = `${window.location.origin}/invite/${invitation.id}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedId(invitation.id);
      setNotice(`Invite link copied. Only ${invitation.email} can use it to create an account.`);
      setEmail("");
      setRole("member");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organization", "members"] }),
        queryClient.invalidateQueries({ queryKey: ["organization", "invitations"] }),
      ]);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy(invitationId: string) {
    const inviteUrl = `${window.location.origin}/invite/${invitationId}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedId(invitationId);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleCancel(invitationId: string) {
    setCancellingId(invitationId);
    setError("");
    setNotice("");

    try {
      await cancelInvitation(invitationId);
      await queryClient.invalidateQueries({ queryKey: ["organization", "invitations"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel invite");
    } finally {
      setCancellingId(null);
    }
  }

  if (roleQuery.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (roleQuery.data?.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Team management is restricted</CardTitle>
            <CardDescription>
              Only organization admins can invite or manage members.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-12">
      <div>
        <h1 className="text-3xl font-semibold">Team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Invite people into this HQ deployment and track the current organization roster.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <MailPlus className="size-5" />
            </div>
            <div>
              <CardTitle>Invite a teammate</CardTitle>
              <CardDescription>
                Access is invite-only. Invite links are bound to the email you enter.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_180px_auto]" onSubmit={handleInvite}>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                {submitting ? "Copying..." : "Copy invite link"}
              </Button>
            </div>
          </form>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="mt-3 text-sm text-muted-foreground">{notice}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                <Users className="size-5" />
              </div>
              <div>
                <CardTitle>Members</CardTitle>
                <CardDescription>
                  {membersQuery.data?.total ?? 0} active people in this organization.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(membersQuery.data?.members ?? []).map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-sm font-medium">{member.user.name}</div>
                  <div className="text-xs text-muted-foreground">{member.user.email}</div>
                </div>
                <Badge variant="outline">{member.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
            <CardDescription>
              Open invitations stay valid until they expire or are revoked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No pending invitations.
              </div>
            ) : (
              pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{invite.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Expires {formatDate(invite.expiresAt)}
                      </div>
                    </div>
                    <Badge variant="outline">{invite.role}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(invite.id)}
                    >
                      <Copy className="mr-2 size-4" />
                      {copiedId === invite.id ? "Copied" : "Copy invite link"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={cancellingId === invite.id}
                      onClick={() => handleCancel(invite.id)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      {cancellingId === invite.id ? "Revoking..." : "Revoke"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
