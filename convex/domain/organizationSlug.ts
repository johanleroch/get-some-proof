const suffixAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

export function normalizeOrganizationName(name: string) {
  const normalized = name.trim().replaceAll(/\s+/g, " ");

  if (normalized.length < 2 || normalized.length > 80) {
    throw new Error(
      "Organization names must contain between 2 and 80 characters.",
    );
  }

  return normalized;
}

export function organizationSlugBase(name: string) {
  const base = name
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 44)
    .replaceAll(/-+$/g, "");

  return base || "organization";
}

export function randomSlugSuffix() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);

  return Array.from(
    bytes,
    (byte) => suffixAlphabet[byte % suffixAlphabet.length],
  ).join("");
}

export function buildOrganizationSlug(name: string, suffix: string) {
  if (!/^[a-z0-9]{4}$/.test(suffix)) {
    throw new Error(
      "Organization slug suffixes must use four lowercase characters.",
    );
  }

  return `${organizationSlugBase(name)}-${suffix}`;
}
