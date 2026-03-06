import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [organizationClient(), adminClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;

export async function ensureActiveOrganization() {
  const sessionResult = await authClient.getSession();
  if (sessionResult.data?.session.activeOrganizationId) {
    return {
      activeOrganizationId: sessionResult.data.session.activeOrganizationId,
      hasMembership: true,
    };
  }

  const { data: organizations } = await authClient.organization.list();
  if (!organizations || organizations.length === 0) {
    return {
      activeOrganizationId: null,
      hasMembership: false,
    };
  }

  await authClient.organization.setActive({
    organizationId: organizations[0].id,
  });

  const refreshedSession = await authClient.getSession();
  return {
    activeOrganizationId:
      refreshedSession.data?.session.activeOrganizationId ?? organizations[0].id,
    hasMembership: true,
  };
}
