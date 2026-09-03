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

export function buildSubmissionConfirmationEmail({
  brandName,
  email,
  testimonialText,
  url,
}: {
  brandName: string;
  email: string;
  testimonialText: string;
  url: string;
}) {
  return buildActionEmail({
    action: "Manage your submission",
    description: `Thanks for sharing this testimonial with ${brandName}. It is private and Pending review. Your submitted text: “${testimonialText}”`,
    email,
    subject: `Your submission to ${brandName}`,
    template: "submission-confirmation",
    url,
  });
}

export function buildVideoSubmissionConfirmationEmail({
  brandName,
  email,
  url,
}: {
  brandName: string;
  email: string;
  url: string;
}) {
  return buildActionEmail({
    action: "Manage your submission",
    description: `Thanks for sharing a video testimonial with ${brandName}. It is processing and will remain private until the Brand reviews it.`,
    email,
    subject: `Your video submission to ${brandName}`,
    template: "video-submission-confirmation",
    url,
  });
}

export function buildVideoRetryEmail({
  brandName,
  email,
  url,
}: {
  brandName: string;
  email: string;
  url: string;
}) {
  return buildActionEmail({
    action: "Replace your video",
    description: `We could not process the video you shared with ${brandName}. Use this private one-time link within 24 hours to upload a replacement.`,
    email,
    subject: `Replace your video for ${brandName}`,
    template: "video-retry",
    url,
  });
}

export function buildReplacementManagementLinkEmail({
  brandName,
  email,
  urls,
}: {
  brandName: string;
  email: string;
  urls: string[];
}) {
  const subject = `Your new management ${urls.length === 1 ? "link" : "links"} for ${brandName}`;
  const description = `Use ${urls.length === 1 ? "this new private link" : "these new private links"} to manage your ${urls.length === 1 ? "submission" : "submissions"} to ${brandName}. Any previous management link is no longer active.`;
  const links = urls
    .map(
      (url, index) =>
        `<li style="margin:12px 0"><a href="${escapeHtml(url)}">Manage submission ${index + 1}</a></li>`,
    )
    .join("");
  return {
    actionUrl: urls[0]!,
    html: `<div style="font-family:ui-sans-serif,system-ui;max-width:560px;margin:0 auto;color:#171717"><h1 style="font-size:24px">${escapeHtml(subject)}</h1><p>${escapeHtml(description)}</p><ol>${links}</ol><p style="color:#737373;font-size:14px">If you did not request this, you can ignore this email.</p></div>`,
    subject,
    template: "management-link-replacement" as const,
    text: `${description}\n\n${urls.map((url, index) => `Submission ${index + 1}: ${url}`).join("\n")}\n\nIf you did not request this, you can ignore this email.`,
    to: email,
  };
}

export function buildNewPendingTestimonialEmail({
  brandName,
  email,
  submissionType,
  submitterName,
  url,
}: {
  brandName: string;
  email: string;
  submissionType: "text" | "video";
  submitterName: string;
  url: string;
}) {
  return buildActionEmail({
    action: "Review testimonial",
    description: `${submitterName} sent a new ${submissionType} testimonial to ${brandName}. It is Pending review in your private Workspace.`,
    email,
    subject: `New testimonial for ${brandName}`,
    template: "new-pending-testimonial",
    url,
  });
}

export function buildBillingLifecycleEmail({
  brandName,
  email,
  kind,
  url,
}: {
  brandName: string;
  email: string;
  kind:
    | "downgrade_d7"
    | "downgrade_d1"
    | "video_retention_started"
    | "video_retention_d7"
    | "video_retention_d1";
  url: string;
}) {
  const downgrade = kind === "downgrade_d7" || kind === "downgrade_d1";
  const days = kind.endsWith("d7") ? 7 : kind.endsWith("d1") ? 1 : 30;
  return buildActionEmail({
    action: downgrade
      ? "Choose what stays published"
      : "Review retained videos",
    description: downgrade
      ? `${brandName} moves to Free in ${days} ${days === 1 ? "day" : "days"}. Choose up to 2 videos and 13 text Testimonials to keep Published; otherwise the most recently Published proof stays public.`
      : `${brandName} has video Testimonials retained for ${days} ${days === 1 ? "day" : "days"}. They remain exceptionally downloadable until their Mux media is permanently deleted.`,
    email,
    subject: downgrade
      ? `${brandName} moves to Free in ${days} ${days === 1 ? "day" : "days"}`
      : `${brandName}: retained videos delete in ${days} ${days === 1 ? "day" : "days"}`,
    template: downgrade ? "downgrade-reminder" : "video-retention-warning",
    url,
  });
}
