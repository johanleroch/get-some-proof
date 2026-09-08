import Stripe from "stripe";

// Creates only synthetic sandbox records. It never sends an invoice email.
const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_"))
  throw new Error("A Stripe test-mode secret is required.");
const stripe = new Stripe(key);
const customer = await stripe.customers.create({
  name: "Billing verification fixture",
  metadata: { purpose: "gsp-invoice-verification" },
});
const draft = await stripe.invoices.create({
  customer: customer.id,
  auto_advance: false,
  collection_method: "charge_automatically",
});
await stripe.invoiceItems.create({
  customer: customer.id,
  invoice: draft.id,
  currency: "eur",
  amount: 29000,
  description: "Annual Pro verification",
});
await stripe.invoices.finalizeInvoice(draft.id, { auto_advance: false });
const invoice = await stripe.invoices.pay(draft.id, { paid_out_of_band: true });
const page = await stripe.invoices.list({ customer: customer.id, limit: 20 });
if (
  invoice.livemode ||
  !page.data.some(
    (item) =>
      item.id === invoice.id && item.status === "paid" && item.total === 29000,
  )
)
  throw new Error("Invoice listing mismatch.");
let verifiedPdf = false;
for (let attempt = 0; attempt < 5; attempt++) {
  const fresh = await stripe.invoices.retrieve(invoice.id);
  if (fresh.invoice_pdf) {
    const response = await fetch(fresh.invoice_pdf);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (response.ok && bytes.subarray(0, 4).toString() === "%PDF") {
      verifiedPdf = true;
      break;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
if (!verifiedPdf) throw new Error("Invoice PDF could not be downloaded.");
const portal = await stripe.billingPortal.sessions.create({
  customer: customer.id,
  return_url: "http://localhost:3002/account/billing",
});
const configuration = await stripe.billingPortal.configurations.retrieve(
  typeof portal.configuration === "string"
    ? portal.configuration
    : portal.configuration.id,
);
if (!portal.url || !configuration.features.invoice_history.enabled)
  throw new Error("Portal invoice history is disabled.");
console.log(
  JSON.stringify({
    mode: "test",
    invoiceId: invoice.id,
    invoiceStatus: invoice.status,
    amount: invoice.total,
    pdfDownloaded: verifiedPdf,
    portalCreated: true,
    invoiceHistoryEnabled: true,
  }),
);
