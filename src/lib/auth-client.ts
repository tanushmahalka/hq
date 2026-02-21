import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [organizationClient(), adminClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
