export const publicationConsentVersion = "2026-09-03.v1";

export function assertPublicationConsentSnapshot(
  expected: { text: string; version: string },
  supplied: { text: string; version: string },
) {
  if (
    supplied.version !== expected.version ||
    supplied.text !== expected.text
  ) {
    throw new Error(
      "Publication Consent changed before confirmation. Review it and try again.",
    );
  }
}

export async function hashSubmissionManagementToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function randomSubmissionManagementToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function deriveSubmissionManagementToken(
  secret: string,
  seed: string,
) {
  if (secret.length < 32) {
    throw new Error(
      "Management-link token secret must contain at least 32 characters.",
    );
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`submission-management:${seed}`),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function buildSubmissionEmailIdempotencyKey(
  attemptId: string,
  deliveryId: string,
) {
  return `${attemptId}/${deliveryId}`;
}

export type PublicIdentityField =
  "name" | "avatar" | "role" | "company" | "rating";

type TextSubmissionInput = {
  ageConfirmed: boolean;
  company?: string;
  consentAccepted: boolean;
  email: string;
  name: string;
  rating?: number;
  role?: string;
  text: string;
};

function requiredText(value: string, label: string, maximum: number) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (Array.from(normalized).length > maximum) {
    throw new Error(`${label} must be ${maximum} characters or fewer.`);
  }
  return normalized;
}

function optionalText(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (Array.from(normalized).length > 100) {
    throw new Error(`${label} must be 100 characters or fewer.`);
  }
  return normalized;
}

export function normalizeTextSubmission(input: TextSubmissionInput) {
  const text = input.text.trim();
  const textLength = Array.from(text).length;
  if (textLength < 20 || textLength > 2_000) {
    throw new Error(
      "Testimonial text must be between 20 and 2,000 characters.",
    );
  }

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (!input.ageConfirmed) {
    throw new Error("You must confirm that you are at least 18 years old.");
  }
  if (!input.consentAccepted) {
    throw new Error("Publication Consent is required.");
  }
  if (
    input.rating !== undefined &&
    (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
  ) {
    throw new Error("Rating must be a whole number between 1 and 5.");
  }

  return {
    company: optionalText(input.company, "Company"),
    email,
    name: requiredText(input.name, "Name", 100),
    rating: input.rating,
    role: optionalText(input.role, "Role"),
    text,
  };
}

function humanList(values: string[]) {
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export function buildPublicationConsent({
  brandName,
  privacyContact,
  suppliedIdentity,
}: {
  brandName: string;
  privacyContact: string;
  suppliedIdentity: {
    avatarSupplied: boolean;
    company?: string;
    name: string;
    rating?: number;
    role?: string;
  };
}) {
  const identityFields: PublicIdentityField[] = ["name"];
  if (suppliedIdentity.avatarSupplied) identityFields.push("avatar");
  if (suppliedIdentity.role) identityFields.push("role");
  if (suppliedIdentity.company) identityFields.push("company");
  if (suppliedIdentity.rating !== undefined) identityFields.push("rating");
  const disclosedFields = humanList(identityFields);

  return {
    identityFields,
    text: `I authorize ${brandName} to publish this testimonial and my ${disclosedFields} on its website, hosted proof wall, and embedded proof wall, without compensation. I can withdraw this permission by contacting ${privacyContact}.`,
    version: publicationConsentVersion,
  };
}
