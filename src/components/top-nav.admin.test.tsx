import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("@/hooks/use-admin-view", () => ({
  useAdminView: () => ({
    isAdminView: true,
    setIsAdminView: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-messenger-panel", () => ({
  useMessengerPanel: () => ({
    toggleChat: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-any-agent-active", () => ({
  useAnyAgentActive: () => false,
}));

vi.mock("@/hooks/use-organization", () => ({
  useActiveMemberRole: () => ({
    data: { role: "admin" },
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: {
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
      },
      session: {
        activeOrganizationId: "org_123",
      },
    },
  }),
  signOut: vi.fn(),
}));

vi.mock("@/pages/custom/registry", () => ({
  default: [],
}));

describe("TopNav admin surfaces", () => {
  it("shows the Usage tab when admin view is enabled", async () => {
    const { TopNav } = await import("./top-nav");

    render(
      <MemoryRouter initialEntries={["/app/usage"]}>
        <TopNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /usage/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /db/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /agents/i })).not.toBeInTheDocument();
  });
});
