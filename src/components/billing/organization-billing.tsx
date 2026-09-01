"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CircleAlert, CreditCard, Mail } from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BillingPageLoading } from "./billing-page-loading";

function billingErrorMessage(error: unknown) {
  if (!(error instanceof Error))
    return "The Billing Contact could not be saved.";
  if (error.message.includes("INVALID_BILLING_CONTACT")) {
    return "Enter a valid Billing Contact email address.";
  }
  return error.message;
}

type PremiumLookupKey = "premium_monthly" | "premium_annual";

type PublicOffer = {
  amount: number;
  currency: string;
  interval: "month" | "year";
  lookupKey: PremiumLookupKey;
};

function formatOfferAmount(offer: PublicOffer) {
  return new Intl.NumberFormat(undefined, {
    currency: offer.currency,
    maximumFractionDigits: offer.amount % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(offer.amount / 100);
}

export function OrganizationBilling({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const overview = useQuery(
    api.billing.getOverview,
    organization ? { organizationId: organization.id } : "skip",
  );
  const updateContact = useMutation(api.billing.updateContact);
  const getOffers = useAction(api.billingActions.getOffers);
  const startCheckout = useAction(api.billingActions.startCheckout);
  const searchParams = useSearchParams();
  const checkoutReturn = searchParams.get("checkout");
  const organizationId = organization?.id;
  const [offers, setOffers] = useState<PublicOffer[] | undefined>();
  const [offersError, setOffersError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId || overview?.availability !== "available") return;

    let active = true;
    void getOffers({ organizationId })
      .then((result) => {
        if (!active) return;
        setOffers(result);
        setOffersError(null);
      })
      .catch(() => {
        if (!active) return;
        setOffersError(
          "Premium prices could not be loaded. Try again shortly.",
        );
      });

    return () => {
      active = false;
    };
  }, [getOffers, organizationId, overview?.availability]);

  if (organization === undefined || (organization && overview === undefined)) {
    return <BillingPageLoading />;
  }

  if (organization === null) {
    return (
      <section className="grid min-h-[50vh] place-items-center px-6 text-center">
        <div>
          <h1 className="dashboard-page-title">Organization unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This Organization does not exist or your Membership is inactive.
          </p>
        </div>
      </section>
    );
  }

  if (!overview) return null;

  return (
    <BillingCockpit
      onUpdateContact={(email) =>
        updateContact({ organizationId: organization.id, email })
      }
      checkoutReturn={
        checkoutReturn === "success" || checkoutReturn === "canceled"
          ? checkoutReturn
          : null
      }
      navigateToCheckout={(url) => window.location.assign(url)}
      offers={offers}
      offersError={offersError}
      onStartCheckout={(lookupKey) =>
        startCheckout({ organizationId: organization.id, lookupKey })
      }
      overview={overview}
    />
  );
}

export function BillingCockpit({
  checkoutReturn = null,
  navigateToCheckout = (url) => window.location.assign(url),
  offers,
  offersError = null,
  onStartCheckout,
  onUpdateContact,
  overview,
}: {
  checkoutReturn?: "success" | "canceled" | null;
  navigateToCheckout?: (url: string) => void;
  offers?: PublicOffer[];
  offersError?: string | null;
  onStartCheckout?: (lookupKey: PremiumLookupKey) => Promise<{ url: string }>;
  onUpdateContact: (email: string) => Promise<unknown>;
  overview: {
    availability: "available" | "unavailable";
    billingContact: string | null;
    canManage: boolean;
    effectivePlan: "free" | "premium";
  };
}) {
  const [contactPending, setContactPending] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [selectedLookupKey, setSelectedLookupKey] =
    useState<PremiumLookupKey>("premium_monthly");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overview.canManage) return;
    setContactPending(true);
    setMessage(null);
    setError(null);
    try {
      await onUpdateContact(
        String(new FormData(event.currentTarget).get("email")),
      );
      setMessage("Billing Contact updated.");
    } catch (caught) {
      setError(billingErrorMessage(caught));
    } finally {
      setContactPending(false);
    }
  }

  async function beginCheckout() {
    if (checkoutPending || !overview.canManage || !onStartCheckout) return;

    setCheckoutPending(true);
    setCheckoutError(null);
    try {
      const result = await onStartCheckout(selectedLookupKey);
      navigateToCheckout(result.url);
    } catch (caught) {
      setCheckoutError(
        caught instanceof Error
          ? caught.message
          : "Stripe Checkout could not be started.",
      );
      setCheckoutPending(false);
    }
  }

  const returnMessage =
    checkoutReturn === "success"
      ? {
          title: "Payment received",
          description:
            "We’re confirming your Premium subscription with Stripe. Your plan will update automatically after confirmation.",
        }
      : checkoutReturn === "canceled"
        ? {
            title: "Checkout canceled",
            description:
              "No billing change was made. You can choose a plan and try again whenever you’re ready.",
          }
        : null;

  return (
    <section
      aria-labelledby="billing-heading"
      className="mx-auto w-full max-w-5xl space-y-6"
    >
      <div>
        <h1 className="dashboard-page-title" id="billing-heading">
          Billing
        </h1>
        <p className="dashboard-page-description mt-1 max-w-2xl">
          Review this Organization&apos;s plan and manage where billing notices
          are sent.
        </p>
      </div>

      {overview.availability === "unavailable" ? (
        <div
          className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
          role="status"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Billing is not connected</p>
            <p className="mt-1 text-current/75">
              This Organization safely remains on Free. No payment action is
              available yet.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="bg-muted/40 flex gap-3 rounded-xl border p-4 text-sm"
          role="status"
        >
          <CreditCard aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              {returnMessage?.title ?? "Billing is connected"}
            </p>
            <p className="text-muted-foreground mt-1">
              {returnMessage?.description ??
                "This Organization is on Free. Premium checkout will be handled securely by Stripe."}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="bg-muted grid size-9 place-items-center rounded-lg">
                  <CreditCard aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <CardTitle>Current plan</CardTitle>
                  <CardDescription className="mt-1">
                    Applied to the whole Organization
                  </CardDescription>
                </div>
              </div>
              <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium">
                {overview.effectivePlan === "premium" ? "Premium" : "Free"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm leading-6">
              {overview.effectivePlan === "premium"
                ? "Premium unlocks Project management for every Member with the right role."
                : "Free keeps existing Organization data available. Premium upgrades will unlock Project management for every Member with the right role."}
            </p>
            <div className="bg-muted/40 rounded-lg border p-4">
              <p className="text-sm font-medium">
                {overview.effectivePlan === "premium"
                  ? "Premium access is active"
                  : "No active subscription"}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {overview.effectivePlan === "premium"
                  ? "Stripe has synchronized a subscription that grants Premium."
                  : overview.availability === "unavailable"
                    ? "Stripe is unavailable, so no checkout or renewal can start."
                    : "No Stripe subscription is active for this Organization."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="bg-muted grid size-9 place-items-center rounded-lg">
                <Mail aria-hidden="true" className="size-4" />
              </span>
              <div>
                <CardTitle>Billing Contact</CardTitle>
                <CardDescription className="mt-1">
                  Receives subscription and payment notices
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {overview.canManage ? (
              <form className="space-y-4" onSubmit={saveContact}>
                <div className="space-y-2">
                  <Label htmlFor="billing-contact">Billing Contact email</Label>
                  <Input
                    autoComplete="email"
                    defaultValue={overview.billingContact ?? ""}
                    id="billing-contact"
                    name="email"
                    placeholder="accounts@company.com"
                    required
                    type="email"
                  />
                </div>
                {message ? (
                  <p
                    aria-live="polite"
                    className="text-sm text-emerald-700 dark:text-emerald-300"
                  >
                    {message}
                  </p>
                ) : null}
                {error ? (
                  <p aria-live="assertive" className="text-destructive text-sm">
                    {error}
                  </p>
                ) : null}
                <Button disabled={contactPending} type="submit">
                  {contactPending ? "Saving…" : "Save contact"}
                </Button>
              </form>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p className="mt-1 text-sm font-medium break-all">
                    {overview.billingContact ?? "Not configured"}
                  </p>
                </div>
                <p className="text-muted-foreground text-xs leading-5">
                  Billing is read-only for Admins. Ask an Owner to update the
                  contact or manage the subscription.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {overview.availability === "available" &&
        overview.effectivePlan === "free" ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Upgrade to Premium</CardTitle>
              <CardDescription>
                Choose the cadence for this Organization. Prices are loaded
                directly from the active Stripe catalog.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {offersError ? (
                <p aria-live="assertive" className="text-destructive text-sm">
                  {offersError}
                </p>
              ) : offers ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {offers.map((offer) => {
                    const selected = selectedLookupKey === offer.lookupKey;
                    const cadence =
                      offer.interval === "month" ? "Monthly" : "Annual";
                    return (
                      <button
                        aria-pressed={selected}
                        className="aria-pressed:border-primary aria-pressed:bg-primary/5 rounded-xl border p-4 text-left transition-colors disabled:opacity-60"
                        disabled={checkoutPending}
                        key={offer.lookupKey}
                        onClick={() => setSelectedLookupKey(offer.lookupKey)}
                        type="button"
                      >
                        <span className="block text-sm font-medium">
                          {cadence}
                        </span>
                        <span className="mt-2 block text-2xl font-semibold">
                          {formatOfferAmount(offer)}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-xs">
                          per {offer.interval}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p aria-live="polite" className="text-muted-foreground text-sm">
                  Loading Premium prices…
                </p>
              )}

              <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Payment finishes securely on Stripe
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Your plan changes only after Stripe confirms the
                    subscription.
                  </p>
                </div>
                {overview.canManage ? (
                  <Button
                    disabled={checkoutPending || !offers?.length}
                    onClick={beginCheckout}
                    type="button"
                  >
                    {checkoutPending ? "Opening Stripe…" : "Continue to Stripe"}
                  </Button>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    An Owner must start Checkout.
                  </p>
                )}
              </div>
              {checkoutError ? (
                <p aria-live="assertive" className="text-destructive text-sm">
                  {checkoutError}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
