import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountAuthenticator } from "./account-authenticator";

const totpURI = "otpauth://totp/Get%20Some%20Proof?secret=JBSWY3DPEHPK3PXP";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  generateBackupCodes: vi.fn(),
  listAccounts: vi.fn(),
  verifyTotp: vi.fn(),
  refetch: vi.fn(),
  twoFactorEnabled: false,
}));

vi.mock("@/components/brand/blob-toast", () => ({
  blobToast: {
    error: vi.fn(),
    success: mocks.toastSuccess,
    dismiss: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { twoFactorEnabled: mocks.twoFactorEnabled } },
      refetch: mocks.refetch,
    }),
    listAccounts: mocks.listAccounts,
    twoFactor: {
      enable: mocks.enable,
      verifyTotp: mocks.verifyTotp,
      disable: mocks.disable,
      generateBackupCodes: mocks.generateBackupCodes,
    },
  },
}));

async function startSetup(password = "correct horse battery staple") {
  fireEvent.change(await screen.findByLabelText("Current password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("AccountAuthenticator", () => {
  beforeEach(() => {
    cleanup();
    mocks.toastSuccess.mockClear();
    mocks.twoFactorEnabled = false;
    mocks.refetch.mockReset().mockResolvedValue(undefined);
    mocks.listAccounts.mockResolvedValue({
      data: [{ providerId: "credential" }],
      error: null,
    });
    mocks.enable.mockReset().mockResolvedValue({
      data: { totpURI, backupCodes: ["code-one", "code-two"] },
      error: null,
    });
    mocks.verifyTotp
      .mockReset()
      .mockResolvedValue({ data: { status: true }, error: null });
    mocks.disable.mockReset().mockResolvedValue({ data: null, error: null });
    mocks.generateBackupCodes.mockReset();
  });

  it("folds the manual key and the app suggestions out of the way", async () => {
    render(<AccountAuthenticator />);
    await startSetup();
    await screen.findByLabelText("Digit 1 of 6");
    expect(screen.queryByText(/Add the account by hand/)).toBeNull();
    expect(screen.queryByText(/Google Authenticator/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Can’t scan it?" }));
    expect(screen.getByText(/Add the account by hand/)).toBeInTheDocument();
    expect(screen.getByText(/Google Authenticator/)).toBeInTheDocument();
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
  });

  it("hands a phone the link to its app instead of a QR code it cannot scan", async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
      writable: true,
    });
    try {
      render(<AccountAuthenticator />);
      await startSetup();

      expect(
        await screen.findByRole("link", {
          name: "Open your authenticator app",
        }),
      ).toHaveAttribute("href", totpURI);
      expect(
        screen.queryByRole("img", {
          name: "QR code for your authenticator app",
        }),
      ).toBeNull();
      // The key stays in plain sight: the link is silent without an app.
      expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
      expect(screen.getByLabelText("Digit 1 of 6")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: width,
        writable: true,
      });
    }
  });

  it("still runs the setup for a password linked with Google", async () => {
    mocks.listAccounts.mockResolvedValue({
      data: [{ providerId: "google" }, { providerId: "credential" }],
      error: null,
    });
    render(<AccountAuthenticator />);
    await startSetup("account-password");

    // A linked Google account must not send the Owner to the dead end.
    expect(
      screen.queryByRole("link", { name: "Manage Google security" }),
    ).toBeNull();
    expect(await screen.findByLabelText("Digit 1 of 6")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Digit 1 of 6"), {
      target: { value: "123456" },
    });
    expect(await screen.findByText("code-one")).toBeInTheDocument();
  });

  it("holds the recovery codes back until the app is verified", async () => {
    render(<AccountAuthenticator />);
    await startSetup();

    // Step two: the QR code and the key, but no codes to save yet.
    expect(
      await screen.findByRole("img", {
        name: "QR code for your authenticator app",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("code-one")).toBeNull();
    expect(mocks.enable).toHaveBeenCalledWith({
      password: "correct horse battery staple",
      issuer: "Get Some Proof",
    });

    // Six boxes and nothing else: the last digit is the whole gesture.
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Digit 1 of 6"), {
      target: { value: "123456" },
    });

    expect(await screen.findByText("code-one")).toBeInTheDocument();
    expect(screen.getByText("code-two")).toBeInTheDocument();
    expect(mocks.verifyTotp).toHaveBeenCalledExactlyOnceWith({
      code: "123456",
    });

    fireEvent.click(screen.getByRole("button", { name: "I saved them" }));
    expect(screen.queryByText("code-one")).toBeNull();
  });

  it("keeps the code field open when the code is refused", async () => {
    render(<AccountAuthenticator />);
    await startSetup();
    const field = await screen.findByLabelText("Digit 1 of 6");
    mocks.verifyTotp.mockResolvedValueOnce({
      data: null,
      error: { code: "INVALID_CODE", message: "Invalid code" },
    });
    fireEvent.change(field, { target: { value: "000000" } });

    expect(
      await screen.findByText(
        "That code is incorrect or has expired. Enter the latest code from your authenticator app.",
      ),
    ).toBeInTheDocument();
    // The digits stay on screen, marked wrong, so one of them can be fixed.
    expect(screen.getByLabelText("Digit 1 of 6")).toHaveValue("0");
    expect(screen.getByLabelText("Digit 1 of 6")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.queryByText("code-one")).toBeNull();

    // A way to send the same digits again appears only now.
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(mocks.verifyTotp).toHaveBeenCalledTimes(2));
    expect(mocks.verifyTotp).toHaveBeenLastCalledWith({ code: "000000" });
  });

  it.each([
    [
      { code: "INVALID_PASSWORD" },
      "That password is incorrect. Enter your current account password and try again.",
    ],
    [
      { code: "SESSION_NOT_FRESH" },
      "Sign in again to continue. This security action needs a recent sign-in.",
    ],
    [
      { status: 401 },
      "Sign in again to continue. This security action needs a recent sign-in.",
    ],
    [
      { status: 429 },
      "Too many attempts. Wait a few minutes before trying again.",
    ],
    [
      { status: 500, message: "Internal database failure" },
      "We couldn’t start the setup. Please try again in a moment.",
    ],
    [{}, "We couldn’t start the setup. Please try again in a moment."],
  ])("explains a refused setup in place (%j)", async (error, message) => {
    mocks.enable.mockResolvedValue({ data: null, error });
    render(<AccountAuthenticator />);
    await startSetup("account-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByLabelText("The six digits your app shows")).toBeNull();

    const needsSignIn =
      ("status" in error && error.status === 401) ||
      ("code" in error && error.code === "SESSION_NOT_FRESH");
    if (needsSignIn) {
      expect(
        screen.getByRole("link", { name: "Sign in again" }),
      ).toHaveAttribute(
        "href",
        "/sign-in?callbackURL=%2Faccount%2Fsecurity%2Fauthenticator",
      );
    } else {
      expect(screen.queryByRole("link", { name: "Sign in again" })).toBeNull();
    }
  });

  it("answers an empty setup response instead of going quiet", async () => {
    mocks.enable.mockResolvedValue({ data: null, error: null });
    render(<AccountAuthenticator />);
    await startSetup("account-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn’t start the setup. Please try again in a moment.",
    );
    expect(screen.queryByLabelText("Digit 1 of 6")).toBeNull();
  });

  it("never retires recovery codes without handing over new ones", async () => {
    mocks.twoFactorEnabled = true;
    mocks.generateBackupCodes.mockResolvedValue({
      data: { backupCodes: [] },
      error: null,
    });
    render(<AccountAuthenticator />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Generate new codes" }),
    );
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "account-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate new codes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn’t generate new recovery codes. Please try again.",
    );
    expect(screen.queryByText(/no longer work/)).toBeNull();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("restores the password step after a network failure", async () => {
    mocks.enable.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<AccountAuthenticator />);
    await startSetup("account-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Check your connection/,
    );
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).not.toHaveAttribute("aria-busy", "true");
    expect(button).not.toBeDisabled();
  });

  it("points a Google-only Owner at Google instead of asking for a password", async () => {
    mocks.listAccounts.mockResolvedValue({
      data: [{ providerId: "google" }],
      error: null,
    });
    render(<AccountAuthenticator />);
    expect(
      await screen.findByRole("link", { name: "Manage Google security" }),
    ).toHaveAttribute("href", "https://myaccount.google.com/security");
    expect(screen.queryByLabelText("Current password")).toBeNull();
  });

  it("offers new recovery codes and a way out once it is on", async () => {
    mocks.twoFactorEnabled = true;
    mocks.generateBackupCodes.mockResolvedValue({
      data: { backupCodes: ["fresh-one", "fresh-two"] },
      error: null,
    });
    render(<AccountAuthenticator />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Generate new codes" }),
    );
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "account-password" },
    });
    // The row's trigger now reads "Cancel", so this is the submit button.
    fireEvent.click(screen.getByRole("button", { name: "Generate new codes" }));

    expect(await screen.findByText("fresh-one")).toBeInTheDocument();
    expect(
      screen.getByText("Your previous codes no longer work"),
    ).toBeInTheDocument();
    expect(mocks.generateBackupCodes).toHaveBeenCalledWith({
      password: "account-password",
    });

    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "account-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    await waitFor(() =>
      expect(mocks.disable).toHaveBeenCalledWith({
        password: "account-password",
      }),
    );
  });

  it("waits for the sign-in methods before offering anything", () => {
    mocks.listAccounts.mockReturnValue(new Promise(() => {}));
    render(<AccountAuthenticator />);
    expect(
      screen.getByRole("status", { name: "Loading your sign-in methods" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Current password")).toBeNull();
  });
});
