import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { ActionCtx } from "./_generated/server";
import { listAccountInvoicesHandler } from "./billingInvoices";

const invoice = (overrides: Partial<Stripe.Invoice> = {}) =>
  ({
    id: "in_owned",
    customer: "cus_owner",
    number: "GSP-2026-001",
    created: 1790000000,
    total: 29000,
    currency: "eur",
    status: "paid",
    invoice_pdf: "https://invoice.stripe.com/i/example/pdf",
    hosted_invoice_url: "https://invoice.stripe.com/i/example",
    ...overrides,
  }) as Stripe.Invoice;
const context = (customerId: string | null) =>
  ({
    runQuery: vi.fn().mockResolvedValue({ customerId }),
  }) as unknown as ActionCtx;

describe("Account invoice projection", () => {
  it("requests only the authenticated customer's bounded page and returns download links", async () => {
    const read = vi
      .fn()
      .mockResolvedValue({ data: [invoice()], has_more: true });
    await expect(
      listAccountInvoicesHandler(
        context("cus_owner"),
        { cursor: "in_previous" },
        read,
      ),
    ).resolves.toMatchObject({
      invoices: [
        {
          amount: 29000,
          pdfUrl: "https://invoice.stripe.com/i/example/pdf",
          status: "paid",
        },
      ],
      nextCursor: "in_owned",
    });
    expect(read).toHaveBeenCalledWith({
      customer: "cus_owner",
      limit: 20,
      starting_after: "in_previous",
    });
  });
  it("does not return drafts, another customer's invoices, or unsafe URLs", async () => {
    const read = vi.fn().mockResolvedValue({
      data: [
        invoice({ status: "draft" }),
        invoice({ customer: "cus_other" }),
        invoice({
          id: "in_safe",
          invoice_pdf: "javascript:alert(1)",
          hosted_invoice_url: "https://attacker.invalid",
        }),
      ],
      has_more: false,
    });
    await expect(
      listAccountInvoicesHandler(context("cus_owner"), {}, read),
    ).resolves.toMatchObject({
      invoices: [{ id: "in_safe", pdfUrl: null, hostedUrl: null }],
      nextCursor: null,
    });
  });
  it("returns an empty history without making a Stripe request for a new Free account", async () => {
    const read = vi.fn();
    expect(await listAccountInvoicesHandler(context(null), {}, read)).toEqual({
      invoices: [],
      nextCursor: null,
    });
    expect(read).not.toHaveBeenCalled();
  });
  it("checks authentication before requesting Stripe and rejects malformed cursors", async () => {
    const read = vi.fn();
    const ctx = {
      runQuery: vi.fn().mockRejectedValue(new Error("Unauthenticated")),
    } as unknown as ActionCtx;
    await expect(listAccountInvoicesHandler(ctx, {}, read)).rejects.toThrow(
      "Unauthenticated",
    );
    await expect(
      listAccountInvoicesHandler(
        context("cus_owner"),
        { cursor: "not an invoice" },
        read,
      ),
    ).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
});
