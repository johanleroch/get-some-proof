import Stripe from "stripe";

const lookupKey = "pro_monthly";
const secretKey = process.env.STRIPE_SECRET_KEY;

function fail(message) {
  console.error(`Stripe catalog check failed: ${message}`);
  process.exitCode = 1;
}

if (!secretKey?.startsWith("sk_test_")) {
  fail("STRIPE_SECRET_KEY must be a test-mode server credential.");
} else {
  const stripe = new Stripe(secretKey);
  const prices = await stripe.prices.list({
    active: true,
    expand: ["data.product"],
    limit: 2,
    lookup_keys: [lookupKey],
    type: "recurring",
  });

  const price = prices.data.length === 1 ? prices.data[0] : null;
  const product =
    price && typeof price.product === "object" && !("deleted" in price.product)
      ? price.product
      : null;

  if (!price || !product) {
    fail(`${lookupKey} must resolve to exactly one active Product and Price.`);
  } else if (
    !price.active ||
    !product.active ||
    price.currency !== "eur" ||
    price.recurring?.interval !== "month" ||
    price.unit_amount === null
  ) {
    fail(`${lookupKey} must be an active EUR monthly recurring Price.`);
  } else {
    console.log(
      JSON.stringify({
        amount: price.unit_amount,
        currency: price.currency,
        features: product.marketing_features
          .map(({ name }) => name)
          .filter(Boolean),
        interval: price.recurring.interval,
        lookupKey,
        name: product.name,
        status: "ok",
      }),
    );
  }
}
