import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { PageHeader } from "@/components/page-header";

/**
 * The first screen after verification (DESIGN.md section 6): the lockup,
 * the header, then the form. Shared by the page, its fixture and the
 * onboarding playground so the three never drift.
 */
export function OrganizationOnboardingScreen({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="bg-paper min-h-svh px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <BrandLogo />
        <PageHeader
          description="This is the identity your customers see when you ask them for a Testimonial. Only the name is needed; we write the rest for you."
          eyebrow="First step"
          title="Create your Brand"
        />
        {children}
      </div>
    </main>
  );
}
