/**
 * Catalog of every user-facing screen, used by the development-only
 * `/screens` gallery. Fixture paths render the screen with sample data and no
 * session (see `src/app/visual-evidence`). Live paths point at the real route;
 * `:organizationSlug` and `:publicSlug` are resolved from the signed-in
 * Owner's Brand, and routes that need a private token have no live preview.
 */

/**
 * Artboard sizes the gallery can render. The width drives the responsive
 * layout inside each frame; the height is the floor a page gets before its
 * content makes it taller (pages using `min-h-svh` fill exactly this).
 */
export const devices = [
  { key: "desktop", label: "Desktop", minHeight: 900, width: 1440 },
  { key: "laptop", label: "Laptop", minHeight: 800, width: 1280 },
  { key: "tablet", label: "Tablet", minHeight: 1112, width: 834 },
  { key: "phone", label: "Phone", minHeight: 844, width: 390 },
] as const;

export type DeviceKey = (typeof devices)[number]["key"];
export type Device = (typeof devices)[number];

export const deviceKeys = devices.map((device) => device.key) as DeviceKey[];

export function deviceByKey(key: DeviceKey): Device {
  return devices.find((device) => device.key === key) ?? devices[0];
}

/** Default artboard: the desktop preset. */
export const artboardWidth: number = devices[0].width;
export const artboardMinHeight: number = devices[0].minHeight;

/** Review status a screen can carry in the gallery; absent means untouched. */
export const screenStatuses = ["todo", "ok"] as const;

export type ScreenStatus = (typeof screenStatuses)[number];

export type ScreenStatuses = Partial<Record<string, ScreenStatus>>;

export function isScreenStatus(value: unknown): value is ScreenStatus {
  return screenStatuses.includes(value as ScreenStatus);
}

export function isKnownScreenSlug(
  slug: string,
  sections: ScreenSection[],
): boolean {
  return sections.some((section) =>
    section.screens.some((screen) => screen.slug === slug),
  );
}

export type ScreenOrganization = {
  name: string;
  publicSlug: string;
  slug: string;
};

export type ScreenDefinition = {
  description: string;
  fixturePath?: string;
  livePath?: string;
  requiresAuth?: boolean;
  slug: string;
  title: string;
};

export type ScreenSection = {
  id: string;
  screens: ScreenDefinition[];
  title: string;
};

const placeholderPattern = /:([a-zA-Z]+)/g;

export function resolveLivePath(
  path: string,
  organization: ScreenOrganization | null,
): string | null {
  let unresolved = false;
  const resolved = path.replace(placeholderPattern, (match, name: string) => {
    if (name === "organizationSlug" && organization) return organization.slug;
    if (name === "publicSlug" && organization) return organization.publicSlug;
    unresolved = true;
    return match;
  });
  return unresolved ? null : resolved;
}

export const screenSections: ScreenSection[] = [
  {
    id: "account-projects",
    title: "Account and Projects",
    screens: [
      {
        slug: "account-pro-projects",
        title: "Pro Account",
        description: "Shared subscription and usage across Projects.",
        fixturePath: "/visual-evidence/account-pro",
        livePath: "/org/:organizationSlug/dashboard",
        requiresAuth: true,
      },
      {
        slug: "account-inactive-project",
        title: "Inactive Project",
        description: "Private access after the Account returns to Free.",
        fixturePath: "/visual-evidence/inactive-project",
        requiresAuth: true,
      },
      {
        slug: "account-free-project",
        title: "Free Project choice",
        description: "Choose which Project remains active after Pro ends.",
        fixturePath: "/visual-evidence/account-free-project",
        livePath: "/org/:organizationSlug/billing",
        requiresAuth: true,
      },
      {
        slug: "account-deletion",
        title: "Delete Account",
        description:
          "Explicit confirmation of every Project and subscription deletion.",
        fixturePath: "/visual-evidence/account-deletion",
        livePath: "/account/billing",
        requiresAuth: true,
      },
    ],
  },

  {
    id: "authentication",
    title: "Authentication",
    screens: [
      {
        slug: "sign-in",
        title: "Sign in",
        description: "Email and password entry with the Google option.",
        livePath: "/sign-in",
      },
      {
        slug: "sign-up",
        title: "Sign up",
        description: "Account creation before the email verification step.",
        livePath: "/sign-up",
      },
      {
        slug: "forgot-password",
        title: "Forgot password",
        description: "Requests a password reset link by email.",
        livePath: "/forgot-password",
      },
      {
        slug: "reset-password",
        title: "Reset password",
        description:
          "Chooses a new password from an emailed link. Opened here without a token.",
        livePath: "/reset-password",
      },
      {
        slug: "two-factor",
        title: "Two-factor verification",
        description: "Second-factor code entry during sign-in.",
        livePath: "/two-factor",
      },
    ],
  },
  {
    id: "onboarding-account",
    title: "Onboarding and account",
    screens: [
      {
        slug: "onboarding",
        title: "Brand onboarding",
        description:
          "First step after verification: create the Brand and its Collection Form. Live redirects to the dashboard once a Brand exists.",
        fixturePath: "/visual-evidence/onboarding",
        livePath: "/onboarding",
        requiresAuth: true,
      },
      {
        slug: "profile",
        title: "Account profile",
        description: "Display name and avatar upload with cropping.",
        fixturePath: "/visual-evidence/profile",
        livePath: "/account/profile",
        requiresAuth: true,
      },
      {
        slug: "security",
        title: "Account security",
        description: "Password change, two-factor setup, and active sessions.",
        livePath: "/account/security",
        requiresAuth: true,
      },
    ],
  },
  {
    id: "brand-workspace",
    title: "Brand workspace",
    screens: [
      {
        slug: "assistant-import-recovery",
        title: "Assistant import recovery",
        description: "Mixed media outcomes and local video file fallback.",
        fixturePath: "/visual-evidence/assistant-import-recovery",
        requiresAuth: true,
      },
      {
        slug: "mcp-setup",
        title: "Assistant import setup",
        description: "Paid import activation and reuse-rights attestation.",
        fixturePath: "/visual-evidence/mcp-setup",
        livePath: "/org/:organizationSlug/mcp",
        requiresAuth: true,
      },
      {
        slug: "mcp-setup-free",
        title: "Assistant import on Free",
        description: "Explains assistant imports and the Pro upgrade.",
        fixturePath: "/visual-evidence/mcp-setup-free",
        requiresAuth: true,
      },
      {
        slug: "dashboard",
        title: "Brand overview, nothing waiting",
        description:
          "A new workspace: the Collection Form leads, because sharing it is the only job left.",
        fixturePath: "/visual-evidence/dashboard",
        livePath: "/org/:organizationSlug/dashboard",
        requiresAuth: true,
      },
      {
        slug: "dashboard-pending",
        title: "Brand overview, Submissions waiting",
        description:
          "The queue leads and links to the Inbox; the Collection Form steps back.",
        fixturePath: "/visual-evidence/dashboard-pending",
        livePath: "/org/:organizationSlug/dashboard",
        requiresAuth: true,
      },
      {
        slug: "inbox",
        title: "Testimonial inbox",
        description:
          "Pending first: one list of rows, each with its decision. Publish, Archive, preview a video, and reach the tools from the menu.",
        fixturePath: "/visual-evidence/testimonial-inbox",
        livePath: "/org/:organizationSlug/inbox",
        requiresAuth: true,
      },
      {
        slug: "inbox-published",
        title: "Inbox, Published",
        description:
          "The Published category is the Public Wall in its Curated Order: grip, arrows, Unpublish, and the details each card shows.",
        // Sample only: the live route always opens on Pending.
        fixturePath: "/visual-evidence/testimonial-inbox-published",
      },
      {
        slug: "testimonial-import-public",
        title: "Preview a wall before signup",
        description:
          "Choose testimonials before signing in, then continue to an owned Project.",
        livePath: "/import",
        fixturePath: "/visual-evidence/testimonial-import-public",
      },
      {
        slug: "testimonial-import",
        title: "Import testimonials",
        description:
          "Read a public wall, select testimonials and import them into the Inbox.",
        livePath: "/org/:organizationSlug/import",
        fixturePath: "/visual-evidence/testimonial-import",
        requiresAuth: true,
      },
      {
        slug: "testimonial-import-video-failed",
        title: "Retry an imported video",
        description:
          "Review a failed video copy and retry without creating another testimonial.",
        fixturePath: "/visual-evidence/testimonial-import-video-failed",
        requiresAuth: true,
      },
      {
        slug: "testimonial-import-video-processing",
        title: "Video import in progress",
        description:
          "Track copied testimonials and videos that are still processing.",
        fixturePath: "/visual-evidence/testimonial-import-video-processing",
        requiresAuth: true,
      },
      {
        slug: "testimonial-import-publication",
        title: "Publish an imported testimonial",
        description:
          "Confirm permission before publishing a testimonial from another wall.",
        fixturePath: "/visual-evidence/testimonial-import-publication",
        requiresAuth: true,
      },
      {
        slug: "settings",
        title: "Brand settings",
        description:
          "Identity, Collection Form copy, Wall customization, embed snippet, and workspace deletion.",
        fixturePath: "/visual-evidence/organization-settings",
        livePath: "/org/:organizationSlug/settings",
        requiresAuth: true,
      },
      {
        slug: "billing",
        title: "Billing",
        description:
          "Monthly or annual Pro billing, invoice downloads and the Stripe portal.",
        fixturePath: "/visual-evidence/billing",
        livePath: "/org/:organizationSlug/billing",
        requiresAuth: true,
      },
      {
        slug: "billing-downgrade",
        title: "Billing, cancellation scheduled",
        description: "Billing screen once a downgrade has been scheduled.",
        fixturePath: "/visual-evidence/billing?state=cancellation_scheduled",
        livePath: "/org/:organizationSlug/billing",
        requiresAuth: true,
      },
    ],
  },
  {
    id: "dialogs-feedback",
    title: "Dialogs and feedback",
    screens: [
      {
        slug: "testimonial-details",
        title: "Details shown on the Wall",
        description:
          "Which of a Published card's details the Public Wall shows, with the real card as preview.",
        fixturePath: "/visual-evidence/testimonial-inbox-details",
      },
      {
        slug: "testimonial-delete",
        title: "Delete a Testimonial",
        description: "Permanent deletion confirmation from the inbox.",
        fixturePath: "/visual-evidence/testimonial-delete",
      },
      {
        slug: "workspace-delete",
        title: "Delete the workspace",
        description: "Permanent Brand deletion confirmation from settings.",
        fixturePath: "/visual-evidence/workspace-delete",
      },
      {
        slug: "workspace-delete-progress",
        title: "Workspace deletion in progress",
        description: "Retry state while the deletion is still running.",
        fixturePath: "/visual-evidence/workspace-delete-progress",
      },
      {
        slug: "testimonial-highlight",
        title: "Highlight a phrase",
        description:
          "Marking one phrase of a Testimonial: the words stay locked, the mark previews in the Brand's own colour.",
        fixturePath: "/visual-evidence/rich-testimonial",
      },
      {
        slug: "video-thumbnail",
        title: "Change thumbnail",
        description:
          "Choosing the still of a video Testimonial: a frame scrubbed from the video, or an image the Owner uploads, previewed on the real card.",
        fixturePath: "/visual-evidence/video-thumbnail",
      },
      {
        slug: "toast-success",
        title: "Success toast",
        description: "Transient confirmation after a successful action.",
        fixturePath: "/visual-evidence/toast-success",
      },
      {
        slug: "toast-error",
        title: "Error toast",
        description: "Transient error with recovery guidance.",
        fixturePath: "/visual-evidence/toast-error",
      },
    ],
  },
  {
    id: "collection-form",
    title: "Collection Form (public)",
    screens: [
      {
        slug: "collection-form",
        title: "Choose a format",
        description:
          "Entry step of the public Collection Form: text or video Testimonial.",
        fixturePath: "/visual-evidence/collection-form",
        livePath: "/c/:publicSlug",
      },
      {
        slug: "collection-form-closed",
        title: "Collection closed",
        description: "Shown when the Brand pauses collection.",
        fixturePath: "/visual-evidence/collection-form-closed",
      },
      {
        slug: "collection-form-write",
        title: "Write a text Testimonial",
        description: "Text entry step with length guidance.",
        fixturePath: "/visual-evidence/collection-form-write",
      },
      {
        slug: "collection-form-video",
        title: "Record or upload a video",
        description: "Video capture and file upload step.",
        fixturePath: "/visual-evidence/collection-form-video",
      },
      {
        slug: "video-upload-progress",
        title: "Video upload progress",
        description: "Upload and processing progress after choosing a video.",
        fixturePath: "/visual-evidence/video-upload-progress",
      },
      {
        slug: "collection-form-details",
        title: "Identity and consent",
        description: "Name, role, and consent before submission.",
        fixturePath: "/visual-evidence/collection-form-details",
      },
      {
        slug: "collection-form-success",
        title: "Submission success",
        description: "Thank-you state with the management link notice.",
        fixturePath: "/visual-evidence/collection-form-success",
      },
      {
        slug: "privacy-notice",
        title: "Brand privacy notice",
        description:
          "Per-Brand privacy notice linked from the Collection Form.",
        fixturePath: "/visual-evidence/privacy-notice",
        livePath: "/c/:publicSlug/privacy",
      },
    ],
  },
  {
    id: "public-wall",
    title: "Public Wall",
    screens: [
      {
        slug: "public-wall",
        title: "Published Wall",
        description: "Hosted Wall with published text and video Testimonials.",
        fixturePath: "/visual-evidence/public-wall",
        livePath: "/w/:publicSlug",
      },
      {
        slug: "public-wall-empty",
        title: "Empty Wall",
        description: "Wall before any Testimonial is published.",
        fixturePath: "/visual-evidence/public-wall-empty",
      },
      {
        slug: "public-wall-pro",
        title: "Published Wall, Pro",
        description: "Wall on the Pro plan with attribution hidden.",
        fixturePath: "/visual-evidence/public-wall-pro",
      },
    ],
  },
  {
    id: "templates",
    title: "Templates (public)",
    screens: [
      {
        slug: "templates",
        title: "Templates gallery",
        description:
          "Public gallery of the layouts a Brand can pick, each rendered live with sample Testimonials. Drafts are reviewed in /kit/templates.",
        livePath: "/templates",
      },
      {
        slug: "template-preview",
        title: "Template full preview",
        description:
          "One template at full width, with the accent and wall theme chosen in the gallery.",
        livePath: "/templates/masonry-wall",
      },
    ],
  },
  {
    id: "private-links",
    title: "Private links",
    screens: [
      {
        slug: "managed-submission",
        title: "Manage a submission",
        description:
          "Private link sent to the author to edit or withdraw a Testimonial.",
        fixturePath: "/visual-evidence/managed-submission",
        livePath: "/s/:token",
      },
      {
        slug: "video-retry",
        title: "Replace a failed video",
        description: "Private link to re-upload after a processing failure.",
        fixturePath: "/visual-evidence/video-retry",
        livePath: "/retry-video/:token",
      },
    ],
  },
];
