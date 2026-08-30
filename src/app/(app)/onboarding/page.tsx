import { OrganizationOnboardingForm } from "@/components/organizations/organization-onboarding-form";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OrganizationOnboardingPage() {
  return (
    <main className="bg-muted/35 grid min-h-screen place-items-center px-5 py-12">
      <div className="border-border bg-card w-full max-w-lg rounded-2xl border shadow-sm">
        <CardHeader>
          <p className="text-primary text-sm font-medium">First step</p>
          <CardTitle className="text-2xl">Create your Organization</CardTitle>
          <CardDescription>
            This becomes the secure boundary for your Members, Projects, and
            administration data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationOnboardingForm />
        </CardContent>
      </div>
    </main>
  );
}
