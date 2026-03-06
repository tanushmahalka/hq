export interface AuthApiError {
  message?: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  inviterId: string;
}

export interface PublicInvitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string | null;
  inviterEmail: string;
  inviterName: string;
  hasExistingAccount: boolean;
  isExpired: boolean;
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & AuthApiError;
  if (!response.ok) {
    throw new Error(data.message ?? "Request failed");
  }
  return data;
}

async function authApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  return parseJson<T>(response);
}

export function getPublicInvitation(invitationId: string) {
  return authApi<PublicInvitation>(`/api/public/invitations/${invitationId}`, {
    method: "GET",
  });
}

export function getActiveMemberRole() {
  return authApi<{ role: string }>("/api/auth/organization/get-active-member-role", {
    method: "GET",
  });
}

export function listMembers() {
  return authApi<{ members: OrganizationMember[]; total: number }>(
    "/api/auth/organization/list-members",
    { method: "GET" }
  );
}

export function listInvitations() {
  return authApi<OrganizationInvitation[]>(
    "/api/auth/organization/list-invitations",
    { method: "GET" }
  );
}

export function listUserInvitations() {
  return authApi<OrganizationInvitation[]>(
    "/api/auth/organization/list-user-invitations",
    { method: "GET" }
  );
}

export function inviteMember(input: { email: string; role: string }) {
  return authApi<OrganizationInvitation>("/api/auth/organization/invite-member", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function cancelInvitation(invitationId: string) {
  return authApi<OrganizationInvitation>("/api/auth/organization/cancel-invitation", {
    method: "POST",
    body: JSON.stringify({ invitationId }),
  });
}

export function acceptInvitation(invitationId: string) {
  return authApi<{ invitation: OrganizationInvitation }>("/api/auth/organization/accept-invitation", {
    method: "POST",
    body: JSON.stringify({ invitationId }),
  });
}
