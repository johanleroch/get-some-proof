import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrganizationMembers } from "./organization-members";

const mocks = vi.hoisted(() => ({ organization: undefined as unknown }));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.organization,
}));

vi.mock("@/components/members/member-directory", () => ({
  MemberDirectory: () => <div>Member directory</div>,
}));

vi.mock("@/components/invitations/invitation-manager", () => ({
  InvitationManager: () => <div>Invitation manager</div>,
}));

describe("OrganizationMembers", () => {
  it("reserves the final page geometry while the Organization loads", () => {
    const { container } = render(<OrganizationMembers slug="acme-1234" />);

    expect(screen.queryByText("Loading Members…", { exact: true })).toBeNull();
    expect(
      screen.getByRole("status", { name: "Loading Members" }),
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(5);
  });
});
