import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { getConfigPath, readConfig, resolveTwentyConfig, saveAuthConfig } from "../src/core/config.ts";

test("auth config respects TWENTY_CONFIG_PATH and env overrides", async () => {
  const configDir = await mkdtemp(path.join(tmpdir(), "twenty-config-"));
  const configPath = path.join(configDir, "config.json");
  process.env.TWENTY_CONFIG_PATH = configPath;

  await saveAuthConfig({
    baseUrl: "https://example.com/rest/",
    token: "stored-token",
    timeoutMs: 5000,
  });

  const raw = await readFile(configPath, "utf8");
  assert.match(raw, /stored-token/);

  process.env.TWENTY_TOKEN = "env-token";
  const resolved = resolveTwentyConfig(await readConfig());
  assert.equal(getConfigPath(), configPath);
  assert.equal(resolved.token, "env-token");

  delete process.env.TWENTY_TOKEN;
  delete process.env.TWENTY_CONFIG_PATH;
});
