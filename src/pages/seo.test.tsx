import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Seo from "./seo";

const overviewUseQueryMock = vi.fn();
const keywordClustersUseQueryMock = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    seo: {
      overview: {
        useQuery: (...args: unknown[]) => overviewUseQueryMock(...args),
      },
      keywordClusters: {
        useQuery: (...args: unknown[]) => keywordClustersUseQueryMock(...args),
      },
    },
  },
}));

vi.mock("@/features/seo/overview-tab", () => ({
  OverviewTab: () => <div>Overview content</div>,
  PageDetailCard: () => <div>Page detail</div>,
  getPageAuditSummary: () => ({ issueCount: 0 }),
}));

vi.mock("@/features/seo/keywords-tab", () => ({
  KeywordsTab: () => <div>Keywords content</div>,
}));

vi.mock("@/features/seo/keyword-clusters-tab", () => ({
  KeywordClustersTab: () => <div>Keyword Clusters content</div>,
}));

vi.mock("@/features/seo/competitors-tab", () => ({
  CompetitorsTab: () => <div>Competitors content</div>,
}));

vi.mock("@/features/seo/geo-tab", () => ({
  GeoTab: () => <div>Geo content</div>,
}));

vi.mock("@/features/seo/backlinks-tab", () => ({
  BacklinksTab: () => <div>Backlinks content</div>,
}));

vi.mock("@/features/seo/analytics-tab", () => ({
  AnalyticsTab: () => <div>Analytics content</div>,
}));

describe("SEO page", () => {
  it("shows the keyword clusters tab and switches into the new view", () => {
    overviewUseQueryMock.mockReturnValue({
      data: {
        sites: [
          {
            id: 1,
            name: "KFD",
            domain: "kfd.com",
            pageCount: 10,
            clusterCount: 4,
            keywordCount: 100,
          },
        ],
        pages: [],
        clusters: [],
        competitors: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    keywordClustersUseQueryMock.mockReturnValue({
      data: { rows: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<Seo />);

    expect(screen.getByRole("button", { name: /keyword clusters/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /keyword clusters/i }));

    expect(screen.getByText("Keyword Clusters content")).toBeInTheDocument();
    expect(screen.queryByText("Keywords content")).not.toBeInTheDocument();
    expect(screen.queryByText("Overview content")).not.toBeInTheDocument();
  });
});
