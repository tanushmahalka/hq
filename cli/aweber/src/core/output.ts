export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printLine(value = ""): void {
  process.stdout.write(`${value}\n`);
}

export function printHuman(value: unknown, printLineImpl: typeof printLine = printLine): void {
  if (value === null || value === undefined) {
    printLineImpl("OK");
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      printLineImpl("No results.");
      return;
    }

    if (value.every(isScalar)) {
      for (const item of value) {
        printLineImpl(String(item));
      }
      return;
    }

    if (value.every((item) => isPlainObject(item))) {
      printTable(value as Array<Record<string, unknown>>, printLineImpl);
      return;
    }

    for (const item of value) {
      printLineImpl(JSON.stringify(item));
    }
    return;
  }

  if (isPlainObject(value)) {
    const entries = Array.isArray(value.entries) ? value.entries : null;
    if (entries && entries.every((item) => isPlainObject(item))) {
      const meta = Object.entries(value).filter(([key]) => key !== "entries");
      for (const [key, entryValue] of meta) {
        printLineImpl(`${key}: ${formatScalar(entryValue)}`);
      }
      if (meta.length > 0) {
        printLineImpl("");
      }
      printTable(entries as Array<Record<string, unknown>>, printLineImpl);
      return;
    }

    for (const [key, entryValue] of Object.entries(value)) {
      if (isScalar(entryValue)) {
        printLineImpl(`${key}: ${formatScalar(entryValue)}`);
        continue;
      }

      printLineImpl(`${key}: ${JSON.stringify(entryValue)}`);
    }
    return;
  }

  printLineImpl(String(value));
}

function printTable(rows: Array<Record<string, unknown>>, printLineImpl: typeof printLine): void {
  const columns = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) {
        if (isScalar(row[key])) {
          set.add(key);
        }
      }
      return set;
    }, new Set<string>()),
  );

  if (columns.length === 0) {
    for (const row of rows) {
      printLineImpl(JSON.stringify(row));
    }
    return;
  }

  printLineImpl(columns.join("\t"));
  for (const row of rows) {
    printLineImpl(columns.map((column) => formatScalar(row[column])).join("\t"));
  }
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function isScalar(value: unknown): value is string | number | boolean | null | undefined {
  return value === null || value === undefined || ["string", "number", "boolean"].includes(typeof value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
