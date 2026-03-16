import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  readConfig,
  resolveGoogleOAuthConfig,
  resolveDataForSeoConfig,
  saveDataForSeoConfig,
  saveGoogleOAuthConfig,
  saveGoogleOAuthTokens,
} from "../src/core/config.ts";
import { buildGoogleOAuthLoginUrl } from "../src/providers/google/oauth.ts";

test("saveDataForSeoConfig persists config and resolves it", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "seo-cli-config-"));
  process.env.SEO_CLI_CONFIG_PATH = path.join(tempDir, "config.json");
  delete process.env.DATAFORSEO_LOGIN;
  delete process.env.DATAFORSEO_PASSWORD;
  delete process.env.DATAFORSEO_BASE_URL;

  await saveDataForSeoConfig({
    login: "test-login",
    password: "test-password",
    baseUrl: "https://api.dataforseo.com",
  });

  const saved = await readConfig();
  const resolved = resolveDataForSeoConfig(saved);
  const rawFile = await readFile(process.env.SEO_CLI_CONFIG_PATH, "utf8");

  assert.equal(saved.providers?.dataforseo?.login, "test-login");
  assert.equal(resolved.login, "test-login");
  assert.equal(resolved.password, "test-password");
  assert.match(rawFile, /test-login/);
  assert.match(rawFile, /test-password/);
});

test("environment variables override stored provider config", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "seo-cli-config-"));
  process.env.SEO_CLI_CONFIG_PATH = path.join(tempDir, "config.json");

  await saveDataForSeoConfig({
    login: "stored-login",
    password: "stored-password",
    baseUrl: "https://api.dataforseo.com",
  });

  process.env.DATAFORSEO_LOGIN = "env-login";
  process.env.DATAFORSEO_PASSWORD = "env-password";
  process.env.DATAFORSEO_BASE_URL = "https://custom.dataforseo.test";

  const resolved = resolveDataForSeoConfig(await readConfig());

  assert.equal(resolved.login, "env-login");
  assert.equal(resolved.password, "env-password");
  assert.equal(resolved.baseUrl, "https://custom.dataforseo.test");
});

test("saveGoogleOAuthConfig persists config and resolves it", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "seo-cli-config-"));
  process.env.SEO_CLI_CONFIG_PATH = path.join(tempDir, "config.json");
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  delete process.env.GOOGLE_OAUTH_APPLICATION_TYPE;
  delete process.env.GOOGLE_OAUTH_SCOPES;

  await saveGoogleOAuthConfig({
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
    redirectUri: "https://localhost/oauth/google/callback",
    applicationType: "web",
    scopes: ["scope:a", "scope:b"],
  });

  const saved = await readConfig();
  const resolved = resolveGoogleOAuthConfig(saved);
  const rawFile = await readFile(process.env.SEO_CLI_CONFIG_PATH, "utf8");

  assert.equal(saved.providers?.google?.clientId, "google-client-id");
  assert.equal(resolved.clientId, "google-client-id");
  assert.equal(resolved.clientSecret, "google-client-secret");
  assert.equal(resolved.redirectUri, "https://localhost/oauth/google/callback");
  assert.deepEqual(resolved.scopes, ["scope:a", "scope:b"]);
  assert.match(rawFile, /google-client-id/);
  assert.match(rawFile, /google-client-secret/);
});

test("buildGoogleOAuthLoginUrl creates a consent URL with stored defaults", () => {
  const result = buildGoogleOAuthLoginUrl({
    config: {
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      redirectUri: "https://localhost/oauth/google/callback",
      applicationType: "web",
      scopes: ["scope:a", "scope:b"],
    },
    state: "fixed-state",
    prompt: "consent",
  });

  const url = new URL(result.url);

  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("client_id"), "google-client-id");
  assert.equal(url.searchParams.get("redirect_uri"), "https://localhost/oauth/google/callback");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "scope:a scope:b");
  assert.equal(url.searchParams.get("state"), "fixed-state");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("access_type"), "offline");
});

test("saveGoogleOAuthTokens stores OAuth tokens in config", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "seo-cli-config-"));
  process.env.SEO_CLI_CONFIG_PATH = path.join(tempDir, "config.json");

  await saveGoogleOAuthConfig({
    clientId: "google-client-id",
    applicationType: "limited-input-device",
  });

  await saveGoogleOAuthTokens({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenType: "Bearer",
    scope: ["scope:a"],
    expiryDate: "2026-01-01T00:00:00.000Z",
  });

  const saved = await readConfig();

  assert.equal(saved.providers?.google?.tokens?.accessToken, "access-token");
  assert.equal(saved.providers?.google?.tokens?.refreshToken, "refresh-token");
  assert.deepEqual(saved.providers?.google?.tokens?.scope, ["scope:a"]);
});
