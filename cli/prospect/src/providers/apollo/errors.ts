import { CliError } from "../../core/errors.ts";
import { readResponseBody } from "../../core/http.ts";

export async function throwApolloError(response: Response): Promise<never> {
  const payload = await readResponseBody(response);
  throw new CliError(formatApolloError(response, payload), response.status === 401 ? 2 : 1, {
    status: response.status,
    details: payload,
  });
}

function formatApolloError(response: Response, payload: unknown): string {
  if (isPlainObject(payload)) {
    const message =
      stringField(payload, "message") ??
      stringField(payload, "error") ??
      stringField(payload, "detail") ??
      stringField(payload, "description");

    if (message) {
      return message;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return `${response.status} ${response.statusText}`;
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === "string" && field.trim() ? field : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
