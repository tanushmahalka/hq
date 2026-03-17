import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("bin/framer exposes top-level help", async () => {
  const projectDir = path.resolve(import.meta.dirname, "..");
  const framerBin = path.join(projectDir, "bin", "framer");
  const { stdout } = await execFileAsync(framerBin, ["help"], {
    cwd: projectDir,
    env: process.env,
  });

  assert.match(stdout, /framer project info/);
  assert.match(stdout, /framer text set --page <\/path> --name <layer-name> --value <text>/);
  assert.match(stdout, /framer cms update --collection <name-or-id>/);
});
