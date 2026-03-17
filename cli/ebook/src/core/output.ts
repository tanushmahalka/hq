export function printLine(value = ""): void {
  process.stdout.write(`${value}\n`);
}

export function printJson(value: unknown): void {
  printLine(JSON.stringify(value, null, 2));
}
