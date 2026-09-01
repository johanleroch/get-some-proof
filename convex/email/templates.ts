import type {
  TransactionalEmailMessage,
  TransactionalEmailTemplate,
} from "./provider";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildActionEmail({
  action,
  description,
  email,
  subject,
  template,
  url,
}: {
  action: string;
  description: string;
  email: string;
  subject: string;
  template: TransactionalEmailTemplate;
  url: string;
}): TransactionalEmailMessage {
  const safeUrl = escapeHtml(url);

  return {
    to: email,
    subject,
    template,
    actionUrl: url,
    text: `${description}\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="font-family:ui-sans-serif,system-ui;max-width:560px;margin:0 auto;color:#171717"><h1 style="font-size:24px">${escapeHtml(subject)}</h1><p>${escapeHtml(description)}</p><p style="margin:28px 0"><a href="${safeUrl}" style="background:#4f46e5;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">${escapeHtml(action)}</a></p><p style="color:#737373;font-size:14px">If you did not request this, you can ignore this email.</p></div>`,
  };
}

export function buildVerificationEmail(email: string, url: string) {
  return buildActionEmail({
    action: "Verify email",
    description:
      "Verify your email address before creating or joining an Organization.",
    email,
    subject: "Verify your email address",
    template: "verify-email",
    url,
  });
}

export function buildResetPasswordEmail(email: string, url: string) {
  return buildActionEmail({
    action: "Reset password",
    description: "Use this secure link to choose a new password.",
    email,
    subject: "Reset your password",
    template: "reset-password",
    url,
  });
}

export function buildMagicLinkEmail(email: string, url: string) {
  return buildActionEmail({
    action: "Sign in",
    description: "Use this secure one-time link to sign in.",
    email,
    subject: "Your sign-in link",
    template: "magic-link",
    url,
  });
}

export function buildOrganizationInvitationEmail({
  email,
  organizationName,
  role,
  url,
}: {
  email: string;
  organizationName: string;
  role: "admin" | "editor" | "viewer";
  url: string;
}) {
  return buildActionEmail({
    action: "Accept invitation",
    description: `You were invited to join ${organizationName} as ${role}. This link expires in seven days.`,
    email,
    subject: `Join ${organizationName}`,
    template: "organization-invitation",
    url,
  });
}
