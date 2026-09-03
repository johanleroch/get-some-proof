export function isStripeSandboxConfigured(input: {
  secretKey?: string;
  webhookSecret?: string;
}) {
  return Boolean(
    input.secretKey &&
    /^sk_test_[A-Za-z0-9_]{4,}$/.test(input.secretKey) &&
    input.webhookSecret &&
    /^whsec_[A-Za-z0-9_]{4,}$/.test(input.webhookSecret),
  );
}
