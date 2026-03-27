import { CliError } from "../../core/errors.ts";
import type { ResolvedOpenRouterProviderConfig } from "../../types/config.ts";

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";
const DEFAULT_REFERER = "https://hq.kungfudata.com";
const DEFAULT_TITLE = "SEO CLI";

export interface KeywordClassification {
  query: string;
  rationale: string;
  relevant: boolean;
}

export interface ClassifyKeywordOptions {
  query: string;
  brandOverview: string;
  model?: string;
}

export interface OpenRouterClientOptions {
  config: ResolvedOpenRouterProviderConfig;
  fetchImpl?: typeof fetch;
  referer?: string;
  title?: string;
}

interface OpenRouterChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

export class OpenRouterClient {
  private readonly config: ResolvedOpenRouterProviderConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly referer: string;
  private readonly title: string;

  constructor(options: OpenRouterClientOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.referer = options.referer ?? DEFAULT_REFERER;
    this.title = options.title ?? DEFAULT_TITLE;
  }

  async classifyKeyword(
    options: ClassifyKeywordOptions
  ): Promise<KeywordClassification> {
    const response = await this.fetchImpl(
      `${this.config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": this.referer,
          "X-OpenRouter-Title": this.title,
        },
        body: JSON.stringify({
          model: options.model ?? DEFAULT_MODEL,
          response_format: { type: "json_object" },
          messages: buildClassifierMessages(
            options.query,
            options.brandOverview
          ),
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await safeReadText(response);
      const retryAfter = response.headers.get("retry-after");
      const details = errorBody ? ` ${errorBody}` : "";
      const retrySuffix = retryAfter
        ? ` Retry after ${retryAfter} second(s).`
        : "";

      throw new CliError(
        `OpenRouter request failed with ${response.status}.${retrySuffix}${details}`.trim()
      );
    }

    const payload = (await response.json()) as OpenRouterChatCompletionResponse;
    const content = extractCompletionText(payload);

    if (!content) {
      throw new CliError("OpenRouter returned an empty completion.");
    }

    return parseClassification(content, options.query);
  }
}

function buildClassifierMessages(
  query: string,
  brandOverview: string
): Array<{ role: string; content: string }> {
  return [
    {
      role: "system",
      content:
        "You are a seo keyword classifier. Return strict JSON with exactly two keys: rationale and isRelevant. rationale must be a short string. isRelevant must be a boolean. Do not return any other keys.",
    },
    {
      role: "user",
      content: [
        "You are a seo keyword classifier, you take this keyword and classify if its relevent for the brand or not.",
        `Here is about the brand: ${brandOverview}`,
        'The primary question you should ask yourself while classifying is: "If we ranked #1 for this query, would the traffic be valuable to our business?"',
        `Keyword: ${query}`,
        `Your response:`,
      ].join("\n\n"),
    },
  ];
}

function extractCompletionText(
  payload: OpenRouterChatCompletionResponse
): string {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  if (payload.error?.message) {
    throw new CliError(payload.error.message);
  }

  return "";
}

function parseClassification(
  raw: string,
  query: string
): KeywordClassification {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CliError(
      `Failed to parse OpenRouter classification JSON for query "${query}": ${(error as Error).message}`
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CliError(
      `OpenRouter classification for query "${query}" was not a JSON object.`
    );
  }

  const rationale = (parsed as { rationale?: unknown }).rationale;
  const isRelevant = (parsed as { isRelevant?: unknown }).isRelevant;

  if (typeof rationale !== "string" || !rationale.trim()) {
    throw new CliError(
      `OpenRouter classification for query "${query}" did not include a non-empty \`rationale\` field.`
    );
  }

  if (typeof isRelevant !== "boolean") {
    throw new CliError(
      `OpenRouter classification for query "${query}" did not include a boolean \`isRelevant\` field.`
    );
  }

  return {
    query,
    rationale: rationale.trim(),
    relevant: isRelevant,
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return "";
  }
}
