import { connect } from "framer-api";

import type { ParsedArgs } from "./args.ts";
import { getStringFlag } from "./args.ts";
import { CliError } from "./errors.ts";

export type FramerClient = Awaited<ReturnType<typeof connect>>;

export interface SharedDependencies {
  connectImpl?: typeof connect;
}

export const SHARED_FLAG_SCHEMA = {
  "--api-key": "string",
  "--help": "boolean",
  "--json": "boolean",
  "--project": "string",
} as const;

export function resolveProject(parsed: ParsedArgs): string {
  return getStringFlag(parsed, "--project") ?? process.env.FRAMER_PROJECT_URL ?? process.env.FRAMER_PROJECT_ID ?? missing("project");
}

export function resolveApiKey(parsed: ParsedArgs): string {
  return getStringFlag(parsed, "--api-key") ?? process.env.FRAMER_API_KEY ?? missing("api key");
}

export async function withFramer<T>(
  parsed: ParsedArgs,
  run: (framer: FramerClient) => Promise<T>,
  dependencies: SharedDependencies = {},
): Promise<T> {
  const project = resolveProject(parsed);
  const apiKey = resolveApiKey(parsed);
  const connectImpl = dependencies.connectImpl ?? connect;
  const framer = await connectImpl(project, apiKey);

  try {
    return await run(framer);
  } finally {
    await framer.disconnect();
  }
}

function missing(subject: string): never {
  throw new CliError(
    `Missing Framer ${subject}. Pass it with a flag or set the matching environment variable.`,
    2,
  );
}
