import { describe, expect, it } from "vitest";
import type { SessionUsageTimePoint, UsageSessionEntry } from "./types";
import { computeFilteredUsage } from "./usage-utils";

function makePoint(overrides: Partial<SessionUsageTimePoint> = {}): SessionUsageTimePoint {
  return {
    timestamp: 1000,
    totalTokens: 100,
    cost: 0.01,
    input: 30,
    output: 40,
    cacheRead: 20,
    cacheWrite: 10,
    cumulativeTokens: 0,
    cumulativeCost: 0,
    ...overrides,
  };
}

const baseUsage = {
  totalTokens: 1000,
  totalCost: 1,
  input: 300,
  output: 400,
  cacheRead: 200,
  cacheWrite: 100,
  inputCost: 0.3,
  outputCost: 0.4,
  cacheReadCost: 0.2,
  cacheWriteCost: 0.1,
  durationMs: 60000,
  firstActivity: 0,
  lastActivity: 60000,
  missingCostEntries: 0,
  messageCounts: {
    total: 10,
    user: 5,
    assistant: 5,
    toolCalls: 0,
    toolResults: 0,
    errors: 0,
  },
} satisfies NonNullable<UsageSessionEntry["usage"]>;

describe("computeFilteredUsage", () => {
  it("returns undefined when no points match the range", () => {
    const points = [makePoint({ timestamp: 1000 }), makePoint({ timestamp: 2000 })];
    const result = computeFilteredUsage(baseUsage, points, 3000, 4000);
    expect(result).toBeUndefined();
  });

  it("aggregates tokens and cost for points within range", () => {
    const points = [
      makePoint({ timestamp: 1000, totalTokens: 100, cost: 0.1 }),
      makePoint({ timestamp: 2000, totalTokens: 200, cost: 0.2 }),
      makePoint({ timestamp: 3000, totalTokens: 300, cost: 0.3 }),
    ];
    const result = computeFilteredUsage(baseUsage, points, 1000, 2000);
    expect(result).toBeDefined();
    expect(result?.totalTokens).toBe(300);
    expect(result?.totalCost).toBeCloseTo(0.3);
  });

  it("handles reversed ranges", () => {
    const points = [
      makePoint({ timestamp: 1000, totalTokens: 50 }),
      makePoint({ timestamp: 2000, totalTokens: 75 }),
    ];
    const result = computeFilteredUsage(baseUsage, points, 2000, 1000);
    expect(result?.totalTokens).toBe(125);
  });

  it("counts input and output points as user and assistant messages", () => {
    const points = [
      makePoint({ timestamp: 1000, input: 10, output: 0 }),
      makePoint({ timestamp: 2000, input: 0, output: 20 }),
      makePoint({ timestamp: 3000, input: 5, output: 15 }),
    ];
    const result = computeFilteredUsage(baseUsage, points, 1000, 3000);
    expect(result?.messageCounts?.user).toBe(2);
    expect(result?.messageCounts?.assistant).toBe(2);
    expect(result?.messageCounts?.total).toBe(3);
  });
});
