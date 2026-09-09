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

/**
 * One layout for every transactional email (DESIGN.md section 7), simple
 * and minimal: the light theme in hex, since mail clients know no tokens;
 * paper behind a 480px column; the lockup at the top, then the title in the
 * serif that stands in for Gelica, the message, the one amber button with
 * ink text, and a small footnote. Nothing else: a mail is read once. The
 * lockup is a PNG under public/brand/email, rendered by
 * scripts/email/build-assets.mjs from the site's own logo.
 */
const palette = {
  brand: "#ffbb16",
  brandText: "#815300",
  ink: "#26201c",
  ink2: "#645c55",
  paper: "#fcfaf6",
};

const bodyFont =
  "Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const displayFont = "Georgia, 'Times New Roman', serif";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const emailLogo = {
  alt: "Get Some Proof",
  height: 28,
  src: `${siteUrl}/brand/email/logo.png`,
  width: 173,
} as const;

export const defaultFootnote =
  "If you did not request this, you can ignore this email.";

function paragraph(html: string) {
  return `<p style="margin:0;font-family:${bodyFont};font-size:15px;line-height:24px;color:${palette.ink}">${html}</p>`;
}

function emailLayout({
  action,
  bodyHtml,
  footnote,
  preheader,
  title,
  url,
}: {
  /** The one button; omitted when the body carries its own links. */
  action?: string;
  bodyHtml: string;
  footnote: string;
  preheader: string;
  title: string;
  url?: string;
}) {
  const safeUrl = url ? escapeHtml(url) : null;
  const button =
    action && safeUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0"><tr><td style="background:${palette.brand};border-radius:8px"><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;font-family:${bodyFont};font-size:15px;line-height:20px;font-weight:600;color:${palette.ink};text-decoration:none">${escapeHtml(action)}</a></td></tr></table>`
      : "";
  return (
    `<div style="background:${palette.paper};padding:40px 24px">` +
    `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(preheader)}</div>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:480px;margin:0 auto">` +
    `<tr><td style="padding:0 0 40px"><img src="${emailLogo.src}" width="${emailLogo.width}" height="${emailLogo.height}" alt="${emailLogo.alt}" style="display:block;border:0;width:${emailLogo.width}px;height:${emailLogo.height}px"></td></tr>` +
    `<tr><td><h1 style="margin:0 0 12px;font-family:${displayFont};font-size:24px;line-height:30px;font-weight:700;letter-spacing:-0.01em;color:${palette.ink}">${escapeHtml(title)}</h1>${bodyHtml}${button}</td></tr>` +
    `<tr><td style="padding:40px 0 0;font-family:${bodyFont};font-size:13px;line-height:18px;color:${palette.ink2}">${escapeHtml(footnote)}</td></tr>` +
    `</table></div>`
  );
}

function buildActionEmail({
  action,
  description,
  email,
  footnote = defaultFootnote,
  subject,
  template,
  title,
  url,
}: {
  action: string;
  description: string;
  email: string;
  footnote?: string;
  subject: string;
  template: TransactionalEmailTemplate;
  /** The heading; the subject when it reads well as one. */
  title?: string;
  url: string;
}): TransactionalEmailMessage {
  return {
    to: email,
    subject,
    template,
    actionUrl: url,
    text: `${description}\n\n${url}\n\n${footnote}`,
    html: emailLayout({
      action,
      bodyHtml: paragraph(escapeHtml(description)),
      footnote,
      preheader: description,
      title: title ?? subject,
      url,
    }),
  };
}

export function buildVerificationEmail(email: string, url: string) {
  return buildActionEmail({
    action: "Verify my email",
    description:
      "Thanks for signing up. Here is your link to verify your email address. Once that is done, you can create your Brand.",
    email,
    footnote: "If you did not create an account, you can ignore this email.",
    subject: "Welcome to Get Some Proof",
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
        `<li style="margin:0 0 8px;font-family:${bodyFont};font-size:15px;line-height:24px;color:${palette.ink}"><a href="${escapeHtml(url)}" style="color:${palette.brandText};font-weight:600">Manage submission ${index + 1}</a></li>`,
    )
    .join("");
  return {
    actionUrl: urls[0]!,
    html: emailLayout({
      bodyHtml: `${paragraph(escapeHtml(description))}<ol style="margin:16px 0 0;padding:0 0 0 20px">${links}</ol>`,
      footnote: defaultFootnote,
      preheader: description,
      title: subject,
    }),
    subject,
    template: "management-link-replacement" as const,
    text: `${description}\n\n${urls.map((url, index) => `Submission ${index + 1}: ${url}`).join("\n")}\n\n${defaultFootnote}`,
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
    footnote: `You receive this because you own ${brandName} on Get Some Proof.`,
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
    footnote: `You receive this because you own ${brandName} on Get Some Proof.`,
    subject: downgrade
      ? `${brandName} moves to Free in ${days} ${days === 1 ? "day" : "days"}`
      : `${brandName}: retained videos delete in ${days} ${days === 1 ? "day" : "days"}`,
    template: downgrade ? "downgrade-reminder" : "video-retention-warning",
    url,
  });
}
