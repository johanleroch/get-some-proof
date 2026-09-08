"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { IconDownload, IconExternalLink } from "@tabler/icons-react";
import { api } from "@convex/_generated/api";
import type { InvoicePage } from "@convex/billingInvoices";
import { BlobLoadingText } from "@/components/brand/blob-loader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AccountInvoices({
  canManageBilling,
}: {
  canManageBilling: boolean;
}) {
  const load = useAction(api.billingInvoices.listAccountInvoices);
  const openPortal = useAction(api.billingActions.openAccountPortal);
  const [page, setPage] = useState<InvoicePage>();
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    load({})
      .then((result) => {
        if (active) {
          setPage(result);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [load, attempt]);

  async function loadMore() {
    if (pending || !page?.nextCursor) return;
    setPending(true);
    try {
      const result = await load({ cursor: page.nextCursor });
      setError(false);
      setPage({
        ...result,
        invoices: [
          ...page.invoices,
          ...result.invoices.filter(
            (invoice) => !page.invoices.some(({ id }) => id === invoice.id),
          ),
        ],
      });
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <AccountInvoicesView
      page={page}
      pending={pending}
      error={error}
      canManageBilling={canManageBilling}
      onLoadMore={loadMore}
      onRetry={() => {
        if (pending) return;
        if (page) void loadMore();
        else {
          setPending(true);
          setAttempt((value) => value + 1);
        }
      }}
      onOpenPortal={async () => {
        const { url } = await openPortal({});
        window.location.assign(url);
      }}
    />
  );
}

export function AccountInvoicesView({
  page,
  pending = false,
  error = false,
  canManageBilling,
  onLoadMore,
  onRetry,
  onOpenPortal,
}: {
  page?: InvoicePage;
  pending?: boolean;
  error?: boolean;
  canManageBilling: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onOpenPortal: () => Promise<void>;
}) {
  const [portalPending, setPortalPending] = useState(false);
  const [portalError, setPortalError] = useState(false);
  async function manageBilling() {
    if (portalPending) return;
    setPortalPending(true);
    setPortalError(false);
    try {
      await onOpenPortal();
    } catch {
      setPortalError(true);
    } finally {
      setPortalPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Invoices</CardTitle>
          {canManageBilling ? (
            <Button
              variant="outline"
              loading={portalPending}
              onClick={() => void manageBilling()}
            >
              <IconExternalLink aria-hidden="true" className="size-4" />
              Manage billing
            </Button>
          ) : null}
        </div>
        <CardDescription>
          Download your invoices, including those from previous subscriptions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {portalError ? (
          <p role="alert" className="text-destructive text-sm">
            Billing could not be opened. Please try again.
          </p>
        ) : null}
        {!page && !error ? <BlobLoadingText label="Loading invoices…" /> : null}
        {page?.invoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">No invoices yet.</p>
        ) : null}
        {page && page.invoices.length > 0 ? (
          <ul className="divide-y" aria-label="Invoice history">
            {page.invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium break-all">
                    {invoice.number ?? "Invoice"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }).format(invoice.created * 1000)}{" "}
                    ·{" "}
                    {invoice.status === "paid"
                      ? "Paid"
                      : invoice.status === "open"
                        ? "Awaiting payment"
                        : invoice.status === "void"
                          ? "Void"
                          : invoice.status === "uncollectible"
                            ? "Uncollectible"
                            : "Processing"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium">
                    {new Intl.NumberFormat("en", {
                      style: "currency",
                      currency: invoice.currency,
                    }).format(invoice.amount / 100)}
                  </span>
                  {invoice.pdfUrl ? (
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Download PDF ${invoice.number ?? "invoice"}`}
                      >
                        <IconDownload className="size-4" aria-hidden="true" />
                        Download PDF
                      </a>
                    </Button>
                  ) : invoice.hostedUrl ? (
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={invoice.hostedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View invoice
                      </a>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      PDF unavailable
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p className="text-destructive text-sm">
              Invoices could not be loaded.
            </p>
            <Button variant="outline" loading={pending} onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}
        {page?.nextCursor && !error ? (
          <Button variant="outline" loading={pending} onClick={onLoadMore}>
            Load more invoices
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
