import { inspect } from "node:util";

export function printLine(value = ""): void {
  process.stdout.write(`${value}\n`);
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printHuman(value: unknown): void {
  if (typeof value === "string") {
    printLine(value);
    return;
  }

  process.stdout.write(`${inspect(value, { colors: false, depth: 8, sorted: true })}\n`);
}

export function printError(error: {
  message: string;
  status?: number;
  requestId?: string;
  details?: unknown;
}): void {
  process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
}

export function printVerbose(value: unknown): void {
  process.stderr.write(`${JSON.stringify(value, null, 2)}\n`);
}
