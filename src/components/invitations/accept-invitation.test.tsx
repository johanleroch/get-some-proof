import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AcceptInvitation } from "./accept-invitation";

const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.accept,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

afterEach(cleanup);

describe("AcceptInvitation", () => {
  beforeEach(() => {
    mocks.accept.mockReset();
    mocks.replace.mockReset();
  });

  it("shows one safe message for expired, revoked, and already-used links", async () => {
    mocks.accept.mockRejectedValue(
      new Error(
        'Server Error: {"code":"INVITATION_UNAVAILABLE","internal":"hidden"}',
      ),
    );

    render(<AcceptInvitation token="unavailable-token" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept Invitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This invitation has expired, was revoked, or was already used.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("internal");
  });

  it("explains the verified-email requirement without exposing internals", async () => {
    mocks.accept.mockRejectedValue(
      new Error('{"code":"INVITATION_EMAIL_MISMATCH"}'),
    );

    render(<AcceptInvitation token="mismatch-token" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept Invitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign in with the verified email address that received this invitation.",
    );
  });
});
