import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AGENT_LIST_API } from "../worker/trpc/procedures/custom/agent-list-spec.ts";

const OUT_PATH = path.join(process.cwd(), "docs", "agent-lists-api.md");

function codeBlock(lang: string, body: string): string {
  return "```" + lang + "\n" + body + "\n```";
}

function buildDoc(): string {
  const lines: string[] = [];

  lines.push("# Agent Lists API");
  lines.push("");
  lines.push(
    "> Generated from the tRPC Zod schemas. Do not edit by hand — run `npm run docs:agent-list-api`.",
  );
  lines.push(
    "> The same definitions are served live at `custom.agentList.apiSchema`, which always reflects the deployed code.",
  );
  lines.push("");
  lines.push(
    "Agent lists are flexible, agent-created tables. See `docs/agent-lists.md` for the data model and `json_schema` conventions.",
  );
  lines.push("");

  lines.push("## Connection");
  lines.push("");
  lines.push("- **Base URL**: `/api/trpc`");
  lines.push("- **Auth**: `Authorization: Bearer <AGENT_API_TOKEN>` header");
  lines.push("- **Transport**: tRPC v11 with the superjson transformer.");
  lines.push(
    "  - **Query**: `GET /api/trpc/<method>?input=<urlencoded JSON>` where the JSON is `{\"json\": <args>}`.",
  );
  lines.push(
    "  - **Mutation**: `POST /api/trpc/<method>` with header `Content-Type: application/json` and body `{\"json\": <args>}`.",
  );
  lines.push("  - The result is at `result.data.json` in the response body.");
  lines.push("");
  lines.push("Example mutation:");
  lines.push("");
  lines.push(
    codeBlock(
      "bash",
      [
        "curl -X POST https://<host>/api/trpc/custom.agentList.addRow \\",
        '  -H "Authorization: Bearer $AGENT_API_TOKEN" \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '{"json":{"listId":1,"data":{"founder_name":"Jane Doe","company":"Acme AI"}}}'`,
      ].join("\n"),
    ),
  );
  lines.push("");

  lines.push("## Row shape");
  lines.push("");
  lines.push(
    "A row's `data` keys come from its parent list's `json_schema.properties`. " +
      "Fetch a list with `custom.agentList.get` to learn its columns before adding rows, " +
      "and keep every row aligned with that schema.",
  );
  lines.push("");

  lines.push("## Operations");
  lines.push("");

  for (const op of AGENT_LIST_API) {
    lines.push(`### \`${op.method}\``);
    lines.push("");
    lines.push(`**${op.type}** — ${op.summary}`);
    lines.push("");
    lines.push("Input schema:");
    lines.push("");
    const jsonSchema = z.toJSONSchema(op.input);
    lines.push(codeBlock("json", JSON.stringify(jsonSchema, null, 2)));
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const doc = buildDoc();
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, doc, "utf8");
  console.log(`Wrote ${OUT_PATH} (${AGENT_LIST_API.length} operations).`);
}

main();
