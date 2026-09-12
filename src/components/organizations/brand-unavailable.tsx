import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Blob } from "@/components/brand/blob";
import { EmptyState } from "@/components/ui/empty-state";

export function BrandUnavailable() {
  return (
    <section className="grid min-h-[50vh] place-items-center px-6">
      <EmptyState
        headingLevel={1}
        className="[&_h1]:text-2xl"
        title="Brand unavailable"
        description="This Brand does not exist or you no longer have access to it."
        action={
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
        illustration={<Blob expression="sad" size={144} />}
      />
    </section>
  );
}
