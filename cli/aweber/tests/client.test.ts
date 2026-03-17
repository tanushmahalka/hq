import assert from "node:assert/strict";
import test from "node:test";

import { AweberClient } from "../src/providers/aweber/client.ts";

test("AweberClient refreshes expired tokens before requesting", async () => {
  const persistedTokens: string[] = [];
  const seenAuthHeaders: string[] = [];

  const client = new AweberClient({
    config: {
      clientId: "client-id",
      clientSecret: "client-secret",
      clientType: "confidential",
      redirectUri: "https://app.example.com/callback",
      scopes: ["account.read"],
      tokens: {
        accessToken: "expired-token",
        refreshToken: "refresh-token",
        tokenType: "bearer",
        expiryDate: "2020-01-01T00:00:00.000Z",
      },
      context: {},
    },
    persistTokens: async (tokens) => {
      persistedTokens.push(tokens.accessToken ?? "");
    },
    fetchImpl: async (input, init) => {
      if (String(input) === "https://auth.aweber.com/oauth2/token") {
        return jsonResponse({
          access_token: "fresh-token",
          token_type: "bearer",
          expires_in: 3600,
        });
      }

      seenAuthHeaders.push(String((init?.headers as Record<string, string>).Authorization));
      return jsonResponse({
        entries: [{ id: 1 }],
      });
    },
  });

  const response = await client.request<{ entries: Array<{ id: number }> }>({
    path: "/accounts",
  });

  assert.equal(response.data.entries[0]?.id, 1);
  assert.deepEqual(persistedTokens, ["fresh-token"]);
  assert.deepEqual(seenAuthHeaders, ["Bearer fresh-token"]);
});

test("AweberClient sends form and beta requests correctly", async () => {
  const requests: Array<{ input: string; contentType: string | undefined; body: string }> = [];

  const client = new AweberClient({
    config: {
      clientId: "client-id",
      clientType: "public",
      redirectUri: "urn:ietf:wg:oauth:2.0:oob",
      scopes: ["email.read"],
      tokens: {
        accessToken: "access-token",
        tokenType: "bearer",
        expiryDate: "2099-01-01T00:00:00.000Z",
      },
      context: {},
    },
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        contentType: (init?.headers as Record<string, string>)["Content-Type"],
        body: String(init?.body ?? ""),
      });
      return jsonResponse([{ url: "https://example.com", unique: 2, total: 3, type: "click" }]);
    },
  });

  await client.request({
    method: "POST",
    path: "/accounts/1/lists/2/broadcasts",
    form: { subject: "Hi" },
  });

  await client.request({
    path: "/analytics/reports/broadcasts-links",
    version: "beta",
    query: {
      account_id: "uuid-account",
      broadcast_id: "uuid-broadcast",
      filter: "clicks",
    },
  });

  assert.match(requests[0]!.input, /https:\/\/api\.aweber\.com\/1\.0\/accounts\/1\/lists\/2\/broadcasts/);
  assert.equal(requests[0]!.contentType, "application/x-www-form-urlencoded");
  assert.match(requests[0]!.body, /subject=Hi/);
  assert.match(requests[1]!.input, /https:\/\/api\.aweber\.com\/2\.0-beta\/analytics\/reports\/broadcasts-links/);
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
