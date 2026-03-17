import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface CliConfig {
  databaseUrl?: string;
}

function getConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "ebook");
  }

  return path.join(os.homedir(), ".config", "ebook");
}

export function getConfigPath(): string {
  return process.env.EBOOK_CONFIG_PATH ?? path.join(getConfigDir(), "config.json");
}

export async function readConfig(): Promise<CliConfig> {
  try {
    const raw = await readFile(getConfigPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const { databaseUrl } = parsed as Record<string, unknown>;
    return typeof databaseUrl === "string" ? { databaseUrl } : {};
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

export async function writeConfig(config: CliConfig): Promise<void> {
  const configPath = getConfigPath();
  const tempPath = `${configPath}.tmp`;
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await rename(tempPath, configPath);
}

export async function saveDatabaseUrl(databaseUrl: string): Promise<void> {
  const config = await readConfig();
  await writeConfig({
    ...config,
    databaseUrl,
  });
}
