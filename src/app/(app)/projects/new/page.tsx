import { OrganizationOnboardingForm } from "@/components/organizations/organization-onboarding-form";
import { PageHeader } from "@/components/page-header";

export default function NewProjectPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Create project"
        description="Give this business its own identity and collection form. All your projects share your account's plan and quotas."
      />
      <OrganizationOnboardingForm />
    </div>
  );
}
