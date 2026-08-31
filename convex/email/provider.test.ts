import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sendTransactionalEmail,
  type TransactionalEmailMessage,
} from "./provider";

const messages: TransactionalEmailMessage[] = [
  {
    to: "operator@example.com",
    subject: "Verify your email address",
    html: '<a href="http://localhost:3000/verify?token=fake-token">Verify</a>',
    text: "Open http://localhost:3000/verify?token=fake-token",
    template: "verify-email",
  },
  {
    to: "operator@example.com",
    subject: "Reset your password",
    html: '<a href="http://localhost:3000/reset-password?token=fake-token">Reset</a>',
    text: "Open http://localhost:3000/reset-password?token=fake-token",
    template: "reset-password",
  },
  {
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
        text: message.text,
        to: message.to,
      });
    },
  );

  it("refuses to expose authentication links for a public site", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "console");
    vi.stubEnv("SITE_URL", "https://admin.example.com");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(sendTransactionalEmail(messages[0])).rejects.toThrow(
      "EMAIL_PROVIDER=console is restricted to a local SITE_URL.",
    );
    expect(log).not.toHaveBeenCalled();
  });
});
