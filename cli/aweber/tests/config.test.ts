import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_PUBLIC_REDIRECT_URI,
  readConfig,
  redactAweberConfig,
  resolveAweberConfig,
  saveAweberAuthConfig,
  saveAweberContext,
  saveAweberPendingAuth,
  saveAweberTokens,
} from "../src/core/config.ts";

test("saveAweberAuthConfig persists auth config and resolves defaults", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "aweber-cli-config-"));
  process.env.AWEBER_CONFIG_PATH = path.join(tempDir, "config.json");
  delete process.env.AWEBER_CLIENT_ID;
  delete process.env.AWEBER_CLIENT_SECRET;
  delete process.env.AWEBER_REDIRECT_URI;
  delete process.env.AWEBER_CLIENT_TYPE;
  delete process.env.AWEBER_SCOPES;

  await saveAweberAuthConfig({
    clientId: "client-id",
    clientType: "public",
  });

  const saved = await readConfig();
  const resolved = resolveAweberConfig(saved);
  const rawFile = await readFile(process.env.AWEBER_CONFIG_PATH, "utf8");

  assert.equal(resolved.clientId, "client-id");
  assert.equal(resolved.redirectUri, DEFAULT_PUBLIC_REDIRECT_URI);
  assert.match(rawFile, /client-id/);
});

test("environment variables override stored config and context", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "aweber-cli-config-"));
  process.env.AWEBER_CONFIG_PATH = path.join(tempDir, "config.json");

  await saveAweberAuthConfig({
    clientId: "stored-client-id",
    clientSecret: "stored-secret",
    clientType: "confidential",
    redirectUri: "https://stored.example.com/callback",
  });
  await saveAweberContext({
    accountId: "123",
    listId: "456",
  });

  process.env.AWEBER_CLIENT_ID = "env-client-id";
  process.env.AWEBER_CLIENT_SECRET = "env-secret";
  process.env.AWEBER_ACCOUNT_ID = "999";
  process.env.AWEBER_LIST_ID = "888";

  const resolved = resolveAweberConfig(await readConfig());

  assert.equal(resolved.clientId, "env-client-id");
  assert.equal(resolved.clientSecret, "env-secret");
  assert.equal(resolved.context.accountId, "999");
  assert.equal(resolved.context.listId, "888");
});

test("tokens and pending auth are persisted and redacted", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "aweber-cli-config-"));
  process.env.AWEBER_CONFIG_PATH = path.join(tempDir, "config.json");

  await saveAweberAuthConfig({
    clientId: "client-id",
    clientType: "public",
  });
  await saveAweberTokens({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenType: "bearer",
    expiryDate: "2099-01-01T00:00:00.000Z",
  });
  await saveAweberPendingAuth({
    state: "pending-state",
    scopes: ["account.read"],
    codeVerifier: "code-verifier",
    createdAt: "2026-03-17T00:00:00.000Z",
  });

  const saved = await readConfig();
  const redacted = redactAweberConfig(saved.provider);

  assert.equal(saved.provider?.tokens?.accessToken, "access-token");
  assert.equal(saved.provider?.pendingAuth?.state, "pending-state");
  assert.equal((redacted.tokens as { accessToken: string | null }).accessToken, "********");
});
