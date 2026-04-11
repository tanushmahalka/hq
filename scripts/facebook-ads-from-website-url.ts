import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  fetchActiveAdsByPageId,
  normalizeFacebookUrl,
  resolveAdLibraryPageId,
  type FlattenedAd,
} from "./facebook-ads-from-page-url.ts";

type SiteMetadata = {
  url: string;
  title: string | null;
  description: string | null;
};

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

type MetaPageProbeOutput = {
  provider?: string;
  input?: string;
  host?: string;
  query?: string;
  results?: TavilyResult[];
  error?: string;
};

type RankedFacebookPage = {
  selectedUrl: string | null;
  confidence: number;
  reasoning: string;
};

type DebugLogger = (label: string, value?: unknown) => void;

function usage(): never {
  console.error(
    "Usage: bun run facebook:ads:from-website -- <website-url> [--debug]",
  );
  process.exit(1);
}

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const debug = rawArgs.includes("--debug");
  const websiteUrl = rawArgs.find((arg) => !arg.startsWith("--"));

  if (!websiteUrl) {
    usage();
  }

  return {
    websiteUrl,
    debug,
  };
}

function normalizeWebsiteUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) usage();
  return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
}

function extractMetaTag(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.groups?.content?.trim();
    if (value) {
      return decodeHtml(value);
    }
  }

  return null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchSiteMetadata(websiteUrl: URL): Promise<SiteMetadata> {
  const response = await fetch(websiteUrl.toString(), {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; FacebookAdsResolver/1.0)",
    },
  });

  const html = await response.text();
  const titleMatch = html.match(/<title[^>]*>(?<content>[\s\S]*?)<\/title>/i);
  const title = titleMatch?.groups?.content
    ? decodeHtml(titleMatch.groups.content.replace(/\s+/g, " ").trim())
    : null;

  const description = extractMetaTag(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["'](?<content>[^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["'](?<content>[^"']+)["'][^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["'](?<content>[^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["'](?<content>[^"']+)["'][^>]+property=["']og:description["'][^>]*>/i,
  ]);

  return {
    url: websiteUrl.toString(),
    title,
    description,
  };
}

async function runMetaPageProbe(websiteUrl: string): Promise<MetaPageProbeOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        "./meta_page_probe.py",
        websiteUrl,
        "--provider",
        "tavily",
        "--max-results",
        "8",
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => reject(error));

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `meta_page_probe.py exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as MetaPageProbeOutput);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function getGeminiApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!key) {
    throw new Error(
      "Missing Gemini API key. Set GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.",
    );
  }

  return key;
}

function maskSecret(value: string | null | undefined): string {
  if (!value) return "missing";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function rankFacebookCandidatesWithGemini(
  siteMetadata: SiteMetadata,
  candidates: TavilyResult[],
  debug: DebugLogger,
): Promise<RankedFacebookPage> {
  const apiKey = getGeminiApiKey();
  const model = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = [
    "You are selecting the most likely official Facebook page for a brand.",
    "Return JSON only with keys: selectedUrl, confidence, reasoning.",
    "If none of the candidates look like the official brand page, set selectedUrl to null.",
    "",
    `Website URL: ${siteMetadata.url}`,
    `Website title: ${siteMetadata.title ?? ""}`,
    `Website meta description: ${siteMetadata.description ?? ""}`,
    "",
    "Candidate Facebook search results:",
    JSON.stringify(
      candidates.map((candidate, index) => ({
        index,
        url: candidate.url ?? null,
        title: candidate.title ?? null,
        snippet: candidate.content ?? null,
        score: candidate.score ?? null,
      })),
      null,
      2,
    ),
    "",
    "Pick the closest official Facebook page for the same brand/domain.",
    "Prefer candidates whose brand, domain, and description align strongly with the website metadata.",
  ].join("\n");

  debug("geminiRequestMeta", {
    model,
    endpoint: endpoint.replace(apiKey, maskSecret(apiKey)),
    candidateCount: candidates.length,
    promptPreview: prompt.slice(0, 900),
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    debug("geminiErrorResponse", json);
    throw new Error(json.error?.message ?? `Gemini request failed with status ${response.status}`);
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  debug("geminiRawText", text);

  const parsed = JSON.parse(text) as RankedFacebookPage;
  return {
    selectedUrl: parsed.selectedUrl,
    confidence: Number(parsed.confidence ?? 0),
    reasoning: parsed.reasoning ?? "",
  };
}

function debugLog(debug: boolean, label: string, value?: unknown) {
  if (!debug) return;
  if (typeof value === "undefined") {
    console.error(`[debug] ${label}`);
    return;
  }
  console.error(`[debug] ${label}: ${typeof value === "string" ? value : JSON.stringify(value, null, 2)}`);
}

function createDebugLogger(debug: boolean): DebugLogger {
  return (label, value) => debugLog(debug, label, value);
}

async function resolveFacebookPageUrlFromWebsite(
  websiteUrl: URL,
  debug: boolean,
): Promise<string | null> {
  const log = createDebugLogger(debug);
  log("resolveFacebookPageUrlFromWebsite:start", {
    websiteUrl: websiteUrl.toString(),
    tavilyApiKey: maskSecret(process.env.TAVILY_API_KEY),
    geminiApiKey: maskSecret(
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEY ??
      process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    ),
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview",
  });

  const siteMetadata = await fetchSiteMetadata(websiteUrl);
  log("siteMetadata", siteMetadata);

  const probeOutput = await runMetaPageProbe(websiteUrl.toString());
  log("metaPageProbeOutput", {
    provider: probeOutput.provider,
    query: probeOutput.query,
    resultCount: probeOutput.results?.length ?? 0,
    error: probeOutput.error ?? null,
  });
  if (probeOutput.error) {
    throw new Error(probeOutput.error);
  }

  const candidates = (probeOutput.results ?? []).filter((result) => {
    const url = result.url ?? "";
    return /facebook\.com/i.test(url);
  });

  log("facebookCandidates", candidates);

  if (candidates.length === 0) {
    log("facebookCandidates:noneFound");
    return null;
  }

  const ranked = await rankFacebookCandidatesWithGemini(siteMetadata, candidates, log);
  log("geminiRanking", ranked);

  if (!ranked.selectedUrl) {
    log("geminiRanking:noSelection");
    return null;
  }

  return normalizeFacebookUrl(ranked.selectedUrl).toString();
}

async function resolveAdsFromWebsiteUrl(websiteUrl: URL, debug: boolean): Promise<FlattenedAd[]> {
  const log = createDebugLogger(debug);
  log("resolveAdsFromWebsiteUrl:start", { websiteUrl: websiteUrl.toString() });

  const facebookPageUrl = await resolveFacebookPageUrlFromWebsite(websiteUrl, debug);
  log("facebookPageUrl", facebookPageUrl);

  if (!facebookPageUrl) {
    log("resolveAdsFromWebsiteUrl:noFacebookPageUrl");
    return [];
  }

  const adLibraryPageId = await resolveAdLibraryPageId(normalizeFacebookUrl(facebookPageUrl));
  log("adLibraryPageId", adLibraryPageId);

  if (!adLibraryPageId) {
    log("resolveAdsFromWebsiteUrl:noAdLibraryPageId");
    return [];
  }

  const ads = await fetchActiveAdsByPageId(adLibraryPageId);
  log("adsResultSummary", {
    adCount: ads.length,
    firstAdArchiveId: ads[0]?.adArchiveId ?? null,
  });
  return ads;
}

async function main() {
  const { websiteUrl, debug } = parseArgs();
  const ads = await resolveAdsFromWebsiteUrl(normalizeWebsiteUrl(websiteUrl), debug);
  console.log(JSON.stringify(ads, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
