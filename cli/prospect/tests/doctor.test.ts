import assert from "node:assert/strict";
import test from "node:test";

import { runDoctorCommand } from "../src/commands/doctor.ts";

test("doctor reports cloudflared availability in json mode", async () => {
  const output = await captureStdout(async () => {
    await runDoctorCommand(["--json"], {
      platformImpl: () => "darwin",
      execFileImpl: async (command: string, args: readonly string[]) => {
        if (command === "sh" && args.join(" ") === "-lc command -v cloudflared") {
          return { stdout: "/opt/homebrew/bin/cloudflared\n", stderr: "" };
        }
        if (command === "cloudflared" && args[0] === "--version") {
          return { stdout: "cloudflared version 2024.11.1\n", stderr: "" };
        }
        throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
      },
    });
  });

  const parsed = JSON.parse(output) as {
    ok: boolean;
    checks: { cloudflared: { installed: boolean; path?: string; version?: string } };
  };
  assert.equal(parsed.ok, true);
  assert.equal(parsed.checks.cloudflared.installed, true);
  assert.equal(parsed.checks.cloudflared.path, "/opt/homebrew/bin/cloudflared");
  assert.match(parsed.checks.cloudflared.version ?? "", /cloudflared version/i);
});

test("doctor --fix uses brew on mac when cloudflared is missing", async () => {
  let installed = false;

  const output = await captureStdout(async () => {
    await runDoctorCommand(["--fix", "--json"], {
      platformImpl: () => "darwin",
      execFileImpl: async (command: string, args: readonly string[]) => {
        if (command === "sh" && args.join(" ") === "-lc command -v cloudflared") {
          if (!installed) {
            throw new Error("missing");
          }
          return { stdout: "/opt/homebrew/bin/cloudflared\n", stderr: "" };
        }
        if (command === "brew" && args.join(" ") === "install cloudflared") {
          installed = true;
          return { stdout: "installed\n", stderr: "" };
        }
        if (command === "cloudflared" && args[0] === "--version") {
          return { stdout: "cloudflared version 2024.11.1\n", stderr: "" };
        }
        throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
      },
    });
  });

  const parsed = JSON.parse(output) as {
    ok: boolean;
    checks: {
      cloudflared: { installed: boolean };
      fix?: { attempted: boolean; strategy: string; ok: boolean };
    };
  };

  assert.equal(parsed.ok, true);
  assert.equal(parsed.checks.cloudflared.installed, true);
  assert.equal(parsed.checks.fix?.attempted, true);
  assert.equal(parsed.checks.fix?.strategy, "homebrew");
  assert.equal(parsed.checks.fix?.ok, true);
});

async function captureStdout(run: () => Promise<void>): Promise<string> {
  let output = "";
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
    output += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    const done = typeof encoding === "function" ? encoding : callback;
    done?.(null);
    return true;
  }) as typeof process.stdout.write;

  try {
    await run();
    return output;
  } finally {
    process.stdout.write = originalWrite;
  }
}
