import assert from "node:assert/strict";
import test from "node:test";

import { GoogleSearchConsoleClient } from "../src/providers/google/search-console.ts";

test("GoogleSearchConsoleClient paginates through all query rows", async () => {
  const requests: number[] = [];
  const client = new GoogleSearchConsoleClient({
    config: {
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://app.example.com/callback",
      applicationType: "web",
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      tokens: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        scope: ["https://www.googleapis.com/auth/webmasters.readonly"],
        expiryDate: "2099-01-01T00:00:00.000Z",
      },
    },
    fetchImpl: async (_input, init) => {
      const payload = JSON.parse(String(init?.body));
      requests.push(payload.startRow);

      if (payload.startRow === 0) {
        return jsonResponse({
          rows: [
            { keys: ["keyword one"], clicks: 10, impressions: 100, ctr: 0.1, position: 3.2 },
            { keys: ["keyword two"], clicks: 4, impressions: 80, ctr: 0.05, position: 7.1 },
          ],
        });
      }

      return jsonResponse({
        rows: [{ keys: ["keyword three"], clicks: 1, impressions: 20, ctr: 0.05, position: 9.8 }],
      });
    },
  });

  const result = await client.listAllQueryKeywords({
    siteUrl: "sc-domain:example.com",
    startDate: "2026-03-01",
    endDate: "2026-03-10",
    pageSize: 2,
  });

  assert.deepEqual(requests, [0, 2]);
  assert.equal(result.totalRows, 3);
  assert.equal(result.pageCount, 2);
  assert.equal(result.rows[2]?.query, "keyword three");
});

test("GoogleSearchConsoleClient refreshes expired tokens before querying", async () => {
  const persistedTokens: string[] = [];
  const seenAuthHeaders: string[] = [];
  const client = new GoogleSearchConsoleClient({
    config: {
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://app.example.com/callback",
      applicationType: "web",
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      tokens: {
        accessToken: "expired-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        scope: ["https://www.googleapis.com/auth/webmasters.readonly"],
        expiryDate: "2020-01-01T00:00:00.000Z",
      },
    },
    persistTokens: async (tokens) => {
      persistedTokens.push(tokens.accessToken);
    },
    fetchImpl: async (input, init) => {
      if (String(input) === "https://oauth2.googleapis.com/token") {
        return jsonResponse({
          access_token: "fresh-token",
          token_type: "Bearer",
          expires_in: 3600,
        });
      }

      seenAuthHeaders.push(String((init?.headers as Record<string, string>).Authorization));
      return jsonResponse({
        rows: [{ keys: ["keyword one"], clicks: 2, impressions: 20, ctr: 0.1, position: 5 }],
      });
    },
  });

  const result = await client.listAllQueryKeywords({
    siteUrl: "sc-domain:example.com",
    startDate: "2026-03-01",
    endDate: "2026-03-10",
  });

  assert.equal(result.totalRows, 1);
  assert.deepEqual(persistedTokens, ["fresh-token"]);
  assert.deepEqual(seenAuthHeaders, ["Bearer fresh-token"]);
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
