import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMarketingAssetPdfFilename,
  MarketingAssetPdfError,
  renderMarketingAssetPdf,
} from "../../worker/lib/marketing-asset-pdf.ts";

const launchMock = vi.fn();
const newPageMock = vi.fn();
const closeMock = vi.fn();
const setDefaultNavigationTimeoutMock = vi.fn();
const setDefaultTimeoutMock = vi.fn();
const emulateMediaMock = vi.fn();
const setContentMock = vi.fn();
const pdfMock = vi.fn();

vi.mock("playwright", () => ({
  chromium: {
    launch: launchMock,
  },
}));

describe("marketing asset pdf helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    newPageMock.mockResolvedValue({
      setDefaultNavigationTimeout: setDefaultNavigationTimeoutMock,
      setDefaultTimeout: setDefaultTimeoutMock,
      emulateMedia: emulateMediaMock,
      setContent: setContentMock,
      pdf: pdfMock,
    });

    closeMock.mockResolvedValue(undefined);
    launchMock.mockResolvedValue({
      newPage: newPageMock,
      close: closeMock,
    });
  });

  it("renders HTML to PDF with the expected playwright settings", async () => {
    const pdfBytes = new Uint8Array([1, 2, 3]);
    pdfMock.mockResolvedValue(pdfBytes);

    await expect(renderMarketingAssetPdf("<html><body>Hello</body></html>")).resolves.toBe(
      pdfBytes,
    );

    expect(launchMock).toHaveBeenCalledWith({ headless: true });
    expect(setDefaultNavigationTimeoutMock).toHaveBeenCalledWith(30_000);
    expect(setDefaultTimeoutMock).toHaveBeenCalledWith(30_000);
    expect(emulateMediaMock).toHaveBeenCalledWith({ media: "print" });
    expect(setContentMock).toHaveBeenCalledWith("<html><body>Hello</body></html>", {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    expect(pdfMock).toHaveBeenCalledWith({
      printBackground: true,
      preferCSSPageSize: true,
      format: "A4",
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("wraps playwright failures in a user-safe error", async () => {
    launchMock.mockRejectedValue(new Error("browser missing"));

    await expect(renderMarketingAssetPdf("<html />")).rejects.toBeInstanceOf(
      MarketingAssetPdfError,
    );
    await expect(renderMarketingAssetPdf("<html />")).rejects.toThrow(
      "Failed to generate PDF.",
    );
  });

  it("builds a slug-based filename with an id fallback", () => {
    expect(buildMarketingAssetPdfFilename({ id: 42, slug: "weekly-brief" })).toBe(
      "weekly-brief.pdf",
    );
    expect(buildMarketingAssetPdfFilename({ id: 42, slug: "   " })).toBe(
      "ebook-42.pdf",
    );
  });
});
