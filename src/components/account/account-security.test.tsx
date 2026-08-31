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
    }),
    listSessions: mocks.listSessions,
    revokeSession: mocks.revokeSession,
    revokeOtherSessions: mocks.revokeOtherSessions,
    twoFactor: {
      enable: mocks.enable,
      disable: mocks.disable,
      generateBackupCodes: mocks.generateBackupCodes,
    },
  },
}));

describe("AccountSecurity", () => {
  beforeEach(() => {
    cleanup();
    mocks.twoFactorEnabled = false;
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

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enable 2FA" }));

    expect(await screen.findByText("code-one")).toBeInTheDocument();
    expect(screen.getByText("code-two")).toBeInTheDocument();
    expect(mocks.enable).toHaveBeenCalledWith({
      password: "correct horse battery staple",
      issuer: "Convex Admin Starter",
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
});
