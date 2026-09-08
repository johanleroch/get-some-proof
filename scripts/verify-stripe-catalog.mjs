import Stripe from "stripe";

const expectedPrices = [
  { lookupKey: "pro_monthly", interval: "month", amount: 2900 },
  { lookupKey: "pro_annual", interval: "year", amount: 29000 },
];
const managedPaymentsTaxCode = "txcd_10103001";
const secretKey = process.env.STRIPE_SECRET_KEY;

function fail(message) {
  console.error(`Stripe catalog check failed: ${message}`);
  process.exitCode = 1;
}

if (!secretKey?.startsWith("sk_test_")) {
  fail("STRIPE_SECRET_KEY must be a test-mode server credential.");
} else {
  const stripe = new Stripe(secretKey);
  for (const { lookupKey, interval, amount } of expectedPrices) {
    const prices = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
      limit: 2,
      lookup_keys: [lookupKey],
      type: "recurring",
    });

    const price = prices.data.length === 1 ? prices.data[0] : null;
    const product =
      price &&
      typeof price.product === "object" &&
      !("deleted" in price.product)
        ? price.product
        : null;

    if (!price || !product) {
      fail(
        `${lookupKey} must resolve to exactly one active Product and Price.`,
      );
    } else if (
      !price.active ||
      !product.active ||
      price.currency !== "eur" ||
      price.recurring?.interval !== interval ||
      price.recurring?.interval_count !== 1 ||
      price.unit_amount !== amount ||
      product.tax_code !== managedPaymentsTaxCode ||
      price.unit_amount === null
    ) {
      fail(
        `${lookupKey} must be an active EUR ${interval} recurring Price at ${amount} cents whose Product uses the SaaS business tax code required by Managed Payments.`,
      );
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
          taxCode: product.tax_code,
        }),
      );
    }
  }
}
