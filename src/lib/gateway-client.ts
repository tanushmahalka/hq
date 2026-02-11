/**
 * Gateway WebSocket client — adapted from OpenClaw's ui/src/ui/gateway.ts.
 *
 * Handles: connection, reconnection with backoff, request/response correlation,
 * challenge handshake, and event streaming.
 */

export type EventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};

export type ResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

export type HelloOk = {
  type: "hello-ok";
  protocol: number;
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: { deviceToken?: string; role?: string; scopes?: string[] };
  policy?: { tickIntervalMs?: number };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

export type GatewayClientOptions = {
  url: string;
  token?: string;
  onHello?: (hello: HelloOk) => void;
  onEvent?: (evt: EventFrame) => void;
  onClose?: (info: { code: number; reason: string }) => void;
};

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 800;

  constructor(private opts: GatewayClientOptions) {}

  start() {
    this.closed = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error("client stopped"));
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = crypto.randomUUID();
    const frame = { type: "req", id, method, params };
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });
    this.ws.send(JSON.stringify(frame));
    return p;
  }

  // --- internals ---

  private connect() {
    if (this.closed) return;
    this.ws = new WebSocket(this.opts.url);
    this.ws.addEventListener("open", () => this.queueConnect());
    this.ws.addEventListener("message", (ev) =>
      this.handleMessage(String(ev.data ?? "")),
    );
    this.ws.addEventListener("close", (ev) => {
      this.ws = null;
      this.flushPending(
        new Error(`gateway closed (${ev.code}): ${ev.reason}`),
      );
      this.opts.onClose?.({ code: ev.code, reason: String(ev.reason ?? "") });
      this.scheduleReconnect();
    });
    this.ws.addEventListener("error", () => {
      /* close handler will fire */
    });
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    setTimeout(() => this.connect(), delay);
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  private queueConnect() {
    this.connectSent = false;
    if (this.connectTimer !== null) clearTimeout(this.connectTimer);
    // Wait 750ms for a challenge; if none arrives, connect anyway (token-only)
    this.connectTimer = setTimeout(() => this.sendConnect(), 750);
  }

  private sendConnect() {
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    void this.request<HelloOk>("connect", {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "control-ui",
        version: "1.0",
        platform: "web",
        mode: "webchat",
      },
      role: "operator",
      scopes: ["operator.admin", "operator.approvals"],
      auth: this.opts.token ? { token: this.opts.token } : undefined,
    })
      .then((hello) => {
        this.backoffMs = 800; // reset backoff on success
        this.opts.onHello?.(hello);
      })
      .catch(() => {
        this.ws?.close(4008, "connect failed");
      });
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };

    // --- Events (streaming, challenge) ---
    if (frame.type === "event") {
      const evt = parsed as EventFrame;

      // Handle challenge: gateway speaks first, we respond
      if (evt.event === "connect.challenge") {
        // For now we skip nonce signing (token-only auth).
        // The challenge arriving just means "send connect now" instead of
        // waiting the 750ms timer.
        void this.sendConnect();
        return;
      }

      // Track sequence gaps
      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          console.warn(
            `[gateway] seq gap: expected ${this.lastSeq + 1}, got ${seq}`,
          );
        }
        this.lastSeq = seq;
      }

      this.opts.onEvent?.(evt);
      return;
    }

    // --- Responses (RPC replies) ---
    if (frame.type === "res") {
      const res = parsed as ResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) return;
      this.pending.delete(res.id);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(new Error(res.error?.message ?? "request failed"));
      }
    }
  }
}
