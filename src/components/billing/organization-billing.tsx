"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CircleAlert, CreditCard, ExternalLink, Mail } from "lucide-react";
import { useAction, useQuery } from "convex/react";
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

type SubscriptionDetails = {
  amount: number;
  currency: string;
  interval: "month" | "year";
};

function formatOfferAmount(offer: PublicOffer) {
  return new Intl.NumberFormat(undefined, {
    currency: offer.currency,
    maximumFractionDigits: offer.amount % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(offer.amount / 100);
}

type BillingState =
  | "unavailable"
  | "missing"
  | "active"
  | "trialing"
  | "past_due"
  | "cancellation_scheduled"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "inactive";

type BillingOverview = {
  availability: "available" | "unavailable";
  billingContact: string | null;
  canManage: boolean;
  effectivePlan: "free" | "premium";
  state: BillingState;
  subscription: {
    cancelAt?: number;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number;
    priceRevision: string;
    status: string;
  } | null;
};

const terminalCheckoutStates = new Set<BillingState>([
  "unpaid",
  "canceled",
  "incomplete_expired",
]);

export function canStartNewCheckout(overview: BillingOverview) {
  return (
    overview.subscription === null || terminalCheckoutStates.has(overview.state)
  );
}

function formatBillingDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
    new Date(timestamp * 1_000),
  );
}

export function billingLifecycleCopy(overview: BillingOverview) {
  const accessEnd = overview.subscription
    ? formatBillingDate(overview.subscription.currentPeriodEnd)
    : null;
  switch (overview.state) {
    case "active":
      return {
        description: `Premium is active and renews after ${accessEnd}.`,
        title: "Premium is active",
        tone: "neutral" as const,
      };
    case "trialing":
      return {
        description: `Premium trial access remains available through ${accessEnd}.`,
        title: "Premium trial is active",
        tone: "neutral" as const,
      };
    case "past_due":
      return {
        description:
          "Premium remains available while Stripe retries payment. Update the payment method to prevent interruption.",
        title: "Payment needs attention",
        tone: "warning" as const,
      };
    case "cancellation_scheduled":
      return {
        description: `Premium access remains available through ${accessEnd}. The subscription will not renew after that date.`,
        title: "Cancellation scheduled",
        tone: "warning" as const,
      };
    case "unpaid":
      return {
        description:
          "Premium writes are paused because payment could not be collected. Existing data remains readable.",
        title: "Subscription is unpaid",
        tone: "danger" as const,
      };
    case "canceled":
      return {
        description:
          "The subscription has ended. This Organization is on Free and existing data remains readable.",
        title: "Subscription canceled",
        tone: "neutral" as const,
      };
    case "incomplete_expired":
      return {
        description:
          "The previous subscription setup expired before payment completed. No Premium access was granted.",
        title: "Subscription setup expired",
        tone: "neutral" as const,
      };
    case "incomplete":
      return {
        description:
          "Stripe is waiting for the subscription payment to complete. Premium is not active yet.",
        title: "Subscription setup incomplete",
        tone: "warning" as const,
      };
    case "paused":
      return {
        description:
          "Premium is paused. Existing Organization data remains readable on Free.",
        title: "Subscription paused",
        tone: "warning" as const,
      };
    case "inactive":
      return {
        description:
          "Stripe reported a state that does not grant Premium. Existing data remains readable.",
        title: "Subscription inactive",
        tone: "warning" as const,
      };
    case "missing":
      return {
        description:
          "This Organization is on Free. Premium checkout will be handled securely by Stripe.",
        title: "Billing is connected",
        tone: "neutral" as const,
      };
    case "unavailable":
      return {
        description:
          "This Organization safely remains on Free. No payment action is available yet.",
        title: "Billing is not connected",
        tone: "warning" as const,
      };
  }
}

export function OrganizationBilling({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const overview = useQuery(
    api.billing.getOverview,
    organization ? { organizationId: organization.id } : "skip",
  );
  const updateContact = useAction(api.billingActions.updateContact);
  const getOffers = useAction(api.billingActions.getOffers);
  const getSubscriptionDetails = useAction(
    api.billingActions.getSubscriptionDetails,
  );
  const openPortal = useAction(api.billingActions.openPortal);
  const startCheckout = useAction(api.billingActions.startCheckout);
  const searchParams = useSearchParams();
  const checkoutReturn = searchParams.get("checkout");
  const organizationId = organization?.id;
  const offersKey =
    organizationId &&
    overview?.availability === "available" &&
    canStartNewCheckout(overview)
      ? `${organizationId}:${overview.state}`
      : null;
  const subscriptionDetailsKey =
    organizationId &&
    overview?.availability === "available" &&
    overview.subscription
      ? `${organizationId}:${overview.subscription.priceRevision}`
      : null;
  const [offersResult, setOffersResult] = useState<{
    error: string | null;
    key: string;
    value?: PublicOffer[];
  } | null>(null);
  const [subscriptionDetailsResult, setSubscriptionDetailsResult] = useState<{
    error: string | null;
    key: string;
    value: SubscriptionDetails | null;
  } | null>(null);

  useEffect(() => {
    if (!organizationId || !offersKey) return;

    let active = true;
    void getOffers({ organizationId })
      .then((result) => {
        if (!active) return;
        setOffersResult({ error: null, key: offersKey, value: result });
      })
      .catch(() => {
        if (!active) return;
        setOffersResult({
          error: "Premium prices could not be loaded. Try again shortly.",
          key: offersKey,
        });
      });

    return () => {
      active = false;
    };
  }, [getOffers, offersKey, organizationId]);

  useEffect(() => {
    if (!organizationId || !subscriptionDetailsKey) return;

    let active = true;
    void getSubscriptionDetails({ organizationId })
      .then((result) => {
        if (!active) return;
        setSubscriptionDetailsResult({
          error: null,
          key: subscriptionDetailsKey,
          value: result,
        });
      })
      .catch(() => {
        if (!active) return;
        setSubscriptionDetailsResult({
          error: "The current Stripe price could not be loaded.",
          key: subscriptionDetailsKey,
          value: null,
        });
      });

    return () => {
      active = false;
    };
  }, [getSubscriptionDetails, organizationId, subscriptionDetailsKey]);

  const offers =
    offersResult?.key === offersKey ? offersResult.value : undefined;
  const offersError =
    offersResult?.key === offersKey ? offersResult.error : null;
  const subscriptionDetails =
    subscriptionDetailsResult?.key === subscriptionDetailsKey
      ? subscriptionDetailsResult.value
      : undefined;
  const subscriptionDetailsError =
    subscriptionDetailsResult?.key === subscriptionDetailsKey
      ? subscriptionDetailsResult.error
      : null;

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
      navigateToPortal={(url) => window.location.assign(url)}
      offers={offers}
      offersError={offersError}
      subscriptionDetails={subscriptionDetails}
      subscriptionDetailsError={subscriptionDetailsError}
      onStartCheckout={(lookupKey) =>
        startCheckout({ organizationId: organization.id, lookupKey })
      }
      onOpenPortal={(mode) =>
        openPortal({ organizationId: organization.id, mode })
      }
      overview={overview}
    />
  );
}

export function BillingCockpit({
  checkoutReturn = null,
  navigateToCheckout = (url) => window.location.assign(url),
  navigateToPortal = (url) => window.location.assign(url),
  offers,
  offersError = null,
  subscriptionDetails,
  subscriptionDetailsError = null,
  onStartCheckout,
  onOpenPortal,
  onUpdateContact,
  overview,
}: {
  checkoutReturn?: "success" | "canceled" | null;
  navigateToCheckout?: (url: string) => void;
  navigateToPortal?: (url: string) => void;
  offers?: PublicOffer[];
  offersError?: string | null;
  subscriptionDetails?: SubscriptionDetails | null;
  subscriptionDetailsError?: string | null;
  onStartCheckout?: (lookupKey: PremiumLookupKey) => Promise<{ url: string }>;
  onOpenPortal?: (
    mode: "manage" | "payment_method_update",
  ) => Promise<{ url: string }>;
  onUpdateContact: (email: string) => Promise<unknown>;
  overview: BillingOverview;
}) {
  const [contactPending, setContactPending] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [portalPending, setPortalPending] = useState(false);
  const [selectedLookupKey, setSelectedLookupKey] =
    useState<PremiumLookupKey>("premium_monthly");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);

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

  async function beginPortal(mode: "manage" | "payment_method_update") {
    if (portalPending || !overview.canManage || !onOpenPortal) return;
    setPortalPending(true);
    setPortalError(null);
    try {
      const result = await onOpenPortal(mode);
      navigateToPortal(result.url);
    } catch (caught) {
      setPortalError(
        caught instanceof Error
          ? caught.message
          : "Stripe Customer Portal could not be opened.",
      );
      setPortalPending(false);
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
  const lifecycle = billingLifecycleCopy(overview);

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

      <div
        className={
          lifecycle.tone === "danger"
            ? "flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100"
            : lifecycle.tone === "warning"
              ? "flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
              : "bg-muted/40 flex gap-3 rounded-xl border p-4 text-sm"
        }
        role={
          overview.state === "past_due" || overview.state === "unpaid"
            ? "alert"
            : "status"
        }
      >
        {lifecycle.tone === "neutral" ? (
          <CreditCard aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        ) : (
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        )}
        <div>
          <p className="font-medium">
            {returnMessage?.title ?? lifecycle.title}
          </p>
          <p className="mt-1 text-current/75">
            {returnMessage?.description ?? lifecycle.description}
          </p>
        </div>
      </div>

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
            {overview.subscription ? (
              <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground text-xs">Cadence</dt>
                  <dd className="mt-1 font-medium">
                    {subscriptionDetails?.interval === "month"
                      ? "Monthly"
                      : subscriptionDetails?.interval === "year"
                        ? "Annual"
                        : subscriptionDetails === undefined
                          ? "Loading…"
                          : "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Current period ends
                  </dt>
                  <dd className="mt-1 font-medium">
                    {formatBillingDate(overview.subscription.currentPeriodEnd)}
                  </dd>
                </div>
                {subscriptionDetails ? (
                  <div>
                    <dt className="text-muted-foreground text-xs">Price</dt>
                    <dd className="mt-1 font-medium">
                      {formatOfferAmount({
                        ...subscriptionDetails,
                        lookupKey:
                          subscriptionDetails.interval === "month"
                            ? "premium_monthly"
                            : "premium_annual",
                      })}{" "}
                      per {subscriptionDetails.interval}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Stripe state
                  </dt>
                  <dd className="mt-1 font-medium">{lifecycle.title}</dd>
                </div>
                {subscriptionDetailsError ? (
                  <p
                    aria-live="assertive"
                    className="text-destructive text-xs sm:col-span-2"
                  >
                    {subscriptionDetailsError}
                  </p>
                ) : null}
              </dl>
            ) : null}
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

        {overview.availability === "available" && overview.subscription ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Manage with Stripe</CardTitle>
              <CardDescription>
                Stripe creates a new short-lived Customer Portal session for
                each action. This application never stores the Portal URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Subscription and payment history
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Review invoices, plan changes, cancellation, and payment
                    methods in Stripe.
                  </p>
                </div>
                {overview.canManage ? (
                  <Button
                    disabled={portalPending}
                    onClick={() => void beginPortal("manage")}
                    type="button"
                    variant="outline"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                    {portalPending ? "Opening Stripe…" : "Manage subscription"}
                  </Button>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Billing actions are available to an Owner.
                  </p>
                )}
              </div>

              {overview.state === "past_due" ? (
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Restore healthy payments
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Open Stripe directly on the supported payment method
                      update flow.
                    </p>
                  </div>
                  {overview.canManage ? (
                    <Button
                      disabled={portalPending}
                      onClick={() => void beginPortal("payment_method_update")}
                      type="button"
                    >
                      {portalPending
                        ? "Opening Stripe…"
                        : "Update payment method"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {portalError ? (
                <p aria-live="assertive" className="text-destructive text-sm">
                  {portalError}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {overview.availability === "available" &&
        canStartNewCheckout(overview) ? (
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
