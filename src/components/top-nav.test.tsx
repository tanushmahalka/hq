import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("@/hooks/use-admin-view", () => ({
  useAdminView: () => ({
    isAdminView: false,
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
    data: { role: "member" },
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: {
        name: "Taylor User",
        email: "taylor@example.com",
        role: "user",
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

describe("TopNav", () => {
  it("shows the Files tab for non-admin members", async () => {
    const { TopNav } = await import("./top-nav");

    render(
      <MemoryRouter initialEntries={["/app/files"]}>
        <TopNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /marketing/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /files/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /agents/i })).not.toBeInTheDocument();
  });
});
