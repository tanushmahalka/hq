import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PendingApproval, ResolveApprovalInput, ApprovalStoreFile } from "./types";

type LoggerLike = {
  warn: (message: string) => void;
};

const STORE_FILE = "pending-approvals.json";

export class ApprovalStore {
  private readonly rootDir: string;
  private readonly filePath: string;
  private readonly logger: LoggerLike;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(params: { rootDir: string; logger: LoggerLike }) {
    this.rootDir = params.rootDir;
    this.filePath = path.join(params.rootDir, STORE_FILE);
    this.logger = params.logger;
  }

  async list(): Promise<PendingApproval[]> {
    await this.waitForIdle();
    const records = await this.readRecords();
    return [...records].sort((a, b) => a.createdAtMs - b.createdAtMs);
  }

  async create(params: {
    title: string;
    body: string;
    sessionKey: string;
    agentId?: string | null;
  }): Promise<PendingApproval> {
    return await this.withLock(async (records) => {
      const approval: PendingApproval = {
        id: randomUUID(),
        request: {
          title: params.title,
          body: params.body,
          sessionKey: params.sessionKey,
          agentId: params.agentId ?? null,
        },
        createdAtMs: Date.now(),
      };
      records.push(approval);
      return { nextRecords: records, result: approval };
    });
  }

  async resolve(params: ResolveApprovalInput): Promise<PendingApproval | null> {
    return await this.withLock(async (records) => {
      const index = records.findIndex((entry) => entry.id === params.id);
      if (index < 0) {
        return { nextRecords: records, result: null };
      }
      const current = records[index];
      const resolved: PendingApproval = {
        ...current,
        decision: params.decision,
        feedback: params.feedback ?? null,
        resolvedBy: params.resolvedBy ?? null,
        resolvedAtMs: Date.now(),
      };
      records.splice(index, 1);
      return { nextRecords: records, result: resolved };
    });
  }

  private async withLock<T>(
    mutate: (
      records: PendingApproval[],
    ) => Promise<T | { nextRecords?: PendingApproval[]; result: T }> | T | {
      nextRecords?: PendingApproval[];
      result: T;
    },
  ): Promise<T> {
    const previous = this.writeQueue;
    let release!: () => void;
    this.writeQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      const records = await this.readRecords();
      const value = await mutate(records);
      const wrapped =
        value &&
        typeof value === "object" &&
        "result" in value &&
        Object.prototype.hasOwnProperty.call(value, "result")
          ? (value as { nextRecords?: PendingApproval[]; result: T })
          : { nextRecords: records, result: value as T };
      await this.writeRecords(wrapped.nextRecords ?? records);
      return wrapped.result;
    } finally {
      release();
    }
  }

  private async waitForIdle(): Promise<void> {
    await this.writeQueue;
  }

  private async readRecords(): Promise<PendingApproval[]> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as ApprovalStoreFile;
      return Array.isArray(parsed.approvals) ? parsed.approvals : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.warn(`[hq-approvals] Failed reading store: ${String(error)}`);
      }
      return [];
    }
  }

  private async writeRecords(records: PendingApproval[]): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true, mode: 0o700 });
    await fs.chmod(this.rootDir, 0o700).catch(() => {});

    const payload: ApprovalStoreFile = { approvals: records };
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), {
      mode: 0o600,
      encoding: "utf8",
    });
    await fs.rename(tempPath, this.filePath);
    await fs.chmod(this.filePath, 0o600).catch(() => {});
  }
}
