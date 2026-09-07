import { BrandMark } from "@/components/brand-mark";
import { OrganizationOnboardingForm } from "@/components/organizations/organization-onboarding-form";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { productName } from "@/lib/brand";

export default function OrganizationOnboardingPage() {
  return (
    <main className="bg-paper min-h-svh px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-ink text-sm font-semibold tracking-[-0.008em]">
              {productName}
            </span>
          </div>
          <ThemeToggle />
        </div>
        <PageHeader
          description="Set the public identity and Collection Form your customers will see."
          eyebrow="First step"
          title="Create your Brand"
        />
        <OrganizationOnboardingForm />
      </div>
    </main>
  );
}
