// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("openclaw/plugin-sdk/plugin-entry", () => ({
  definePluginEntry: (entry: unknown) => entry,
}));

import plugin from "./index";

type HookHandler = (
  event: Record<string, unknown>,
  meta: { agentId?: string; sessionKey?: string },
) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void;

function createPlugin() {
  const hooks = new Map<string, HookHandler>();

  plugin.register({
    on: (event, handler) => {
      hooks.set(event, handler as HookHandler);
    },
  });

  return { hooks };
}

describe("hq-webchat-context plugin", () => {
  it("injects the humanized HQ webchat user name", async () => {
    const { hooks } = createPlugin();

    const result = await hooks.get("before_prompt_build")!(
      { prompt: "hello", messages: [] },
      {
        sessionKey: "agent:main:hq:webchat:user:tanush-mahalka",
      },
    );

    expect(result).toEqual({
      prependSystemContext: "You are speaking with Tanush Mahalka right now.",
    });
  });

  it("skips unrelated sessions", async () => {
    const { hooks } = createPlugin();

    const result = await hooks.get("before_prompt_build")!(
      { prompt: "hello", messages: [] },
      {
        sessionKey: "agent:main:task:task-1",
      },
    );

    expect(result).toBeUndefined();
  });
});
