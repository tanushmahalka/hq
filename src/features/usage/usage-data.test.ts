import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayClient } from "@/lib/gateway-client";
import {
  __test,
  loadSessionLogs,
  loadSessionTimeSeries,
  loadUsageSnapshot,
} from "./usage-data";

type RequestFn = GatewayClient["request"];

describe("usage data loader", () => {
  beforeEach(() => {
    localStorage.clear();
    __test.resetLegacyUsageDateParamsCache();
  });

  it("retries sessions.usage without date interpretation fields for legacy gateways", async () => {
    let sessionsUsageAttempts = 0;
    const requestImpl: RequestFn = async <T = unknown>(method: string, params?: unknown) => {
      const typedParams = (params ?? {}) as Record<string, unknown>;

      if (method === "sessions.usage") {
        sessionsUsageAttempts += 1;
        if (sessionsUsageAttempts === 1) {
          expect(typedParams.mode).toBe("specific");
          expect(typedParams.utcOffset).toMatch(/^UTC[+-]/);
          throw new Error("invalid sessions.usage params: unexpected property 'mode'");
        }
        expect(typedParams.mode).toBeUndefined();
        expect(typedParams.utcOffset).toBeUndefined();
        return {
          updatedAt: 1,
          startDate: "2026-03-13",
          endDate: "2026-03-13",
          sessions: [],
          totals: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            totalCost: 0,
            inputCost: 0,
            outputCost: 0,
            cacheReadCost: 0,
            cacheWriteCost: 0,
            missingCostEntries: 0,
          },
          aggregates: {
            messages: {
              total: 0,
              user: 0,
              assistant: 0,
              toolCalls: 0,
              toolResults: 0,
              errors: 0,
            },
            tools: { totalCalls: 0, uniqueTools: 0, tools: [] },
            byModel: [],
            byProvider: [],
            byAgent: [],
            byChannel: [],
            daily: [],
          },
        } as T;
      }

      expect(method).toBe("usage.cost");
      if (sessionsUsageAttempts === 0) {
        expect(typedParams.mode).toBe("specific");
        expect(typedParams.utcOffset).toMatch(/^UTC[+-]/);
      } else {
        expect(typedParams.mode).toBeUndefined();
        expect(typedParams.utcOffset).toBeUndefined();
      }
      return {
        updatedAt: 1,
        days: 1,
        daily: [],
        totals: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          totalCost: 0,
          inputCost: 0,
          outputCost: 0,
          cacheReadCost: 0,
          cacheWriteCost: 0,
          missingCostEntries: 0,
        },
      } as T;
    };
    const request = vi.fn(requestImpl);

    const result = await loadUsageSnapshot({
      client: { request: request as RequestFn },
      gatewayUrl: "ws://gateway.example.test",
      startDate: "2026-03-13",
      endDate: "2026-03-13",
      timeZone: "local",
    });

    expect(result.usageResult.sessions).toEqual([]);
    expect(result.costSummary.daily).toEqual([]);
    expect(request).toHaveBeenCalledTimes(4);
    expect(__test.shouldSendLegacyDateInterpretation("ws://gateway.example.test")).toBe(false);
  });

  it("skips optional timeseries and logs requests when the gateway does not advertise them", async () => {
    const request = vi.fn();

    await expect(
      loadSessionTimeSeries(
        { request: request as RequestFn },
        "session-1",
        ["sessions.usage", "usage.cost"],
      ),
    ).resolves.toBeNull();
    await expect(
      loadSessionLogs({ request: request as RequestFn }, "session-1", ["sessions.usage"]),
    ).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("fails soft when optional requests reject", async () => {
    const request = vi.fn().mockRejectedValue(new Error("unsupported"));

    await expect(
      loadSessionTimeSeries(
        { request: request as RequestFn },
        "session-1",
        ["sessions.usage.timeseries"],
      ),
    ).resolves.toBeNull();
    await expect(
      loadSessionLogs(
        { request: request as RequestFn },
        "session-1",
        ["sessions.usage.logs"],
      ),
    ).resolves.toBeNull();
  });
});
