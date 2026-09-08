import Stripe from "stripe";

// Explicit sandbox-only setup. Never changes existing subscriptions or prices.
const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_"))
  throw new Error("A Stripe test-mode secret is required.");
const stripe = new Stripe(key);
const prices = await stripe.prices.list({
  active: true,
  lookup_keys: ["pro_monthly", "pro_annual"],
  limit: 10,
});
const monthly = prices.data.find((price) => price.lookup_key === "pro_monthly");
if (
  !monthly ||
  monthly.livemode ||
  monthly.currency !== "eur" ||
  monthly.unit_amount !== 2900 ||
  monthly.recurring?.interval !== "month" ||
  monthly.recurring.interval_count !== 1
)
  throw new Error("Expected the existing EUR 29 monthly Pro test price.");
const product =
  typeof monthly.product === "string" ? monthly.product : monthly.product.id;
let annual = prices.data.find((price) => price.lookup_key === "pro_annual");
if (!annual)
  annual = await stripe.prices.create(
    {
      product,
      currency: "eur",
      unit_amount: 29000,
      recurring: { interval: "year", interval_count: 1 },
      lookup_key: "pro_annual",
      tax_behavior: monthly.tax_behavior,
      nickname: "Pro annual · 2 months free",
    },
    { idempotencyKey: `gsp-pro-annual-29000-${product}` },
  );
if (
  annual.livemode ||
  annual.currency !== "eur" ||
  annual.unit_amount !== 29000 ||
  annual.recurring?.interval !== "year" ||
  annual.recurring.interval_count !== 1 ||
  annual.product !== product
)
  throw new Error(
    "The existing annual price does not match the approved offer.",
  );
console.log(
  JSON.stringify({
    mode: "test",
    monthly: monthly.id,
    annual: annual.id,
    annualAmount: annual.unit_amount,
    currency: annual.currency,
  }),
);
