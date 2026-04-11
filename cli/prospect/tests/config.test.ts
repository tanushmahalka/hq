import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { readConfig, resolveConfig, saveProviderConfig } from "../src/core/config.ts";

test("environment variables override stored prospect config", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "prospect-cli-config-"));
  process.env.PROSPECT_CONFIG_PATH = path.join(tempDir, "config.json");

  await saveProviderConfig("apollo", {
    apiKey: "stored-key",
    baseUrl: "https://stored.apollo.test",
  });

  process.env.APOLLO_API_KEY = "env-key";
  process.env.APOLLO_BASE_URL = "https://env.apollo.test";

  const resolved = resolveConfig(await readConfig());
  assert.equal(resolved.providers.apollo.apiKey, "env-key");
  assert.equal(resolved.providers.apollo.baseUrl, "https://env.apollo.test");

  delete process.env.APOLLO_API_KEY;
  delete process.env.APOLLO_BASE_URL;
  delete process.env.PROSPECT_CONFIG_PATH;
});
