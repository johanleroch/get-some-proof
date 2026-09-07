import { BrandLogo } from "@/components/brand-logo";
import { OrganizationOnboardingForm } from "@/components/organizations/organization-onboarding-form";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";

export default function OrganizationOnboardingPage() {
  return (
    <main className="bg-paper min-h-svh px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="flex items-center justify-between gap-4">
          <BrandLogo />
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
