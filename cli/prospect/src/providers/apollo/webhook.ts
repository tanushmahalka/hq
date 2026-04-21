import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";

import { CliError } from "../../core/errors.ts";

interface WebhookServerState {
  resolved: boolean;
  payload?: unknown;
  error?: Error;
}

interface CapturedWebhookRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[]>;
  body: string;
}

export interface ApolloWebhookSession {
  webhookUrl: string;
  waitForPayload(timeoutMs: number): Promise<unknown>;
  close(): Promise<void>;
}

export async function createApolloWebhookSession(options: {
  spawnImpl?: typeof spawn;
  hostname?: string;
  debug?: boolean;
} = {}): Promise<ApolloWebhookSession> {
  const hostname = options.hostname ?? "127.0.0.1";
  const pathToken = randomBytes(12).toString("hex");
  const requestPath = `/apollo-webhook/${pathToken}`;
  const serverState: WebhookServerState = {
    resolved: false,
  };
  const server = createServer(async (request, response) => {
    await handleWebhookRequest(request, response, requestPath, serverState, options.debug === true);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, hostname, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new CliError("Failed to determine Apollo webhook listener address.", 1);
  }

  const localUrl = `http://${hostname}:${address.port}`;
  const tunnel = await startCloudflaredTunnel({
    spawnImpl: options.spawnImpl,
    localUrl,
  });
  const webhookUrl = `${tunnel.publicUrl}${requestPath}`;

  return {
    webhookUrl,
    async waitForPayload(timeoutMs: number): Promise<unknown> {
      if (serverState.payload !== undefined) {
        return serverState.payload;
      }

      return await new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new CliError(`Timed out waiting for Apollo webhook after ${timeoutMs}ms.`, 1));
        }, timeoutMs);

        const check = () => {
          if (serverState.error) {
            cleanup();
            reject(serverState.error);
            return;
          }

          if (!serverState.resolved) {
            return;
          }

          cleanup();
          resolve(serverState.payload);
        };

        const interval = setInterval(check, 100);
        const cleanup = () => {
          clearTimeout(timer);
          clearInterval(interval);
        };

        check();
      });
    },
    async close(): Promise<void> {
      tunnel.process.kill();
      await Promise.allSettled([
        new Promise<void>((resolve) => {
          if (server.listening) {
            server.close(() => resolve());
            return;
          }
          resolve();
        }),
        new Promise<void>((resolve) => {
          tunnel.process.once("exit", () => resolve());
          setTimeout(resolve, 500);
        }),
      ]);
    },
  };
}

async function handleWebhookRequest(
  request: IncomingMessage,
  response: ServerResponse,
  requestPath: string,
  state: WebhookServerState,
  debug: boolean,
): Promise<void> {
  const url = request.url ?? "/";
  const method = request.method ?? "UNKNOWN";
  const headers = collectHeaders(request);
  if (debug) {
    process.stderr.write(`[apollo wait] inbound request ${method} ${url}\n`);
  }

  if (request.method !== "POST") {
    if (debug) {
      process.stderr.write(`[apollo wait] rejected request: expected POST, received ${method}\n`);
    }
    response.statusCode = 405;
    response.end("Method Not Allowed");
    return;
  }

  if (url !== requestPath) {
    if (debug) {
      process.stderr.write(`[apollo wait] rejected request: expected path ${requestPath}, received ${url}\n`);
    }
    response.statusCode = 404;
    response.end("Not Found");
    return;
  }

  try {
    const body = await readRequestBody(request);
    if (debug) {
      process.stderr.write(`[apollo wait] accepted request body (${body.length} bytes)\n`);
    }
    state.resolved = true;
    state.payload = {
      method,
      path: url,
      headers,
      body,
    } satisfies CapturedWebhookRequest;
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true }));
  } catch (error) {
    if (debug) {
      process.stderr.write(`[apollo wait] failed to read request body: ${error instanceof Error ? error.message : String(error)}\n`);
    }
    state.error = error instanceof Error ? error : new Error(String(error));
    response.statusCode = 400;
    response.end("Invalid webhook payload");
  }
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function collectHeaders(request: IncomingMessage): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) {
      continue;
    }
    headers[key] = value;
  }
  return headers;
}

async function startCloudflaredTunnel(options: {
  localUrl: string;
  spawnImpl?: typeof spawn;
}): Promise<{ publicUrl: string; process: ChildProcessWithoutNullStreams }> {
  const spawnImpl = options.spawnImpl ?? spawn;
  const child = spawnImpl(
    "cloudflared",
    ["tunnel", "--url", options.localUrl, "--loglevel", "info", "--no-autoupdate"],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const publicUrl = await waitForTunnelUrl(child);
  return {
    publicUrl,
    process: child,
  };
}

async function waitForTunnelUrl(process: ChildProcessWithoutNullStreams): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    let settled = false;

    const finish = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      handler();
    };

    const onData = (chunk: Buffer | string) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      stdout += text;
      stderr += text;
      const publicUrl = extractTunnelUrl(text);
      if (!publicUrl) {
        return;
      }
      finish(() => resolve(publicUrl));
    };

    const onError = (error: Error) => {
      finish(() => reject(new CliError(`Failed to start cloudflared tunnel: ${error.message}`, 1)));
    };

    const onExit = (code: number | null) => {
      finish(() =>
        reject(
          new CliError(
            `cloudflared exited before providing a public URL.${code !== null ? ` Exit code: ${code}.` : ""} ${summarizeTunnelLogs(stdout || stderr)}`.trim(),
            1,
          ),
        ),
      );
    };

    const cleanup = () => {
      process.stdout.off("data", onData);
      process.stderr.off("data", onData);
      process.off("error", onError);
      process.off("exit", onExit);
    };

    process.stdout.on("data", onData);
    process.stderr.on("data", onData);
    process.on("error", onError);
    process.on("exit", onExit);
  });
}

function summarizeTunnelLogs(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  return `Logs: ${normalized.slice(0, 300)}`;
}

function extractTunnelUrl(value: string): string | undefined {
  const tryCloudflareMatch = value.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/iu);
  if (tryCloudflareMatch) {
    return tryCloudflareMatch[0];
  }

  const localhostMatch = value.match(/http:\/\/127\.0\.0\.1:\d+/u);
  if (localhostMatch) {
    return localhostMatch[0];
  }
  return undefined;
}
