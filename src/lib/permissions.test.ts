import { describe, expect, it } from "vitest";
import { canManageTeam } from "./permissions";

describe("canManageTeam", () => {
  it("allows organization admins and owners", () => {
    expect(canManageTeam({ organizationRole: "admin" })).toBe(true);
    expect(canManageTeam({ organizationRole: "owner" })).toBe(true);
  });

  it("allows platform admins even without an organization admin role", () => {
    expect(canManageTeam({ organizationRole: "member", userRole: "admin" })).toBe(true);
  });

  it("blocks regular members", () => {
    expect(canManageTeam({ organizationRole: "member", userRole: "user" })).toBe(false);
  });
});
