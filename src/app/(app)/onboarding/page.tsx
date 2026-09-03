import { OrganizationOnboardingForm } from "@/components/organizations/organization-onboarding-form";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OrganizationOnboardingPage() {
  return (
    <main className="bg-muted/30 relative grid min-h-svh place-items-center px-5 py-16">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <Card className="shadow-xs">
          <CardHeader>
            <p className="text-muted-foreground text-sm font-medium">
              First step
            </p>
            <CardTitle className="text-2xl">Create your Brand</CardTitle>
            <CardDescription>
              Set the public identity and Collection Form your customers will
              see.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationOnboardingForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
