"use node";

import { ConvexError, v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { action, env, type ActionCtx } from "./_generated/server";
import { isStripeConfigured } from "./stripeConfiguration";

const invoiceValidator = v.object({
  id: v.string(),
  number: v.union(v.string(), v.null()),
  created: v.number(),
  amount: v.number(),
  currency: v.string(),
  status: v.string(),
  pdfUrl: v.union(v.string(), v.null()),
  hostedUrl: v.union(v.string(), v.null()),
});

export type InvoicePage = {
  invoices: Array<{
    id: string;
    number: string | null;
    created: number;
    amount: number;
    currency: string;
    status: string;
    pdfUrl: string | null;
    hostedUrl: string | null;
  }>;
  nextCursor: string | null;
};

type InvoiceReader = (params: Stripe.InvoiceListParams) => Promise<{
  data: Stripe.Invoice[];
  has_more: boolean;
}>;

function stripeInvoiceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["invoice.stripe.com", "pay.stripe.com"].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}

const readStripeInvoices: InvoiceReader = async (params) => {
  if (
    !isStripeConfigured({
      mode: env.STRIPE_MODE,
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    })
  ) {
    throw new ConvexError({
      code: "BILLING_UNAVAILABLE",
      message: "Invoices are temporarily unavailable. Please try again.",
    });
  }
  return new Stripe(env.STRIPE_SECRET_KEY!).invoices.list(params);
};

export async function listAccountInvoicesHandler(
  ctx: ActionCtx,
  args: { cursor?: string },
  readInvoices: InvoiceReader = readStripeInvoices,
): Promise<InvoicePage> {
  // Identity and customer mapping come exclusively from the authenticated Account.
  const { customerId } = await ctx.runQuery(
    internal.accounts.getBillingContext,
    {},
  );
  if (!customerId) return { invoices: [], nextCursor: null };
  if (args.cursor && !/^in_[a-zA-Z0-9]{1,128}$/.test(args.cursor)) {
    throw new ConvexError({
      code: "INVALID_CURSOR",
      message: "Reload your invoices to continue.",
    });
  }
  const page = await readInvoices({
    customer: customerId,
    limit: 20,
    starting_after: args.cursor,
  });
  const invoices: InvoicePage["invoices"] = [];
  for (const invoice of page.data) {
    const owner =
      typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;
    if (
      owner !== customerId ||
      invoice.status === "draft" ||
      invoice.status === null
    )
      continue;
    invoices.push({
      id: invoice.id,
      number: invoice.number,
      created: invoice.created,
      amount: invoice.total,
      currency: invoice.currency,
      status: invoice.status,
      pdfUrl: stripeInvoiceUrl(invoice.invoice_pdf),
      hostedUrl: stripeInvoiceUrl(invoice.hosted_invoice_url),
    });
  }
  return {
    invoices,
    nextCursor: page.has_more
      ? (page.data[page.data.length - 1]?.id ?? null)
      : null,
  };
}

export const listAccountInvoices = action({
  args: { cursor: v.optional(v.string()) },
  returns: v.object({
    invoices: v.array(invoiceValidator),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: (ctx, args): Promise<InvoicePage> =>
    listAccountInvoicesHandler(ctx, args),
});
