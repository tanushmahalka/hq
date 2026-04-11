export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printLine(value = ""): void {
  process.stdout.write(`${value}\n`);
}

export function printHumanEnvelope(value: {
  ok: boolean;
  command: string;
  entity: string;
  provider?: string;
  result?: Record<string, unknown> | null;
  warnings?: string[];
  explain?: string[];
}): void {
  if (!value.ok) {
    printLine("No result.");
    return;
  }

  const result = value.result ?? {};
  const primary =
    stringField(result, "fullName") ??
    stringField(result, "name") ??
    stringField(result, "email") ??
    stringField(result, "domain") ??
    "Result";

  printLine(primary);
  printLine(`command: ${value.command}`);
  printLine(`entity: ${value.entity}`);
  if (value.provider) {
    printLine(`provider: ${value.provider}`);
  }

  const headlineFields = ["jobTitle", "email", "domain", "websiteUrl", "linkedinUrl", "industry", "location"];
  for (const field of headlineFields) {
    const fieldValue = stringField(result, field);
    if (fieldValue) {
      printLine(`${field}: ${fieldValue}`);
    }
  }

  const phones = Array.isArray(result.phones) ? result.phones : [];
  if (phones.length > 0) {
    const summaries = phones
      .map((phone) => {
        if (!isPlainObject(phone)) return "";
        const valueField = stringField(phone, "value");
        const typeField = stringField(phone, "type");
        const statusField = stringField(phone, "status");
        return [valueField, typeField, statusField].filter(Boolean).join(" ");
      })
      .filter(Boolean);

    if (summaries.length > 0) {
      printLine(`phones: ${summaries.join(", ")}`);
    }
  }

  if (value.warnings && value.warnings.length > 0) {
    printLine("");
    for (const warning of value.warnings) {
      printLine(`warning: ${warning}`);
    }
  }

  if (value.explain && value.explain.length > 0) {
    printLine("");
    for (const line of value.explain) {
      printLine(`explain: ${line}`);
    }
  }
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === "string" && field.trim() ? field : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
