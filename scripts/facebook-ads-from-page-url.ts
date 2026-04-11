import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

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
  images?: unknown[] | null;
  videos?: unknown[] | null;
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

export type FlattenedAd = {
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

const CHROME_CANDIDATES = [
  process.env.FACEBOOK_ADS_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
].filter(Boolean) as string[];

function usage(): never {
  console.error("Usage: bun run facebook:ads -- <facebook-page-url>");
  process.exit(1);
}

export function normalizeFacebookUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) usage();
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

function extractBalancedJsonObject(text: string, startPos: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startPos; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startPos, index + 1);
      }
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
  if (value && typeof value === "object" && typeof value.text === "string") {
    return value.text;
  }
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

async function launchBrowser() {
  const executablePath = CHROME_CANDIDATES.find(Boolean);

  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}

export async function resolveAdLibraryPageId(pageUrl: URL): Promise<string | null> {
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

export async function fetchActiveAdsByPageId(pageId: string): Promise<FlattenedAd[]> {
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

    if (markerIndex === -1) {
      return [];
    }

    const objectStart = html.indexOf("{", markerIndex);
    const jsonObject = extractBalancedJsonObject(html, objectStart);

    if (!jsonObject) {
      return [];
    }

    const connection = JSON.parse(jsonObject) as SearchResultsConnection;
    return flattenAds(connection);
  } finally {
    await browser.close();
  }
}

async function main() {
  const pageUrlArg = process.argv[2];
  if (!pageUrlArg) usage();

  const pageUrl = normalizeFacebookUrl(pageUrlArg);
  const adLibraryPageId = await resolveAdLibraryPageId(pageUrl);

  if (!adLibraryPageId) {
    console.log("[]");
    return;
  }

  const ads = await fetchActiveAdsByPageId(adLibraryPageId);
  console.log(JSON.stringify(ads, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
