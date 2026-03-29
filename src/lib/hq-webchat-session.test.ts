import { describe, expect, it } from "vitest";
import {
  buildHqWebchatSessionKey,
  humanizeHqWebchatUserSlug,
  parseHqWebchatSessionKey,
  slugifyHqWebchatUserName,
} from "@shared/hq-webchat-session";

describe("hq-webchat-session", () => {
  it('slugifies "Tanush Mahalka" into "tanush-mahalka"', () => {
    expect(slugifyHqWebchatUserName("Tanush Mahalka")).toBe("tanush-mahalka");
  });

  it("builds and parses HQ webchat session keys", () => {
    const sessionKey = buildHqWebchatSessionKey({
      agentId: "agent-1",
      userName: "Tanush Mahalka",
    });

    expect(sessionKey).toBe("agent:agent-1:hq:webchat:user:tanush-mahalka");
    expect(parseHqWebchatSessionKey(sessionKey)).toEqual({
      agentId: "agent-1",
      userSlug: "tanush-mahalka",
      userName: "Tanush Mahalka",
    });
  });

  it('humanizes "tanush-mahalka" into "Tanush Mahalka"', () => {
    expect(humanizeHqWebchatUserSlug("tanush-mahalka")).toBe("Tanush Mahalka");
  });

  it("returns null for malformed session keys", () => {
    expect(parseHqWebchatSessionKey("agent:agent-1:webchat")).toBeNull();
    expect(parseHqWebchatSessionKey("agent:agent-1:hq:webchat:user:")).toBeNull();
    expect(parseHqWebchatSessionKey("agent:agent-1:hq:webchat:user:tanush_mahalka")).toBeNull();
  });
});
