import { randomBytes } from "node:crypto";
import * as process from "node:process";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  password,
  select,
  text,
} from "@clack/prompts";

type SetupAction = "start" | "exit";

type SetupDraft = {
  organizationWebsite: string;
  appUrl: string;
  allowedOrigins: string;
  databaseUrl: string;
  betterAuthSecret: string;
  organizationName: string;
  organizationSlug: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isLikelyUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isLikelyPostgresUrl(value: string): boolean {
  return /^(postgres|postgresql):\/\//.test(value.trim());
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function generateSecret(): string {
  return randomBytes(24).toString("base64url");
}

async function promptOrCancel(
  prompt: Promise<string | symbol>,
  message = "Setup cancelled."
): Promise<string> {
  const value = await prompt;
  if (isCancel(value)) {
    cancel(message);
    process.exit(0);
  }
  return String(value);
}

async function confirmOrCancel(
  prompt: Promise<boolean | symbol>,
  message = "Setup cancelled."
): Promise<boolean> {
  const value = await prompt;
  if (isCancel(value)) {
    cancel(message);
    process.exit(0);
  }
  return Boolean(value);
}

function printSetupSummary(draft: SetupDraft): void {
  log.info("Collected setup details:");
  process.stdout.write(`  Org website: ${draft.organizationWebsite}\n`);
  process.stdout.write(`  App URL: ${draft.appUrl}\n`);
  process.stdout.write(`  Allowed origins: ${draft.allowedOrigins}\n`);
  process.stdout.write(`  Database URL: ${draft.databaseUrl}\n`);
  process.stdout.write(`  Better Auth secret: ${draft.betterAuthSecret}\n`);
  process.stdout.write(`  Org name: ${draft.organizationName}\n`);
  process.stdout.write(`  Org slug: ${draft.organizationSlug}\n`);
  process.stdout.write(`  Admin name: ${draft.adminName}\n`);
  process.stdout.write(`  Admin email: ${draft.adminEmail}\n`);
  process.stdout.write(
    `  Admin password: ${"*".repeat(Math.max(8, draft.adminPassword.length))}\n`
  );
}

async function collectSetupDraft(): Promise<SetupDraft> {
  const organizationWebsite = await promptOrCancel(
    text({
      message: "What is your organization website?",
      placeholder: "https://acme.com",
      validate(value) {
        if (!isLikelyUrl(value)) {
          return "Enter a valid http or https URL.";
        }
      },
    })
  );

  const appUrl = await promptOrCancel(
    text({
      message: "What URL will HQ run on?",
      initialValue: organizationWebsite,
      placeholder: "https://hq.acme.com",
      validate(value) {
        if (!isLikelyUrl(value)) {
          return "Enter a valid http or https URL.";
        }
      },
    })
  );

  const databaseUrl = await promptOrCancel(
    text({
      message: "What is your database URL?",
      placeholder: "postgresql://postgres:postgres@127.0.0.1:5432/hq",
      validate(value) {
        if (!isLikelyPostgresUrl(value)) {
          return "Enter a valid postgres:// or postgresql:// URL.";
        }
      },
    })
  );

  const generatedAuthSecret = generateSecret();
  const betterAuthSecret = await promptOrCancel(
    text({
      message: "Better Auth secret",
      initialValue: generatedAuthSecret,
      validate(value) {
        if (!isNonEmpty(value)) {
          return "Enter a secret or accept the generated value.";
        }
        if (value.trim().length < 24) {
          return "Use at least 24 characters for the auth secret.";
        }
      },
    })
  );

  log.message(
    "Better Auth secret is used to sign auth sessions and tokens. Allowed origins will match the app URL for now."
  );

  const organizationName = await promptOrCancel(
    text({
      message: "What is your organization name?",
      placeholder: "Acme Inc",
      validate(value) {
        if (!isNonEmpty(value)) {
          return "Enter an organization name.";
        }
      },
    })
  );

  const organizationSlug = await promptOrCancel(
    text({
      message: "Organization slug",
      initialValue: slugify(organizationName),
      placeholder: "acme-inc",
      validate(value) {
        if (!isNonEmpty(value)) {
          return "Enter an organization slug.";
        }
        if (slugify(value) !== value.trim()) {
          return "Use lowercase letters, numbers, and hyphens only.";
        }
      },
    })
  );

  const useSlug = await confirmOrCancel(
    confirm({
      message: `Use "${organizationSlug}" as the organization slug?`,
      initialValue: true,
    })
  );

  if (!useSlug) {
    cancel("Setup cancelled so you can revisit the slug choice.");
    process.exit(0);
  }

  const adminName = await promptOrCancel(
    text({
      message: "Admin full name",
      placeholder: "Jane Admin",
      validate(value) {
        if (!isNonEmpty(value)) {
          return "Enter the admin name.";
        }
      },
    })
  );

  const adminEmail = await promptOrCancel(
    text({
      message: "Admin email",
      placeholder: "owner@acme.com",
      validate(value) {
        if (!isLikelyEmail(value)) {
          return "Enter a valid email address.";
        }
      },
    })
  );

  const adminPassword = await promptOrCancel(
    password({
      message: "Admin password",
      mask: "*",
      validate(value) {
        if (!isNonEmpty(value)) {
          return "Enter the admin password.";
        }
        if (value.length < 8) {
          return "Use at least 8 characters.";
        }
      },
    })
  );

  return {
    organizationWebsite,
    appUrl,
    allowedOrigins: appUrl,
    databaseUrl,
    betterAuthSecret,
    organizationName,
    organizationSlug,
    adminName,
    adminEmail,
    adminPassword,
  };
}

async function runSetupCommand(): Promise<void> {
  intro("HQ Setup");
  log.message(
    "We'll guide this machine through HQ setup, starting with a quick interactive installer."
  );

  const action = await select<SetupAction>({
    message: "What would you like to do?",
    options: [
      {
        value: "start",
        label: "Start setup",
        hint: "Begin the guided installer",
      },
      {
        value: "exit",
        label: "Exit",
        hint: "Leave setup for now",
      },
    ],
  });

  if (isCancel(action) || action === "exit") {
    cancel("Setup cancelled.");
    return;
  }

  const draft = await collectSetupDraft();
  printSetupSummary(draft);
  outro("Setup draft captured. No files were written and no commands were run yet.");
}

function printHelp(): void {
  process.stdout.write("HQ CLI\n\n");
  process.stdout.write("Usage:\n");
  process.stdout.write("  hq setup\n");
  process.stdout.write("  hq init\n");
  process.stdout.write("\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  setup   Start the interactive HQ setup flow\n");
  process.stdout.write(
    "  init    Reserved for machine bootstrap and prerequisites\n"
  );
}

async function main(argv: string[]): Promise<void> {
  const [command] = argv;

  if (!command || command === "--help" || command === "help") {
    printHelp();
    return;
  }

  if (command === "setup") {
    await runSetupCommand();
    return;
  }

  if (command === "init") {
    outro(
      "`hq init` will become the machine bootstrap command. For now, start with `hq setup`."
    );
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
