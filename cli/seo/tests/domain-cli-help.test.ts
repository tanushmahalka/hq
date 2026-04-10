import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import os from "node:os";
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

test("bin/seo exposes keyword relevance classification help on the CLI", async () => {
  const projectDir = path.resolve(import.meta.dirname, "..");
  const seoBin = path.join(projectDir, "bin", "seo");
  const { stdout } = await execFileAsync(seoBin, ["keywords", "classify-relevance", "--help"], {
    cwd: projectDir,
    env: process.env,
  });

  assert.match(stdout, /seo keywords classify-relevance \(\-\-query <keyword> \| \-\-jsonl <path\|->\)/);
  assert.match(stdout, /--brand <overview>/);
  assert.match(stdout, /--concurrency <n>/);
});

test("bin/seo works when launched through a symlink", async () => {
  const projectDir = path.resolve(import.meta.dirname, "..");
  const seoBin = path.join(projectDir, "bin", "seo");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "seo-bin-link-"));
  const linkedBin = path.join(tempDir, "seo");

  try {
    await fs.symlink(seoBin, linkedBin);
    const { stdout } = await execFileAsync(linkedBin, ["--help"], {
      cwd: projectDir,
      env: process.env,
    });

    assert.match(stdout, /SEO CLI/);
    assert.match(stdout, /seo page audit --page <url>/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
