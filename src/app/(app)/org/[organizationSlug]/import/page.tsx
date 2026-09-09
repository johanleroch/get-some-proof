import { TestimonialImport } from "@/components/testimonials/testimonial-import";

export default async function TestimonialImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ job?: string | string[] }>;
}) {
  const { organizationSlug } = await params;
  const { job } = await searchParams;
  return (
    <TestimonialImport
      slug={organizationSlug}
      initialJobId={typeof job === "string" ? job : undefined}
    />
  );
}
