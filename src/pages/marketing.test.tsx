import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastErrorMock = vi.fn();
const useUtilsMock = vi.fn();
const listUseQueryMock = vi.fn();
const getUseQueryMock = vi.fn();
const revisionsUseQueryMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => useUtilsMock(),
    marketing: {
      asset: {
        list: {
          useQuery: (...args: unknown[]) => listUseQueryMock(...args),
        },
        get: {
          useQuery: (...args: unknown[]) => getUseQueryMock(...args),
        },
        revisions: {
          useQuery: (...args: unknown[]) => revisionsUseQueryMock(...args),
        },
      },
    },
  },
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("Marketing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useUtilsMock.mockReturnValue({
      marketing: {
        asset: {
          list: { invalidate: vi.fn() },
          get: { invalidate: vi.fn() },
          revisions: { invalidate: vi.fn() },
        },
      },
    });

    listUseQueryMock.mockReturnValue({
      data: [
        {
          id: 1,
          title: "Weekly Brief",
          slug: "weekly-brief",
          status: "draft",
          description: "Latest marketing ebook.",
          currentVersion: 3,
          updatedAt: "2026-03-18T12:00:00.000Z",
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    });

    getUseQueryMock.mockReturnValue({
      data: {
        id: 1,
        title: "Weekly Brief",
        slug: "weekly-brief",
        status: "draft",
        currentVersion: 3,
        updatedAt: "2026-03-18T12:00:00.000Z",
        lastUpdateSource: "agent",
        storagePath: "/tmp/weekly-brief/index.html",
      },
      isLoading: false,
    });

    revisionsUseQueryMock.mockReturnValue({
      data: [],
      isLoading: false,
    });

    class EventSourceMock {
      onopen: (() => void) | null = null;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(_url: string) {}

      close() {}
    }

    vi.stubGlobal("EventSource", EventSourceMock);
    vi.stubGlobal("fetch", vi.fn());

    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: vi.fn(() => "blob:marketing-pdf"),
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: vi.fn(),
    });
  });

  it("downloads the selected ebook pdf and shows a loading state during export", async () => {
    const deferred = createDeferred<Response>();
    vi.mocked(fetch).mockReturnValue(deferred.promise);

    const realCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | null = null;
    let anchorClickSpy: ReturnType<typeof vi.spyOn> | null = null;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation(((tagName: string) => {
        const element = realCreateElement(tagName);
        if (tagName.toLowerCase() === "a") {
          createdAnchor = element as HTMLAnchorElement;
          anchorClickSpy = vi.spyOn(createdAnchor, "click").mockImplementation(() => {});
        }
        return element;
      }) as typeof document.createElement);

    const { default: Marketing } = await import("./marketing");

    render(<Marketing />);

    const button = await screen.findByRole("button", { name: "Download PDF" });
    fireEvent.click(button);

    expect(fetch).toHaveBeenCalledWith("/api/marketing/assets/1/pdf", {
      credentials: "include",
    });
    expect(screen.getByRole("button", { name: "Downloading..." })).toBeDisabled();

    deferred.resolve(
      new Response(new Blob(["pdf"], { type: "application/pdf" }), {
        status: 200,
        headers: {
          "content-disposition": 'attachment; filename="weekly-brief.pdf"',
        },
      }),
    );

    await waitFor(() =>
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1),
    );
    expect(createdAnchor).not.toBeNull();
    expect(anchorClickSpy).not.toBeNull();
    if (!createdAnchor || !anchorClickSpy) {
      throw new Error("Expected the PDF download anchor to be created.");
    }
    const anchor = createdAnchor as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("weekly-brief.pdf");
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:marketing-pdf");

    createElementSpy.mockRestore();
  });

  it("shows a toast when the pdf export fails", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "Failed to generate PDF." }), {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    const { default: Marketing } = await import("./marketing");

    render(<Marketing />);

    fireEvent.click(await screen.findByRole("button", { name: "Download PDF" }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to download PDF", {
        description: "Failed to generate PDF.",
      }),
    );
  });
});
