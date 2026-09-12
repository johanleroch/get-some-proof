import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function BillingPageLoading() {
  return (
    <section
      className="mx-auto w-full max-w-5xl space-y-6"
      aria-busy="true"
      aria-label="Loading Billing"
    >
      <PageHeader
        title="Billing"
        description="Review this Account's plan and manage where billing notices are sent."
      />
      <div className="bg-surface-2 space-y-2 rounded-lg p-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-3/4" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
            <Skeleton className="mt-1 h-5 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Billing Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-36" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Manage with Stripe</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-11 w-48" />
        </CardContent>
      </Card>
    </section>
  );
}
