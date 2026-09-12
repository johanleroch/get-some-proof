const verifiedField =
  "    verified: v.optional(v.union(v.null(), v.boolean())),";
const lockoutFields = `${verifiedField}
    failedVerificationCount: v.optional(v.union(v.null(), v.number())),
    lockedUntil: v.optional(v.union(v.null(), v.number())),`;

export function addBetterAuthCompatibilityFields(source) {
  const hasFailedCount = source.includes("failedVerificationCount:");
  const hasLockedUntil = source.includes("lockedUntil:");

  if (hasFailedCount && hasLockedUntil) return source;

  if (hasFailedCount || hasLockedUntil || !source.includes(verifiedField)) {
    throw new Error(
      "Could not extend the Better Auth twoFactor schema: expected anchor not found.",
    );
  }

  return source.replace(verifiedField, lockoutFields);
}
