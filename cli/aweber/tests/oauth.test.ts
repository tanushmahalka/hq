import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  parseOAuthCallback,
  refreshAccessToken,
  revokeToken,
} from "../src/providers/aweber/oauth.ts";

test("buildAuthorizationUrl adds PKCE for public clients", () => {
  const result = buildAuthorizationUrl({
    config: {
      clientId: "client-id",
      clientType: "public",
      redirectUri: "urn:ietf:wg:oauth:2.0:oob",
      scopes: ["account.read", "list.read"],
      tokens: {},
      context: {},
    },
    state: "fixed-state",
  });

  const url = new URL(result.url);
  assert.equal(url.origin, "https://auth.aweber.com");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("state"), "fixed-state");
  assert.equal(url.searchParams.get("scope"), "account.read list.read");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(result.codeVerifier);
});

test("buildAuthorizationUrl skips PKCE for confidential clients", () => {
  const result = buildAuthorizationUrl({
    config: {
      clientId: "client-id",
      clientSecret: "client-secret",
      clientType: "confidential",
      redirectUri: "https://app.example.com/callback",
      scopes: ["account.read"],
      tokens: {},
      context: {},
    },
    state: "fixed-state",
  });

  const url = new URL(result.url);
  assert.equal(url.searchParams.get("code_challenge"), null);
  assert.equal(result.codeVerifier, undefined);
});

test("parseOAuthCallback extracts callback fields", () => {
  const parsed = parseOAuthCallback("https://app.example.com/callback?code=abc123&state=state-123");
  assert.equal(parsed.code, "abc123");
  assert.equal(parsed.state, "state-123");
});

test("exchangeAuthorizationCode sends PKCE verifier for public clients", async () => {
  const tokens = await exchangeAuthorizationCode(
    {
      config: {
        clientId: "client-id",
        clientType: "public",
        redirectUri: "urn:ietf:wg:oauth:2.0:oob",
        scopes: ["account.read"],
        tokens: {},
        context: {},
      },
      code: "auth-code",
      codeVerifier: "verifier",
    },
    async (input, init) => {
      assert.equal(String(input), "https://auth.aweber.com/oauth2/token");
      assert.equal(init?.method, "POST");
      const body = String(init?.body);
      assert.match(body, /grant_type=authorization_code/);
      assert.match(body, /code=auth-code/);
      assert.match(body, /code_verifier=verifier/);
      assert.equal((init?.headers as Record<string, string>)["Content-Type"], "application/x-www-form-urlencoded");

      return jsonResponse({
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_type: "bearer",
        expires_in: 3600,
      });
    },
  );

  assert.equal(tokens.accessToken, "access-token");
  assert.equal(tokens.refreshToken, "refresh-token");
});

test("refreshAccessToken uses basic auth for confidential clients", async () => {
  const tokens = await refreshAccessToken(
    {
      config: {
        clientId: "client-id",
        clientSecret: "client-secret",
        clientType: "confidential",
        redirectUri: "https://app.example.com/callback",
        scopes: ["account.read"],
        tokens: {
          refreshToken: "stored-refresh",
        },
        context: {},
      },
    },
    async (_input, init) => {
      const headers = init?.headers as Record<string, string>;
      assert.match(headers.Authorization, /^Basic /);
      assert.match(String(init?.body), /refresh_token=stored-refresh/);

      return jsonResponse({
        access_token: "fresh-token",
        token_type: "bearer",
        expires_in: 7200,
      });
    },
  );

  assert.equal(tokens.accessToken, "fresh-token");
  assert.equal(tokens.refreshToken, "stored-refresh");
});

test("revokeToken includes the selected token hint", async () => {
  let called = false;

  await revokeToken(
    {
      config: {
        clientId: "client-id",
        clientType: "public",
        redirectUri: "urn:ietf:wg:oauth:2.0:oob",
        scopes: ["account.read"],
        tokens: {},
        context: {},
      },
      token: "access-token",
      tokenTypeHint: "access_token",
    },
    async (_input, init) => {
      called = true;
      assert.match(String(init?.body), /token=access-token/);
      assert.match(String(init?.body), /token_type_hint=access_token/);
      return new Response(null, { status: 200 });
    },
  );

  assert.equal(called, true);
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
