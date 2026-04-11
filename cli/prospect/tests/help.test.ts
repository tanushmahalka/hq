import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("bin/prospect exposes top-level help", async () => {
  const projectDir = path.resolve(import.meta.dirname, "..");
  const binPath = path.join(projectDir, "bin", "prospect");
  const { stdout } = await execFileAsync(binPath, ["help"], {
    cwd: projectDir,
    env: process.env,
  });

  assert.match(stdout, /prospect find person --email <email>/);
  assert.match(stdout, /prospect apollo find person --email <email>/);
  assert.match(stdout, /prospect apollo list people --query 'person_titles\[]=/);
  assert.match(stdout, /prospect apollo api --method GET --path \/api\/v1\/auth\/health/);
});
