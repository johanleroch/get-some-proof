import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAuthenticatedMock, redirectMock } = vi.hoisted(() => ({
  isAuthenticatedMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: redirectMock,
}));

vi.mock("@/lib/auth-server", () => ({
  isAuthenticated: isAuthenticatedMock,
}));

vi.mock("@/components/invitations/accept-invitation", () => ({
  AcceptInvitation: ({ token }: { token: string }) => (
    <div>Accept invitation {token}</div>
  ),
}));

import AcceptInvitationPage from "@/app/accept-invitation/page";

describe("accept invitation page", () => {
  beforeEach(() => {
    isAuthenticatedMock.mockReset();
    redirectMock.mockClear();
  });

  it("offers sign-in recovery for a legacy unauthenticated link", async () => {
    isAuthenticatedMock.mockResolvedValue(false);

    await expect(
      AcceptInvitationPage({
        searchParams: Promise.resolve({ token: "invitation-token" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith(
      "/sign-in?callbackURL=%2Faccept-invitation%3Ftoken%3Dinvitation-token",
    );
  });

  it("renders acceptance for an authenticated invitee", async () => {
    isAuthenticatedMock.mockResolvedValue(true);

    render(
      await AcceptInvitationPage({
        searchParams: Promise.resolve({ token: "invitation-token" }),
      }),
    );

    expect(
      screen.getByText("Accept invitation invitation-token"),
    ).toBeInTheDocument();
  });
});
