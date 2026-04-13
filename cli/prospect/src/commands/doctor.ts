import { execFile } from "node:child_process";
import { platform } from "node:os";
import { promisify } from "node:util";

import { getBooleanFlag, parseArgs } from "../core/args.ts";
import { CliError } from "../core/errors.ts";
import { printJson, printLine } from "../core/output.ts";

const execFileAsync = promisify(execFile);

const DOCTOR_SCHEMA = {
  "--fix": "boolean",
  "--json": "boolean",
  "--help": "boolean",
} as const;

export async function runDoctorCommand(
  argv: string[],
  dependencies: {
    execFileImpl?: typeof execFileAsync;
    platformImpl?: () => NodeJS.Platform;
  } = {},
): Promise<void> {
  const parsed = parseArgs(argv, DOCTOR_SCHEMA);
  if (getBooleanFlag(parsed, "--help")) {
    printHelp();
    return;
  }

  const exec = dependencies.execFileImpl ?? execFileAsync;
  const platformName = (dependencies.platformImpl ?? platform)();
  const checks = await collectDoctorChecks(exec, platformName);

  if (getBooleanFlag(parsed, "--fix") && !checks.cloudflared.installed) {
    const fix = await installCloudflared(exec, platformName);
    checks.cloudflared = await collectCloudflaredStatus(exec);
    checks.fix = fix;
  }

  const payload = {
    ok: checks.cloudflared.installed,
    platform: platformName,
    checks,
  };

  if (getBooleanFlag(parsed, "--json")) {
    printJson(payload);
    return;
  }

  printDoctorHuman(payload);
}

async function collectDoctorChecks(
  exec: typeof execFileAsync,
  platformName: NodeJS.Platform,
): Promise<{
  cloudflared: { installed: boolean; path?: string; version?: string; waitReady: boolean };
  waitFlow: { ready: boolean; reason?: string };
  fix?: { attempted: boolean; strategy: string; ok: boolean; output?: string };
}> {
  const cloudflared = await collectCloudflaredStatus(exec);
  return {
    cloudflared: {
      ...cloudflared,
      waitReady: cloudflared.installed,
    },
    waitFlow: cloudflared.installed
      ? { ready: true }
      : {
          ready: false,
          reason: missingCloudflaredReason(platformName),
        },
  };
}

async function collectCloudflaredStatus(exec: typeof execFileAsync): Promise<{
  installed: boolean;
  path?: string;
  version?: string;
}> {
  try {
    const whichResult = await exec("sh", ["-lc", "command -v cloudflared"]);
    const path = whichResult.stdout.trim() || undefined;
    const versionResult = await exec("cloudflared", ["--version"]);
    return {
      installed: true,
      path,
      version: firstNonEmptyLine(versionResult.stdout),
    };
  } catch {
    return {
      installed: false,
    };
  }
}

async function installCloudflared(
  exec: typeof execFileAsync,
  platformName: NodeJS.Platform,
): Promise<{ attempted: boolean; strategy: string; ok: boolean; output?: string }> {
  if (platformName === "darwin") {
    const output = await runInstall(exec, "homebrew", "brew", ["install", "cloudflared"]);
    return output;
  }

  if (platformName === "linux") {
    const aptExists = await commandExists(exec, "apt-get");
    if (aptExists) {
      return await runInstall(exec, "apt", "sh", [
        "-lc",
        [
          "set -e",
          "if ! command -v curl >/dev/null 2>&1; then echo 'curl is required'; exit 1; fi",
          "if ! command -v gpg >/dev/null 2>&1; then echo 'gpg is required'; exit 1; fi",
          "if ! command -v sudo >/dev/null 2>&1; then echo 'sudo is required'; exit 1; fi",
          "curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg",
          "echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null",
          "sudo apt-get update",
          "sudo apt-get install -y cloudflared",
        ].join(" && "),
      ]);
    }

    return {
      attempted: false,
      strategy: "linux-manual",
      ok: false,
      output: "Automatic install is only supported on Linux systems with apt-get right now.",
    };
  }

  return {
    attempted: false,
    strategy: `${platformName}-manual`,
    ok: false,
    output: `Automatic cloudflared install is not supported on ${platformName}.`,
  };
}

async function runInstall(
  exec: typeof execFileAsync,
  strategy: string,
  command: string,
  args: string[],
): Promise<{ attempted: boolean; strategy: string; ok: boolean; output?: string }> {
  try {
    const result = await exec(command, args);
    return {
      attempted: true,
      strategy,
      ok: true,
      output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim() || undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      attempted: true,
      strategy,
      ok: false,
      output: message,
    };
  }
}

async function commandExists(exec: typeof execFileAsync, command: string): Promise<boolean> {
  try {
    await exec("sh", ["-lc", `command -v ${command}`]);
    return true;
  } catch {
    return false;
  }
}

function printDoctorHuman(payload: {
  ok: boolean;
  platform: string;
  checks: {
    cloudflared: { installed: boolean; path?: string; version?: string; waitReady: boolean };
    waitFlow: { ready: boolean; reason?: string };
    fix?: { attempted: boolean; strategy: string; ok: boolean; output?: string };
  };
}): void {
  printLine("Prospect doctor");
  printLine("");
  printLine(`Platform: ${payload.platform}`);
  printLine(`cloudflared: ${payload.checks.cloudflared.installed ? "installed" : "missing"}`);
  if (payload.checks.cloudflared.path) {
    printLine(`cloudflared path: ${payload.checks.cloudflared.path}`);
  }
  if (payload.checks.cloudflared.version) {
    printLine(`cloudflared version: ${payload.checks.cloudflared.version}`);
  }
  printLine(`Apollo wait flow: ${payload.checks.waitFlow.ready ? "ready" : "not ready"}`);
  if (payload.checks.waitFlow.reason) {
    printLine(`reason: ${payload.checks.waitFlow.reason}`);
  }
  if (payload.checks.fix) {
    printLine("");
    printLine(`fix strategy: ${payload.checks.fix.strategy}`);
    printLine(`fix result: ${payload.checks.fix.ok ? "success" : "failed"}`);
    if (payload.checks.fix.output) {
      printLine(payload.checks.fix.output);
    }
  }
}

function printHelp(): void {
  printLine("Prospect doctor");
  printLine("");
  printLine("Usage:");
  printLine("  prospect doctor [--json]");
  printLine("  prospect doctor --fix [--json]");
  printLine("");
  printLine("Checks whether local dependencies like cloudflared are available for Apollo async webhook waits.");
}

function firstNonEmptyLine(value: string): string | undefined {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
}

function missingCloudflaredReason(platformName: NodeJS.Platform): string {
  if (platformName === "darwin") {
    return "Install cloudflared or run `prospect doctor --fix` to enable Apollo --wait flows.";
  }

  if (platformName === "linux") {
    return "Install cloudflared or run `prospect doctor --fix` on apt-based systems to enable Apollo --wait flows.";
  }

  return "Install cloudflared to enable Apollo --wait flows.";
}
