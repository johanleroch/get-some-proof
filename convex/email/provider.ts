import { env } from "../_generated/server";

export type TransactionalEmailTemplate =
  | "verify-email"
  | "reset-password"
  | "magic-link"
  | "organization-invitation"
  | "submission-confirmation"
  | "video-submission-confirmation"
  | "video-retry"
  | "new-pending-testimonial";

export type TransactionalEmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: TransactionalEmailTemplate;
  actionUrl: string;
  idempotencyKey?: string;
};

export type TransactionalEmailReceipt = {
  provider: "console" | "resend" | "test";
  providerMessageId: string;
};

export class UncertainEmailDeliveryError extends Error {}

function isLocalSiteUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const { hostname } = new URL(value);
    return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
}

function maskEmailAddress(value: string) {
  const separatorIndex = value.lastIndexOf("@");

  if (separatorIndex <= 0) return "***";

  return `${value[0]}***${value.slice(separatorIndex)}`;
}

export async function sendTransactionalEmail(
  message: TransactionalEmailMessage,
): Promise<TransactionalEmailReceipt> {
  const provider = env.EMAIL_PROVIDER;

  if (provider === "test") {
    return {
      provider: "test",
      providerMessageId: `test-${crypto.randomUUID()}`,
    };
  }

  if (provider === "console") {
    if (!isLocalSiteUrl(env.SITE_URL) || !isLocalSiteUrl(message.actionUrl)) {
      throw new Error("EMAIL_PROVIDER=console is restricted to local URLs.");
    }

    console.info("📧 EMAIL PREVIEW", {
      type: message.template,
      to: maskEmailAddress(message.to),
      subject: message.subject,
    });
    console.info("🔗 OPEN LINK");
    console.info(message.actionUrl);

    return {
      provider: "console",
      providerMessageId: `console-${crypto.randomUUID()}`,
    };
  }

  if (provider !== "resend") {
    throw new Error(
      "EMAIL_PROVIDER must be explicitly set to `console`, `resend`, or `test`.",
    );
  }

  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error(
      "RESEND_API_KEY and EMAIL_FROM are required when EMAIL_PROVIDER=resend.",
    );
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey
          ? { "Idempotency-Key": message.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: [{ name: "template", value: message.template }],
      }),
    });
  } catch {
    throw new UncertainEmailDeliveryError(
      "Transactional email delivery outcome is uncertain.",
    );
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new UncertainEmailDeliveryError(
        `Transactional email delivery outcome is uncertain (${response.status}).`,
      );
    }
    throw new Error(
      `Transactional email delivery failed (${response.status}).`,
    );
  }

  let data: { id: string };
  try {
    const parsed = (await response.json()) as { id?: unknown };
    if (typeof parsed.id !== "string" || !parsed.id) throw new Error();
    data = { id: parsed.id };
  } catch {
    throw new UncertainEmailDeliveryError(
      "Transactional email was accepted but its receipt is unavailable.",
    );
  }

  return {
    provider: "resend",
    providerMessageId: data.id,
  };
}
