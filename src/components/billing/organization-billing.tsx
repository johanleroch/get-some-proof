"use client";

import { type FormEvent, useState } from "react";
import { CircleAlert, CreditCard, Mail } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

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

export function OrganizationBilling({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const overview = useQuery(
    api.billing.getOverview,
    organization ? { organizationId: organization.id } : "skip",
  );
  const updateContact = useMutation(api.billing.updateContact);

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
      overview={overview}
    />
  );
}

export function BillingCockpit({
  onUpdateContact,
  overview,
}: {
  onUpdateContact: (email: string) => Promise<unknown>;
  overview: {
    availability: "available" | "unavailable";
    billingContact: string | null;
    canManage: boolean;
    effectivePlan: "free";
  };
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overview.canManage) return;
    setPending(true);
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
      setPending(false);
    }
  }

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
            <p className="font-medium">Billing is connected</p>
            <p className="text-muted-foreground mt-1">
              This Organization is on Free. Premium checkout will be handled
              securely by Stripe.
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
                Free
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm leading-6">
              Free keeps existing Organization data available. Premium upgrades
              will unlock Project management for every Member with the right
              role.
            </p>
            <div className="bg-muted/40 rounded-lg border p-4">
              <p className="text-sm font-medium">No active subscription</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {overview.availability === "unavailable"
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
                <Button disabled={pending} type="submit">
                  {pending ? "Saving…" : "Save contact"}
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
      </div>
    </section>
  );
}
