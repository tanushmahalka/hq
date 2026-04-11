import { readConfig, resolveConfig } from "../core/config.ts";
import { printJson, printLine } from "../core/output.ts";

export async function runProvidersCommand(argv: string[]): Promise<void> {
  const [action = "help"] = argv;

  if (action === "list") {
    const resolved = resolveConfig(await readConfig());
    const payload = {
      providers: [
        {
          id: "apollo",
          configured: Boolean(resolved.providers.apollo.apiKey),
          baseUrl: resolved.providers.apollo.baseUrl,
        },
      ],
    };

    printJson(payload);
    return;
  }

  printLine("Prospect providers commands");
  printLine("");
  printLine("Usage:");
  printLine("  prospect providers list");
}
