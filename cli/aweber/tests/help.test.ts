import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("bin/aweber exposes top-level help", async () => {
  const projectDir = path.resolve(import.meta.dirname, "..");
  const aweberBin = path.join(projectDir, "bin", "aweber");
  const { stdout } = await execFileAsync(aweberBin, ["help"], {
    cwd: projectDir,
    env: process.env,
  });

  assert.match(stdout, /aweber auth set --client-id <id>/);
  assert.match(stdout, /aweber subscribers add --email <email>/);
  assert.match(stdout, /aweber broadcasts schedule --broadcast-id <id>/);
});
