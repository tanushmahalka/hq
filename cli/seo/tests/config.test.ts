import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  readConfig,
  resolveDataForSeoConfig,
  saveDataForSeoConfig,
} from "../src/core/config.ts";

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
