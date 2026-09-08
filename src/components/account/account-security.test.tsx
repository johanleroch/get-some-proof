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
  enable: vi.fn(),
  disable: vi.fn(),
  generateBackupCodes: vi.fn(),
  listSessions: vi.fn(),
  listAccounts: vi.fn(),
  verifyTotp: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeSession: vi.fn(),
  twoFactorEnabled: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
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
    twoFactor: {
      enable: mocks.enable,
      verifyTotp: mocks.verifyTotp,
      disable: mocks.disable,
      generateBackupCodes: mocks.generateBackupCodes,
    },
  },
}));

describe("AccountSecurity", () => {
  beforeEach(() => {
    cleanup();
    mocks.twoFactorEnabled = false;
    mocks.listAccounts.mockResolvedValue({
      data: [{ providerId: "credential" }],
      error: null,
    });
    mocks.verifyTotp.mockResolvedValue({ data: { status: true }, error: null });
    mocks.enable.mockReset();
    mocks.disable.mockReset();
    mocks.generateBackupCodes.mockReset();
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

  it("shows recovery codes once after password-reauthenticated 2FA setup", async () => {
    mocks.enable.mockResolvedValue({
      data: {
        totpURI: "otpauth://totp/Convex%20Admin",
        backupCodes: ["code-one", "code-two"],
      },
      error: null,
    });
    render(<AccountSecurity />);

    fireEvent.change(await screen.findByLabelText("Current password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enable 2FA" }));

    expect(await screen.findByText("code-one")).toBeInTheDocument();
    expect(screen.getByText("code-two")).toBeInTheDocument();
    expect(mocks.enable).toHaveBeenCalledWith({
      password: "correct horse battery staple",
      issuer: "Get Some Proof",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "I saved these codes" }),
    );
    expect(screen.queryByText("code-one")).not.toBeInTheDocument();
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

  it("explains Google security instead of asking a Google-only user for a password", async () => {
    mocks.listAccounts.mockResolvedValue({
      data: [{ providerId: "google" }],
      error: null,
    });
    render(<AccountSecurity />);
    expect(
      await screen.findByRole("link", { name: "Manage Google security" }),
    ).toHaveAttribute("href", "https://myaccount.google.com/security");
    expect(screen.queryByLabelText("Current password")).toBeNull();
  });

  it("requires TOTP confirmation for a linked password and Google account", async () => {
    mocks.listAccounts.mockResolvedValue({
      data: [{ providerId: "google" }, { providerId: "credential" }],
      error: null,
    });
    mocks.enable.mockResolvedValue({
      data: {
        totpURI: "otpauth://totp/Test?secret=TESTKEY",
        backupCodes: ["code-one"],
      },
      error: null,
    });
    render(<AccountSecurity />);
    fireEvent.change(await screen.findByLabelText("Current password"), {
      target: { value: "account-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enable 2FA" }));
    expect(
      await screen.findByLabelText("Authenticator code"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Two-factor authentication enabled.")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "I saved these codes" }),
    );
    expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument();
    mocks.verifyTotp.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid code" },
    });
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "000000" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and enable 2FA" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid code");
    expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and enable 2FA" }),
    );
    await waitFor(() =>
      expect(mocks.verifyTotp).toHaveBeenCalledWith({ code: "123456" }),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Authenticator code")).toBeNull(),
    );
  });

  it("allows retrying a failed sessions request", async () => {
    mocks.listSessions.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<AccountSecurity />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry loading sessions" }),
    );
    expect(await screen.findByText(/Mac \(current\)/)).toBeInTheDocument();
  });

  it("restores 2FA controls after a network failure", async () => {
    mocks.enable.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<AccountSecurity />);
    fireEvent.change(await screen.findByLabelText("Current password"), {
      target: { value: "account-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enable 2FA" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to complete this action",
    );
    expect(
      screen.getByRole("button", { name: "Enable 2FA" }),
    ).not.toHaveAttribute("aria-busy", "true");
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
