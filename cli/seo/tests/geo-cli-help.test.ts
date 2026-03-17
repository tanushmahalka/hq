import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("bin/seo exposes geo help on the CLI", async () => {
  const projectDir = path.resolve(import.meta.dirname, "..");
  const seoBin = path.join(projectDir, "bin", "seo");
  const { stdout } = await execFileAsync(seoBin, ["geo", "--help"], {
    cwd: projectDir,
    env: process.env,
  });

  assert.match(stdout, /seo geo brand-visibility --domain <domain>/);
  assert.match(stdout, /seo geo prompt-audit --prompt <text> --domain <domain>/);
});
