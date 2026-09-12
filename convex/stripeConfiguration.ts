export function isStripeConfigured(input: {
  mode?: string;
  secretKey?: string;
  webhookSecret?: string;
}) {
  const mode = input.mode ?? "test";
  if (mode !== "test" && mode !== "live") return false;

  return Boolean(
    input.secretKey &&
    new RegExp(`^sk_${mode}_[A-Za-z0-9_]{4,}$`).test(input.secretKey) &&
    input.webhookSecret &&
    /^whsec_[A-Za-z0-9_]{4,}$/.test(input.webhookSecret),
  );
}
