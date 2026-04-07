import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("bin/twenty exposes top-level help", async () => {
  const projectDir = path.resolve(import.meta.dirname, "..");
  const twentyBin = path.join(projectDir, "bin", "twenty");
  const { stdout } = await execFileAsync(twentyBin, ["help"], {
    cwd: projectDir,
    env: process.env,
  });

  assert.match(stdout, /twenty auth set --base-url <url> --token <token>/);
  assert.match(stdout, /twenty schema operations/);
  assert.match(stdout, /twenty people list/);
});
