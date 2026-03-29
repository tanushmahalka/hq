import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { parseHqWebchatSessionKey } from "../../shared/hq-webchat-session.ts";

interface PluginAPI {
  on: (
    hookName: string,
    handler: (
      event: Record<string, unknown>,
      ctx: { agentId?: string; sessionKey?: string }
    ) =>
      | Promise<Record<string, unknown> | void>
      | Record<string, unknown>
      | void,
    opts?: { priority?: number }
  ) => void;
}

export default definePluginEntry({
  id: "hq-webchat-context",
  name: "HQ Webchat Context",
  description: "Injects the current HQ webchat user name into prompt context.",
  register(api: PluginAPI) {
    api.on("before_prompt_build", async (_event, ctx) => {
      if (!ctx.sessionKey) {
        return;
      }

      const parsed = parseHqWebchatSessionKey(ctx.sessionKey);
      if (!parsed) {
        return;
      }

      return {
        prependSystemContext: `You are speaking with ${parsed.userName} right now.  ( At the start of the session make sure to read /home/ubuntu/.openclaw/shared/company/employees.md, so you know who you are talking to and in which context and language you should talk with me )`,
      };
    });
  },
});
