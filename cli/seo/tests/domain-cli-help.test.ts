import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("bin/seo exposes domain rating help on the CLI", async () => {
  const projectDir = path.resolve(import.meta.dirname, "..");
  const seoBin = path.join(projectDir, "bin", "seo");
  const { stdout } = await execFileAsync(seoBin, ["domain", "rating", "--help"], {
    cwd: projectDir,
    env: process.env,
  });

  assert.match(stdout, /seo domain rating \(\-\-domain <domain> \| \-\-file <path\|->\)/);
  assert.match(stdout, /--scale <100\|1000>/);
});

test("bin/seo exposes domain spam-score help on the CLI", async () => {
  const projectDir = path.resolve(import.meta.dirname, "..");
  const seoBin = path.join(projectDir, "bin", "seo");
  const { stdout } = await execFileAsync(seoBin, ["domain", "spam-score", "--help"], {
    cwd: projectDir,
    env: process.env,
  });

  assert.match(stdout, /seo domain spam-score \(\-\-domain <domain> \| \-\-file <path\|->\)/);
  assert.match(stdout, /Text or JSON file with domains/);
  assert.match(stdout, /seo domain spam-score sync-db/);
});

test("bin/seo exposes domain spam-score sync-db help on the CLI", async () => {
  const projectDir = path.resolve(import.meta.dirname, "..");
  const seoBin = path.join(projectDir, "bin", "seo");
  const { stdout } = await execFileAsync(seoBin, ["domain", "spam-score", "sync-db", "--help"], {
    cwd: projectDir,
    env: process.env,
  });

  assert.match(stdout, /table: competitor_backlink_sources/);
  assert.match(stdout, /--dry-run/);
});
