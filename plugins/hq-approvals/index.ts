import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { ApprovalStore } from "./store";
import type { ApprovalDecision, PendingApproval } from "./types";

const HIDDEN_CONTINUATION_MARKER = "[[openclaw_hidden_approval_continuation]]";

const APPROVAL_GUIDANCE = [
  "Use approval_request before risky or user-visible side effects: terminal work that needs sign-off, destructive changes, publishing or sending, purchases or spend, or anything else that clearly needs a human decision.",
  "Write approval_request bodies as short email-like Markdown with: what you want to do, why it is needed, the exact proposed action, expected outcome, risks or scope, and what you will do after approve or deny.",
  "After calling approval_request, stop and wait. The same session will receive a follow-up turn when a human approves or denies, optionally with feedback telling you how to proceed.",
].join("\n");

interface PluginAPI {
  config: unknown;
  pluginConfig?: Record<string, unknown>;
  logger: {
    warn: (message: string) => void;
  };
  runtime: {
    state: {
      resolveStateDir: () => string;
    };
    subagent: {
      run: (params: {
        sessionKey: string;
        message: string;
        deliver?: boolean;
        idempotencyKey?: string;
      }) => Promise<{ runId: string }>;
    };
  };
  registerTool: (tool: unknown) => void;
  registerGatewayMethod: (
    method: string,
    handler: (opts: {
      params: Record<string, unknown>;
      respond: (ok: boolean, payload?: unknown, error?: unknown) => void;
      context: {
        broadcast: (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => void;
      };
    }) => Promise<void>,
  ) => void;
  registerHttpRoute: (params: {
    path: string;
    auth: "plugin" | "gateway";
    handler: (req: NodeJS.ReadableStream & {
      method?: string;
      headers: Record<string, string | string[] | undefined>;
      [Symbol.asyncIterator](): AsyncIterableIterator<string | Buffer>;
    }, res: {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      end: (body?: string) => void;
    }) => Promise<boolean>;
  }) => void;
  on: (
    hookName: "before_prompt_build",
    handler: () => Promise<{ prependSystemContext: string }>,
  ) => void;
}

const ApprovalRequestToolSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body"],
  properties: {
    title: { type: "string", minLength: 1 },
    body: { type: "string", minLength: 1 },
  },
} as const;

function readNonEmptyString(
  params: Record<string, unknown>,
  key: string,
  options?: { trim?: boolean; allowEmpty?: boolean },
): string {
  const raw = params[key];
  if (typeof raw !== "string") {
    throw new Error(`${key} required`);
  }
  const value = options?.trim === false ? raw : raw.trim();
  if (!options?.allowEmpty && !value) {
    throw new Error(`${key} required`);
  }
  return value;
}

function readOptionalString(
  params: Record<string, unknown>,
  key: string,
  options?: { trim?: boolean },
): string | undefined {
  const raw = params[key];
  if (typeof raw !== "string") {
    return undefined;
  }
  const value = options?.trim === false ? raw : raw.trim();
  return value || undefined;
}

function toErrorShape(message: string) {
  return { code: "INVALID_REQUEST", message };
}

function resolveHooksToken(api: PluginAPI): string | undefined {
  const configured = api.pluginConfig?.hooksToken;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.OPENCLAW_HOOKS_TOKEN?.trim() || env?.OPENCLAW_APPROVALS_HOOKS_TOKEN?.trim();
}

function readBearerToken(headers: Record<string, string | string[] | undefined>): string | undefined {
  const authHeader = headers.authorization;
  const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (typeof authValue === "string") {
    const match = authValue.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  const fallback = headers["x-openclaw-token"];
  const fallbackValue = Array.isArray(fallback) ? fallback[0] : fallback;
  return typeof fallbackValue === "string" && fallbackValue.trim() ? fallbackValue.trim() : undefined;
}

function safeSecretEquals(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function buildContinuationMessage(approval: PendingApproval): string {
  const decision = approval.decision === "approve" ? "approved" : "denied";
  const followUpInstruction =
    approval.decision === "approve"
      ? "The human approved this request. Continue the work in this session and follow any feedback."
      : "The human denied this request. Do not perform the proposed action. Replan in this session and follow any feedback.";
  return [
    HIDDEN_CONTINUATION_MARKER,
    `Human approval decision: ${decision}.`,
    `Approval ID: ${approval.id}`,
    `Title: ${approval.request.title}`,
    approval.resolvedBy ? `Resolved by: ${approval.resolvedBy}` : undefined,
    approval.feedback ? `Feedback:\n${approval.feedback}` : "Feedback: none",
    "Original approval draft:",
    approval.request.body,
    "",
    followUpInstruction,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

const plugin = {
  id: "hq-approvals",
  name: "HQ Approvals",
  description: "Generic human approval workflow backed by HQ.",
  register(api: PluginAPI) {
    const store = new ApprovalStore({
      rootDir: path.join(api.runtime.state.resolveStateDir(), "hq-approvals"),
      logger: api.logger,
    });

    api.registerTool((ctx) => ({
      name: "approval_request",
      label: "Approval Request",
      description:
        "Ask a human for approval before taking a risky or user-visible action. Write the body like a short email in Markdown.",
      parameters: ApprovalRequestToolSchema,
      execute: async (_id, args) => {
        try {
          const params = args as Record<string, unknown>;
          const title = readNonEmptyString(params, "title");
          const body = readNonEmptyString(params, "body", { trim: false });
          if (!ctx.sessionKey) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    status: "error",
                    error: "approval_request requires an active agent session",
                  }),
                },
              ],
            };
          }
          const approval = await store.create({
            title,
            body,
            sessionKey: ctx.sessionKey,
            agentId: ctx.agentId ?? null,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "pending",
                  approvalId: approval.id,
                  message:
                    "Approval requested. Wait for the human decision in this session before continuing.",
                }),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
          };
        }
      },
    }));

    api.registerGatewayMethod("approval.request", async ({ params, respond, context }) => {
      try {
        const title = readNonEmptyString(params, "title");
        const body = readNonEmptyString(params, "body", { trim: false });
        const sessionKey = readNonEmptyString(params, "sessionKey");
        const agentId = readOptionalString(params, "agentId");
        const approval = await store.create({
          title,
          body,
          sessionKey,
          agentId: agentId ?? null,
        });
        context.broadcast("approval.requested", approval, { dropIfSlow: true });
        respond(true, {
          status: "pending",
          approval,
        });
      } catch (error) {
        respond(false, undefined, toErrorShape(error instanceof Error ? error.message : String(error)));
      }
    });

    api.registerGatewayMethod("approval.list", async ({ respond }) => {
      const approvals = await store.list();
      respond(true, { approvals });
    });

    api.registerGatewayMethod("approval.resolve", async ({ params, respond, context }) => {
      try {
        const id = readNonEmptyString(params, "id");
        const decisionRaw = readNonEmptyString(params, "decision");
        if (decisionRaw !== "approve" && decisionRaw !== "deny") {
          throw new Error("decision must be approve or deny");
        }
        const decision = decisionRaw as ApprovalDecision;
        const feedback = readOptionalString(params, "feedback", { trim: false }) ?? null;
        const resolvedBy = readOptionalString(params, "resolvedBy") ?? null;
        const resolved = await store.resolve({
          id,
          decision,
          feedback,
          resolvedBy,
        });
        if (!resolved) {
          respond(false, undefined, { code: "NOT_FOUND", message: `unknown approval: ${id}` });
          return;
        }
        context.broadcast("approval.resolved", resolved, { dropIfSlow: true });
        await api.runtime.subagent.run({
          sessionKey: resolved.request.sessionKey,
          message: buildContinuationMessage(resolved),
          deliver: false,
          idempotencyKey: `hq-approval:${resolved.id}:${resolved.resolvedAtMs ?? Date.now()}`,
        });
        respond(true, {
          status: "resolved",
          approval: resolved,
        });
      } catch (error) {
        respond(false, undefined, toErrorShape(error instanceof Error ? error.message : String(error)));
      }
    });

    api.registerHttpRoute({
      path: "/plugins/hq-approvals/approval/resolve",
      auth: "plugin",
      handler: async (req, res) => {
        if ((req.method ?? "GET").toUpperCase() !== "POST") {
          res.statusCode = 405;
          res.setHeader("Allow", "POST");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
          return true;
        }

        const expectedToken = resolveHooksToken(api);
        const providedToken = readBearerToken(req.headers);
        if (!safeSecretEquals(providedToken, expectedToken)) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
          return true;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: "Invalid JSON body" }));
          return true;
        }

        try {
          const id = readNonEmptyString(parsed, "id");
          const decisionRaw = readNonEmptyString(parsed, "decision");
          if (decisionRaw !== "approve" && decisionRaw !== "deny") {
            throw new Error("decision must be approve or deny");
          }
          const decision = decisionRaw as ApprovalDecision;
          const feedback = readOptionalString(parsed, "feedback", { trim: false }) ?? null;
          const resolvedBy = readOptionalString(parsed, "resolvedBy") ?? null;
          const approval = await store.resolve({
            id,
            decision,
            feedback,
            resolvedBy,
          });
          if (!approval) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, error: `unknown approval: ${id}` }));
            return true;
          }
          await api.runtime.subagent.run({
            sessionKey: approval.request.sessionKey,
            message: buildContinuationMessage(approval),
            deliver: false,
            idempotencyKey: `hq-approval:${approval.id}:${approval.resolvedAtMs ?? Date.now()}`,
          });
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: true, approval }));
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status = message.includes("unknown approval:") ? 404 : 400;
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: message }));
          return true;
        }
      },
    });

    api.on("before_prompt_build", async () => ({
      prependSystemContext: APPROVAL_GUIDANCE,
    }));
  },
};

export default plugin;
