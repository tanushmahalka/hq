import { readFile } from "node:fs/promises";

import { CliError } from "./errors.ts";

export async function readJsonInput(input: string | undefined, filePath: string | undefined): Promise<unknown | undefined> {
  if (input !== undefined && filePath !== undefined) {
    throw new CliError("Use either --data or --data-file, not both.", 2);
  }

  const raw = input ?? (filePath ? await readTextInput(filePath) : undefined);
  if (raw === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new CliError(`Invalid JSON body: ${(error as Error).message}`, 2);
  }
}

export async function readTextInput(filePath: string): Promise<string> {
  if (filePath === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  return readFile(filePath, "utf8");
}

export function parseAssignmentList(values: string[], parseValue = coerceScalar): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const value of values) {
    const [key, ...rest] = value.split("=");
    if (!key || rest.length === 0) {
      throw new CliError(`Expected key=value but received: ${value}`, 2);
    }

    const parsedValue = parseValue(rest.join("="));
    const existing = result[key];

    if (existing === undefined) {
      result[key] = parsedValue;
      continue;
    }

    if (Array.isArray(existing)) {
      existing.push(parsedValue);
      result[key] = existing;
      continue;
    }

    result[key] = [existing, parsedValue];
  }

  return result;
}

export function coerceScalar(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return Number.parseFloat(value);
  return value;
}

export function toStringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stringifyValue(entryValue)]),
  );
}

export function stringifyValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const raw = await response.text();
  if (!raw) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new CliError(`Server returned invalid JSON: ${(error as Error).message}`, 1);
  }
}
