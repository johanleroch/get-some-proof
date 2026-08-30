export type TransactionalEmailTemplate =
  "verify-email" | "reset-password" | "organization-invitation";

export type TransactionalEmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: TransactionalEmailTemplate;
};

export type TransactionalEmailReceipt = {
  provider: "resend" | "test";
  providerMessageId: string;
};

export async function sendTransactionalEmail(
  message: TransactionalEmailMessage,
): Promise<TransactionalEmailReceipt> {
  const provider = process.env.EMAIL_PROVIDER;

  if (provider === "test") {
    return {
      provider: "test",
      providerMessageId: `test-${crypto.randomUUID()}`,
    };
  }

  if (provider !== "resend") {
    throw new Error(
      "EMAIL_PROVIDER must be explicitly set to `resend` or `test`.",
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

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
