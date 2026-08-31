import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InvitationManager } from "./invitation-manager";

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));

describe("InvitationManager", () => {
  it("shows a stable invitation skeleton without leaking loading copy", () => {
    const { container } = render(
      <InvitationManager organizationId={"organization-1" as never} />,
    );

    expect(screen.queryByText(/Loading Members/i)).toBeNull();
    expect(
      screen.getByRole("status", { name: "Loading Invitations" }),
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(3);
  });
});
