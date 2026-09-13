import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSecurity } from "./account-security";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastDismiss: vi.fn(),
  push: vi.fn(),
  listSessions: vi.fn(),
  listAccounts: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeSession: vi.fn(),
  twoFactorEnabled: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/components/brand/blob-toast", () => ({
  blobToast: {
    error: mocks.toastError,
    success: vi.fn(),
    dismiss: mocks.toastDismiss,
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: { twoFactorEnabled: mocks.twoFactorEnabled },
        session: { token: "current-session-token" },
      },
      refetch: async () => undefined,
    }),
    listSessions: mocks.listSessions,
    listAccounts: mocks.listAccounts,
    revokeSession: mocks.revokeSession,
    revokeOtherSessions: mocks.revokeOtherSessions,
  },
}));

describe("AccountSecurity", () => {
  beforeEach(() => {
    cleanup();
    mocks.toastError.mockClear();
    mocks.toastDismiss.mockClear();
    mocks.push.mockClear();
    mocks.twoFactorEnabled = false;
    mocks.listAccounts.mockResolvedValue({
      data: [{ providerId: "credential" }],
      error: null,
    });
    mocks.revokeSession.mockReset();
    mocks.revokeOtherSessions.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.listSessions.mockResolvedValue({
      data: [
        {
          id: "session-2",
          token: "other-session-token",
          updatedAt: new Date("2026-08-30T11:00:00Z"),
          userAgent: "Windows",
        },
        {
          id: "session-1",
          token: "current-session-token",
          createdAt: new Date("2026-08-30T10:00:00Z"),
          updatedAt: new Date("2026-08-30T11:00:00Z"),
          expiresAt: new Date("2026-09-06T10:00:00Z"),
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0 (Macintosh)",
        },
      ],
      error: null,
    });
    mocks.revokeOtherSessions.mockResolvedValue({ data: null, error: null });
  });

  it("invites an Owner without a second step to set one up", async () => {
    render(<AccountSecurity />);
    const link = await screen.findByRole("link", { name: "Set up" });
    expect(link).toHaveAttribute("href", "/account/security/authenticator");
    expect(screen.getByText(/Off\./)).toBeInTheDocument();
    // The setup itself never happens here.
    expect(screen.queryByLabelText("Current password")).toBeNull();
  });

  it("sends an Owner who already has a second step to manage it", async () => {
    mocks.twoFactorEnabled = true;
    render(<AccountSecurity />);
    expect(
      await screen.findByRole("link", { name: "Manage authenticator" }),
    ).toHaveAttribute("href", "/account/security/authenticator");
    expect(screen.getByText(/^On\./)).toBeInTheDocument();
  });

  it("says an external provider carries the second step", async () => {
    mocks.listAccounts.mockResolvedValue({
      data: [{ providerId: "google" }],
      error: null,
    });
    render(<AccountSecurity />);
    expect(
      await screen.findByText(/external sign-in provider carries/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Manage authenticator" }),
    ).toBeInTheDocument();
  });

  it("clears a previous security error before leaving a revoked current session", async () => {
    mocks.revokeSession.mockResolvedValue({ data: null, error: null });
    render(<AccountSecurity />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke Mac" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/sign-in"));
    expect(mocks.toastDismiss).toHaveBeenCalledWith("account-security-error");
  });

  it("lists device context and revokes every other Session", async () => {
    render(<AccountSecurity />);

    expect(await screen.findByText(/Mac \(current\)/)).toBeInTheDocument();
    expect(screen.getByText(/127\.0\.0\.1/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Revoke every other Session" }),
    );

    await waitFor(() => {
      expect(mocks.revokeOtherSessions).toHaveBeenCalledOnce();
    });
  });

  it("allows retrying a failed sessions request", async () => {
    mocks.listSessions.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<AccountSecurity />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry loading sessions" }),
    );
    expect(await screen.findByText(/Mac \(current\)/)).toBeInTheDocument();
  });

  it("replaces endless session loading with a reauthentication action", async () => {
    mocks.listSessions.mockResolvedValue({
      data: null,
      error: { code: "SESSION_NOT_FRESH", message: "Session is not fresh" },
    });
    render(<AccountSecurity />);
    expect(
      await screen.findByRole("link", { name: "Sign in again" }),
    ).toHaveAttribute("href", "/sign-in?callbackURL=%2Faccount%2Fsecurity");
    expect(screen.queryByText("Loading Sessions…")).toBeNull();
  });
});
