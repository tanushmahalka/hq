import { CliError } from "../../core/errors.ts";
import type { ResolvedOpenRouterProviderConfig } from "../../types/config.ts";

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const DEFAULT_REFERER = "https://hq.kungfudata.com";
const DEFAULT_TITLE = "SEO CLI";

export interface KeywordClassification {
  query: string;
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
        "You are a seo keyword classifier. Return exactly one token: true or false. Do not return JSON. Do not explain.",
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
  const normalized = raw.trim().toLowerCase();

  if (normalized !== "true" && normalized !== "false") {
    throw new CliError(
      `OpenRouter classification for query "${query}" must be exactly \`true\` or \`false\`, received: ${
        raw.trim() || "(empty)"
      }.`
    );
  }

  return {
    query,
    relevant: normalized === "true",
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return "";
  }
}
