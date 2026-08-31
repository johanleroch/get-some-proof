import { env } from "../_generated/server";

export type TransactionalEmailTemplate =
  "verify-email" | "reset-password" | "organization-invitation";

export type TransactionalEmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: TransactionalEmailTemplate;
  actionUrl: string;
};

export type TransactionalEmailReceipt = {
  provider: "console" | "resend" | "test";
  providerMessageId: string;
};

function isLocalSiteUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const { hostname } = new URL(value);
    return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
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

    console.info("[transactional-email:console]", {
      to: message.to,
      subject: message.subject,
      template: message.template,
    });
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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
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

  if (!response.ok) {
    throw new Error(
      `Transactional email delivery failed (${response.status}).`,
    );
  }

  const data = (await response.json()) as { id: string };

  return {
    provider: "resend",
    providerMessageId: data.id,
  };
}
