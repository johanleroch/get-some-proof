import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sendTransactionalEmail,
  type TransactionalEmailMessage,
} from "./provider";
import { buildVerificationEmail } from "./templates";

const messages: TransactionalEmailMessage[] = [
  {
    actionUrl: "http://localhost:3000/verify?token=fake-token",
    to: "operator@example.com",
    subject: "Verify your email address",
    html: '<a href="http://localhost:3000/verify?token=fake-token">Verify</a>',
    text: "Open http://localhost:3000/verify?token=fake-token",
    template: "verify-email",
  },
  {
    actionUrl: "http://localhost:3000/reset-password?token=fake-token",
    to: "operator@example.com",
    subject: "Reset your password",
    html: '<a href="http://localhost:3000/reset-password?token=fake-token">Reset</a>',
    text: "Open http://localhost:3000/reset-password?token=fake-token",
    template: "reset-password",
  },
  {
    actionUrl: "http://localhost:3000/invitations/fake-token",
    to: "invitee@example.com",
    subject: "Join Example Organization",
    html: '<a href="http://localhost:3000/invitations/fake-token">Join</a>',
    text: "Open http://localhost:3000/invitations/fake-token",
    template: "organization-invitation",
  },
];

describe("transactional email console provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(messages)(
    "prints the $template link without an email service",
    async (message) => {
      vi.stubEnv("EMAIL_PROVIDER", "console");
      vi.stubEnv("SITE_URL", "http://localhost:3000");
      const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

      await expect(sendTransactionalEmail(message)).resolves.toMatchObject({
        provider: "console",
      });
      expect(log).toHaveBeenCalledWith("[transactional-email:console]", {
        subject: message.subject,
        template: message.template,
        to: message.to,
      });
      expect(log).toHaveBeenCalledWith(message.actionUrl);
    },
  );

  it("prints a standalone copyable URL for multiline authentication emails", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "console");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const previewUrl =
      "http://localhost:3000/api/auth/verify-email?token=fake_token-with-special&callbackURL=%2Fdashboard";

    await sendTransactionalEmail(
      buildVerificationEmail("operator@example.com", previewUrl),
    );

    expect(log).toHaveBeenCalledWith(previewUrl);
  });

  it("refuses to expose authentication links for a public site", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "console");
    vi.stubEnv("SITE_URL", "https://admin.example.com");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(sendTransactionalEmail(messages[0])).rejects.toThrow(
      "EMAIL_PROVIDER=console is restricted to local URLs.",
    );
    expect(log).not.toHaveBeenCalled();
  });

  it("refuses a public action URL even when SITE_URL is local", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "console");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      sendTransactionalEmail({
        ...messages[0],
        actionUrl: "https://admin.example.com/verify?token=fake-token",
      }),
    ).rejects.toThrow("EMAIL_PROVIDER=console is restricted to local URLs.");
    expect(log).not.toHaveBeenCalled();
  });
});
