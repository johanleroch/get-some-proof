import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvitationManager } from "./invitation-manager";

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
}));

const defaultProps = {
  organizationId: "organization-1" as never,
  invitations: undefined,
  inviteOpen: false,
  onInviteOpenChange: vi.fn(),
  searchQuery: "",
  showList: true,
};

afterEach(cleanup);

describe("InvitationManager", () => {
  it("shows a stable invitation skeleton without leaking loading copy", () => {
    const { container } = render(<InvitationManager {...defaultProps} />);

    expect(screen.queryByText(/Loading Members/i)).toBeNull();
    expect(
      screen.getByRole("status", { name: "Loading Pending Invitations" }),
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll(".dashboard-skeleton").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("shows expired invitations with clear row actions", () => {
    render(
      <InvitationManager
        {...defaultProps}
        invitations={[
          {
            id: "invitation-1" as never,
            email: "expired@example.com",
            invitedByDisplayName: "Johan Le Roch",
            role: "viewer",
            status: "pending",
            deliveryStatus: "sent",
            expiresAt: Date.now() - 1,
            createdAt: Date.now() - 10_000,
            updatedAt: Date.now() - 10_000,
          },
        ]}
      />,
    );

    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });

  it("renders the invitation form as a focused dialog", () => {
    render(
      <InvitationManager
        {...defaultProps}
        invitations={[]}
        inviteOpen
        showList={false}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Invite people" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Initial role")).toBeInTheDocument();
  });
});
