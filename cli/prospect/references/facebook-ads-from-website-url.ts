import { spawn } from "node:child_process";

import { chromium } from "playwright";

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

type SearchResultsConnection = {
  count?: number;
  edges?: Array<{
    node?: {
      collated_results?: AdResult[];
    };
  }>;
};

type TextField = string | { text?: string | null } | null | undefined;

type AdCard = {
  body?: string | null;
  cta_type?: string | null;
  caption?: string | null;
  link_description?: string | null;
  link_url?: string | null;
  title?: string | null;
  cta_text?: string | null;
  video_hd_url?: string | null;
  video_preview_image_url?: string | null;
  video_sd_url?: string | null;
  original_image_url?: string | null;
  resized_image_url?: string | null;
  watermarked_resized_image_url?: string | null;
};

type AdSnapshot = {
  body?: TextField;
  caption?: TextField;
  cta_text?: TextField;
  cta_type?: string | null;
  display_format?: string | null;
  link_description?: TextField;
  link_url?: string | null;
  title?: TextField;
  cards?: AdCard[] | null;
  page_name?: string | null;
  page_profile_uri?: string | null;
};

type AdResult = {
  ad_archive_id?: string | number | null;
  page_id?: string | number | null;
  page_name?: string | null;
  is_active?: boolean | null;
  start_date?: number | null;
  end_date?: number | null;
  publisher_platform?: string[] | null;
  targeted_or_reached_countries?: string[] | null;
  snapshot?: AdSnapshot | null;
};

type FlattenedAd = {
  adArchiveId: string;
  adLibraryUrl: string;
  pageId: string;
  pageName: string | null;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  publisherPlatforms: string[];
  countries: string[];
  displayFormat: string | null;
  body: string | null;
  title: string | null;
  caption: string | null;
  linkDescription: string | null;
  linkUrl: string | null;
  ctaText: string | null;
  ctaType: string | null;
  cards: AdCard[];
  pageProfileUri: string | null;
};

type DebugLogger = (label: string, value?: unknown) => void;

const CHROME_CANDIDATES = [
  process.env.FACEBOOK_ADS_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
].filter(Boolean) as string[];

function usage(): never {
  console.error(
    "Usage: node ./cli/prospect/references/facebook-ads-from-website-url.ts <website-url> [--debug]",
  );
  process.exit(1);
}

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const debug = rawArgs.includes("--debug");
  const websiteUrl = rawArgs.find((arg) => !arg.startsWith("--"));

  if (!websiteUrl) usage();

  return { websiteUrl, debug };
}

function normalizeWebsiteUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) usage();
  return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
}

function normalizeFacebookUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) throw new Error("Missing Facebook URL.");

  const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  if (!/(^|\.)facebook\.com$/i.test(url.hostname) && !/(^|\.)fb\.com$/i.test(url.hostname)) {
    throw new Error("Input must be a facebook.com URL.");
  }

  const pSlugMatch = url.pathname.match(/^\/p\/[^/]*-(\d{6,})\/?$/i);
  if (pSlugMatch) {
    url.pathname = `/${pSlugMatch[1]}`;
    url.search = "";
  }

  url.hash = "";
  return url;
}

function buildTransparencyUrl(pageUrl: URL): string {
  const base = new URL(pageUrl.toString());
  base.search = "";
  base.hash = "";

  const path = base.pathname.replace(/\/+$/, "");
  if (path.endsWith("/about_profile_transparency")) {
    base.pathname = path;
    return base.toString();
  }

  base.pathname = `${path || ""}/about_profile_transparency`;
  return base.toString();
}

function extractMetaTag(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.groups?.content?.trim();
    if (value) return decodeHtml(value);
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

function extractBalancedJsonObject(text: string, startPos: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startPos; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }

    if (char === "\"") inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(startPos, index + 1);
    }
  }

  return null;
}

function extractPageIdFromTransparencyText(text: string): string | null {
  const match = text.match(/(\d{6,})\s*Page ID/i);
  return match?.[1] ?? null;
}

function unwrapTextField(value: TextField): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.text === "string") return value.text;
  return null;
}

function toIsoDate(unixSeconds?: number | null): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

function flattenAds(connection: SearchResultsConnection): FlattenedAd[] {
  const collatedResults =
    connection.edges?.flatMap((edge) => edge.node?.collated_results ?? []) ?? [];

  return collatedResults
    .filter((result) => result?.is_active)
    .map((result) => {
      const adArchiveId = String(result.ad_archive_id ?? "");
      const pageId = String(result.page_id ?? "");
      const snapshot = result.snapshot ?? null;

      return {
        adArchiveId,
        adLibraryUrl: `https://www.facebook.com/ads/library/?id=${adArchiveId}`,
        pageId,
        pageName: result.page_name ?? snapshot?.page_name ?? null,
        isActive: Boolean(result.is_active),
        startDate: toIsoDate(result.start_date),
        endDate: toIsoDate(result.end_date),
        publisherPlatforms: result.publisher_platform ?? [],
        countries: result.targeted_or_reached_countries ?? [],
        displayFormat: snapshot?.display_format ?? null,
        body: unwrapTextField(snapshot?.body),
        title: unwrapTextField(snapshot?.title),
        caption: unwrapTextField(snapshot?.caption),
        linkDescription: unwrapTextField(snapshot?.link_description),
        linkUrl: snapshot?.link_url ?? null,
        ctaText: unwrapTextField(snapshot?.cta_text),
        ctaType: snapshot?.cta_type ?? null,
        cards: snapshot?.cards ?? [],
        pageProfileUri: snapshot?.page_profile_uri ?? null,
      };
    });
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

function maskSecret(value: string | null | undefined): string {
  if (!value) return "missing";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function launchBrowser() {
  const executablePath = CHROME_CANDIDATES.find(Boolean);

  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
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
      ["./meta_page_probe.py", websiteUrl, "--provider", "tavily", "--max-results", "8"],
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
  if (!text) throw new Error("Gemini returned an empty response.");

  debug("geminiRawText", text);

  const parsed = JSON.parse(text) as RankedFacebookPage;
  return {
    selectedUrl: parsed.selectedUrl,
    confidence: Number(parsed.confidence ?? 0),
    reasoning: parsed.reasoning ?? "",
  };
}

async function resolveAdLibraryPageId(pageUrl: URL): Promise<string | null> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage({ locale: "en-US" });
    await page.goto(buildTransparencyUrl(pageUrl), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(8_000);
    const bodyText = await page.locator("body").innerText();
    return extractPageIdFromTransparencyText(bodyText);
  } finally {
    await browser.close();
  }
}

async function fetchActiveAdsByPageId(pageId: string): Promise<FlattenedAd[]> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage({ locale: "en-US" });
    const adLibraryUrl = new URL("https://www.facebook.com/ads/library/");
    adLibraryUrl.searchParams.set("active_status", "active");
    adLibraryUrl.searchParams.set("ad_type", "all");
    adLibraryUrl.searchParams.set("country", "ALL");
    adLibraryUrl.searchParams.set("view_all_page_id", pageId);
    adLibraryUrl.searchParams.set("search_type", "page");
    adLibraryUrl.searchParams.set("media_type", "all");

    await page.goto(adLibraryUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(8_000);

    const html = await page.content();
    const key = "\"search_results_connection\":{";
    const markerIndex = html.indexOf(key);
    if (markerIndex === -1) return [];

    const objectStart = html.indexOf("{", markerIndex);
    const jsonObject = extractBalancedJsonObject(html, objectStart);
    if (!jsonObject) return [];

    const connection = JSON.parse(jsonObject) as SearchResultsConnection;
    return flattenAds(connection);
  } finally {
    await browser.close();
  }
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

  if (probeOutput.error) throw new Error(probeOutput.error);

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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
