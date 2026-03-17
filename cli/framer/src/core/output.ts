export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printLine(value = ""): void {
  process.stdout.write(`${value}\n`);
}
