import type { MarketingAssetRecord } from "./marketing-asset.ts";

const PDF_RENDER_TIMEOUT_MS = 30_000;
const PDF_FALLBACK_FORMAT = "A4";

export class MarketingAssetPdfError extends Error {
  constructor(message = "Failed to generate PDF.") {
    super(message);
    this.name = "MarketingAssetPdfError";
  }
}

function sanitizeFilenameSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildMarketingAssetPdfFilename(
  asset: Pick<MarketingAssetRecord, "id" | "slug">,
): string {
  const baseName = sanitizeFilenameSegment(asset.slug ?? "");
  return `${baseName || `ebook-${asset.id}`}.pdf`;
}

export async function renderMarketingAssetPdf(html: string): Promise<Uint8Array> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(PDF_RENDER_TIMEOUT_MS);
      page.setDefaultTimeout(PDF_RENDER_TIMEOUT_MS);

      // Use print media so the ebook's @page and @media print rules can
      // collapse screen-only spacing and paginate cleanly.
      await page.emulateMedia({ media: "print" });
      await page.setContent(html, { waitUntil: "networkidle", timeout: PDF_RENDER_TIMEOUT_MS });

      return await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        format: PDF_FALLBACK_FORMAT,
        margin: {
          top: "0",
          right: "0",
          bottom: "0",
          left: "0",
        },
      });
    } finally {
      await browser.close();
    }
  } catch {
    throw new MarketingAssetPdfError("Failed to generate PDF.");
  }
}
