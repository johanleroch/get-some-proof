import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sendTransactionalEmail,
  type TransactionalEmailMessage,
  UncertainEmailDeliveryError,
} from "./provider";
import {
  buildReplacementManagementLinkEmail,
  buildVerificationEmail,
} from "./templates";

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
  {
    actionUrl:
      "http://localhost:3000/api/auth/magic-link/verify?token=fake-token",
    to: "operator@example.com",
    subject: "Your sign-in link",
    html: '<a href="http://localhost:3000/api/auth/magic-link/verify?token=fake-token">Sign in</a>',
    text: "Open http://localhost:3000/api/auth/magic-link/verify?token=fake-token",
    template: "magic-link",
  },
];

describe("transactional email console provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("groups every replacement management link into one email", () => {
    const email = buildReplacementManagementLinkEmail({
      brandName: "Acme Studio",
      email: "alice@example.com",
      urls: ["https://proof.example/s/first", "https://proof.example/s/second"],
    });

    expect(email.to).toBe("alice@example.com");
    expect(email.text).toContain("Submission 1: https://proof.example/s/first");
    expect(email.text).toContain(
      "Submission 2: https://proof.example/s/second",
    );
    expect(email.template).toBe("management-link-replacement");
  });

  it("sends a stable idempotency key to Resend", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "proof@example.com");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendTransactionalEmail({
      ...messages[0],
      idempotencyKey: "submission-testimonial-attempt-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "submission-testimonial-attempt-1",
        }),
      }),
    );
  });

  it("classifies network and provider 5xx outcomes as uncertain", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "proof@example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );

    await expect(sendTransactionalEmail(messages[0])).rejects.toBeInstanceOf(
      UncertainEmailDeliveryError,
    );
  });

  it("classifies an accepted response without a valid receipt as uncertain", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "proof@example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(sendTransactionalEmail(messages[0])).rejects.toBeInstanceOf(
      UncertainEmailDeliveryError,
    );
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
      expect(log.mock.calls).toEqual([
        [
          "📧 EMAIL PREVIEW",
          {
            subject: message.subject,
            to: message.to.startsWith("operator")
              ? "o***@example.com"
              : "i***@example.com",
            type: message.template,
          },
        ],
        ["🔗 OPEN LINK"],
        [message.actionUrl],
      ]);
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
