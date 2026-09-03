const defaultPrimaryColor = "#6d5dfc";

export function normalizeBrandName(name: string) {
  const normalized = name.trim().replaceAll(/\s+/g, " ");

  if (normalized.length < 2 || normalized.length > 80) {
    throw new Error("Brand names must contain between 2 and 80 characters.");
  }

  return normalized;
}

export function publicSlugFromBrandName(name: string) {
  return name
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 48)
    .replaceAll(/-+$/g, "");
}

export function normalizePublicSlug(value: string) {
  const normalized = publicSlugFromBrandName(value);

  if (normalized.length < 2) {
    throw new Error("Public Slugs must contain at least 2 letters or numbers.");
  }

  return normalized;
}

export function normalizePrimaryColor(value?: string) {
  if (!value) return defaultPrimaryColor;
  const normalized = value.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    throw new Error("Primary color must be a six-digit hexadecimal color.");
  }
  return normalized;
}

export function normalizeCollectionFormTitle(
  value: string | undefined,
  name: string,
) {
  const normalized = value?.trim() || defaultCollectionFormTitle(name);
  if (normalized.length < 2 || normalized.length > 100) {
    throw new Error(
      "Collection Form titles must contain between 2 and 100 characters.",
    );
  }
  return normalized;
}

export function defaultCollectionFormTitle(name: string) {
  return `Share your experience with ${name}`.slice(0, 100).trimEnd();
}

export function normalizeCollectionFormDescription(value?: string) {
  const normalized = value?.trim() || "Tell us what changed for you.";
  if (normalized.length > 500) {
    throw new Error(
      "Collection Form descriptions cannot exceed 500 characters.",
    );
  }
  return normalized;
}

export function normalizePrivacyContact(
  value: string | undefined,
  fallback: string,
) {
  const normalized = (value || fallback).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Privacy contact must be a valid email address.");
  }
  return normalized;
}
