import { CliError } from "../../core/errors.ts";
import { readResponseBody } from "../../core/http.ts";

export async function throwAweberError(response: Response): Promise<never> {
  const payload = await readResponseBody(response);
  throw new CliError(formatAweberError(response, payload), response.status === 401 ? 2 : 1);
}

export function formatAweberError(response: Response, payload: unknown): string {
  if (isProblemJson(payload)) {
    return payload.detail ? `${payload.title}: ${payload.detail}` : payload.title;
  }

  if (isClassicError(payload)) {
    return payload.error.message ? `${payload.error.type}: ${payload.error.message}` : payload.error.type;
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return `${response.status} ${response.statusText}`;
}

interface ProblemJson {
  title: string;
  detail?: string;
}

interface ClassicErrorPayload {
  error: {
    type: string;
    message?: string;
  };
}

function isProblemJson(value: unknown): value is ProblemJson {
  return typeof value === "object" && value !== null && "title" in value && typeof value.title === "string";
}

function isClassicError(value: unknown): value is ClassicErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "object" &&
    (value as { error?: { type?: unknown } }).error?.type !== undefined
  );
}
