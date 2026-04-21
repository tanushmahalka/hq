import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeywordClustersTab } from "./keyword-clusters-tab";
import type { SeoKeywordClustersData } from "./types";

const useQueryMock = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    seo: {
      keywordClusters: {
        useQuery: (...args: unknown[]) => useQueryMock(...args),
      },
    },
  },
}));

const baseData: SeoKeywordClustersData = {
  rows: [
    {
      id: 1,
      siteId: 1,
      title: "Low Intent Research",
      mattersForKfd: "Low",
      whyThisMatters: "Background research topic.",
      howThisCanHelp: "Helps with awareness.",
      representativeKeyword: "china trend report",
      keywords: ["china trend report"],
      keywordCount: 1,
      reviewedAt: new Date("2026-04-21T12:00:00.000Z"),
    },
    {
      id: 2,
      siteId: 1,
      title: "High Revenue Cluster",
      mattersForKfd: "High",
      whyThisMatters: "Strong service-intent cluster.",
      howThisCanHelp: "Supports lead generation.",
      representativeKeyword: "china influencer agency",
      keywords: ["china influencer agency", "kol agency china"],
      keywordCount: 2,
      reviewedAt: new Date("2026-04-21T12:00:00.000Z"),
    },
    {
      id: 3,
      siteId: 1,
      title: "Medium Opportunity Cluster",
      mattersForKfd: "Medium",
      whyThisMatters: "Useful comparison cluster.",
      howThisCanHelp: "Supports commercial education.",
      representativeKeyword: "baidu vs google china",
      keywords: ["baidu vs google china"],
      keywordCount: 1,
      reviewedAt: new Date("2026-04-21T12:00:00.000Z"),
    },
  ],
};

describe("KeywordClustersTab", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue({
      data: baseData,
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("renders cards sorted by importance by default", () => {
    render(<KeywordClustersTab siteId={1} />);

    const cards = screen.getAllByTestId("keyword-cluster-card");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("High Revenue Cluster");
    expect(cards[1]).toHaveTextContent("Medium Opportunity Cluster");
    expect(cards[2]).toHaveTextContent("Low Intent Research");
  });

  it("filters cards by title search", () => {
    render(<KeywordClustersTab siteId={1} />);

    fireEvent.change(screen.getByLabelText("Search cluster titles"), {
      target: { value: "medium" },
    });

    const cards = screen.getAllByTestId("keyword-cluster-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("Medium Opportunity Cluster");
  });

  it("shows detail content when a card is selected", () => {
    render(<KeywordClustersTab siteId={1} />);

    fireEvent.click(screen.getByText("High Revenue Cluster"));

    const detail = within(screen.getByTestId("keyword-cluster-detail"));

    expect(detail.getByText("Why this cluster is important")).toBeInTheDocument();
    expect(detail.getByText("Strong service-intent cluster.")).toBeInTheDocument();
    expect(detail.getByText("How this can help")).toBeInTheDocument();
    expect(detail.getByText("Supports lead generation.")).toBeInTheDocument();
    expect(detail.getByRole("columnheader", { name: "Keyword" })).toBeInTheDocument();
    expect(detail.getByText("kol agency china")).toBeInTheDocument();
    expect(detail.getByRole("button", { name: "Overview" })).toBeInTheDocument();
  });
});
