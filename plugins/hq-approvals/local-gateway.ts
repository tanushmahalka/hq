import { randomUUID } from "node:crypto";

type GatewayResponse<T> = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: T;
  error?: { message?: string };
};

function parseGatewayPort(config: unknown): number {
  const raw = (config as { gateway?: { port?: unknown } } | undefined)?.gateway?.port;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 18789;
}

export function resolveGatewayToken(params: {
  config: unknown;
  pluginConfig?: Record<string, unknown>;
}): string | undefined {
  const override = params.pluginConfig?.gatewayToken;
  if (typeof override === "string" && override.trim()) {
    return override.trim();
  }
  const raw = (params.config as { gateway?: { auth?: { token?: unknown } } } | undefined)?.gateway
    ?.auth?.token;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export async function callLocalGatewayMethod<T>(params: {
  config: unknown;
  pluginConfig?: Record<string, unknown>;
  method: string;
  payload: Record<string, unknown>;
  scopes?: string[];
  timeoutMs?: number;
}): Promise<T> {
  const port = parseGatewayPort(params.config);
  const token = resolveGatewayToken(params);
  const timeoutMs = params.timeoutMs ?? 10_000;
  const connectRequestId = randomUUID();
  const requestId = randomUUID();

  return await new Promise<T>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    let settled = false;
    let connectSent = false;
    let challengeTimer: ReturnType<typeof setTimeout> | null = null;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        ws.close();
      } catch {}
      reject(new Error(`Timed out calling gateway method "${params.method}"`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      if (challengeTimer) {
        clearTimeout(challengeTimer);
      }
    };

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {}
      reject(error);
    };

    const succeed = (value: T) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {}
      resolve(value);
    };

    const sendConnect = () => {
      if (connectSent || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      connectSent = true;
      ws.send(
        JSON.stringify({
          type: "req",
          id: connectRequestId,
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: "hq-approvals-plugin",
              version: "1.0",
              platform: "node",
              mode: "backend",
            },
            role: "operator",
            scopes: params.scopes ?? ["operator.admin", "operator.approvals"],
            auth: token ? { token } : undefined,
          },
        }),
      );
    };

    ws.addEventListener("open", () => {
      challengeTimer = setTimeout(sendConnect, 750);
    });

    ws.addEventListener("error", () => {
      fail(new Error(`WebSocket error calling gateway method "${params.method}"`));
    });

    ws.addEventListener("close", () => {
      if (!settled) {
        fail(new Error(`Gateway connection closed before "${params.method}" completed`));
      }
    });

    ws.addEventListener("message", (event) => {
      let frame: unknown;
      try {
        frame = JSON.parse(String(event.data ?? ""));
      } catch {
        return;
      }
      if (!frame || typeof frame !== "object") {
        return;
      }
      const typed = frame as { type?: string; event?: string; id?: string };
      if (typed.type === "event" && typed.event === "connect.challenge") {
        sendConnect();
        return;
      }
      if (typed.type === "res" && typed.id === connectRequestId) {
        const connectResponse = frame as GatewayResponse<unknown>;
        if (!connectResponse.ok) {
          fail(
            new Error(
              connectResponse.error?.message ?? `Gateway connect failed for "${params.method}"`,
            ),
          );
          return;
        }
        ws.send(
          JSON.stringify({
            type: "req",
            id: requestId,
            method: params.method,
            params: params.payload,
          }),
        );
        return;
      }
      if (typed.type !== "res" || typed.id !== requestId) {
        return;
      }
      const response = frame as GatewayResponse<T>;
      if (!response.ok) {
        fail(new Error(response.error?.message ?? `Gateway method "${params.method}" failed`));
        return;
      }
      succeed((response.payload ?? {}) as T);
    });
  });
}
