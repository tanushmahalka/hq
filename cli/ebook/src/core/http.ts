import { CliError } from "./errors.ts";

function resolveApiUrl(explicitApiUrl?: string): string {
  return (explicitApiUrl ?? process.env.HQ_API_URL ?? "http://127.0.0.1:8787").replace(/\/+$/, "");
}

function resolveToken(explicitToken?: string): string {
  const token = explicitToken ?? process.env.AGENT_API_TOKEN ?? process.env.HQ_AGENT_API_TOKEN;
  if (!token) {
    throw new CliError(
      "Missing agent token. Set AGENT_API_TOKEN or pass --token.",
      2,
    );
  }

  return token;
}

export async function requestAgentJson<T>({
  apiUrl,
  token,
  path,
  method = "GET",
  body,
}: {
  apiUrl?: string;
  token?: string;
  path: string;
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
}): Promise<T> {
  const response = await fetch(`${resolveApiUrl(apiUrl)}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${resolveToken(token)}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  const payload = raw ? tryParseJson(raw) : null;

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `${response.status} ${response.statusText}`;
    throw new CliError(message, 1);
  }

  return payload as T;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new CliError("Server returned invalid JSON.", 1);
  }
}
