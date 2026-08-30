import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TwoFactorChallenge } from "./two-factor-challenge";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  verifyBackupCode: vi.fn(),
  verifyTotp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    twoFactor: {
      verifyBackupCode: mocks.verifyBackupCode,
      verifyTotp: mocks.verifyTotp,
    },
  },
}));

describe("TwoFactorChallenge", () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.verifyBackupCode.mockReset();
    mocks.verifyTotp.mockReset();
    mocks.verifyTotp.mockResolvedValue({
      data: { token: "verified" },
      error: null,
    });
    mocks.verifyBackupCode.mockResolvedValue({
      data: { token: "recovered" },
      error: null,
    });
  });

  it("verifies TOTP and resumes the safe pre-challenge route", async () => {
    sessionStorage.setItem("post-two-factor-route", "/org/acme-1234/projects");
    render(<TwoFactorChallenge />);

    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(mocks.verifyTotp).toHaveBeenCalledWith({
        code: "123456",
        trustDevice: true,
      });
      expect(mocks.replace).toHaveBeenCalledWith("/org/acme-1234/projects");
    });
    expect(sessionStorage.getItem("post-two-factor-route")).toBeNull();
  });

  it("supports a one-time recovery code challenge", async () => {
    render(<TwoFactorChallenge />);
    fireEvent.click(
      screen.getByRole("button", { name: "Use a recovery code" }),
    );
    fireEvent.change(screen.getByLabelText("Recovery code"), {
      target: { value: "recovery-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(mocks.verifyBackupCode).toHaveBeenCalledWith({
        code: "recovery-123",
        trustDevice: true,
      });
    });
  });
});
