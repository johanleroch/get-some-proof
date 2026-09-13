import { TestimonialImport } from "@/components/testimonials/testimonial-import";

export default async function TestimonialImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{
    job?: string | string[];
    source?: string | string[];
  }>;
}) {
  const { organizationSlug } = await params;
  const { job, source } = await searchParams;
  return (
    <TestimonialImport
      slug={organizationSlug}
      initialSource={typeof source === "string" ? source : undefined}
      initialJobId={typeof job === "string" ? job : undefined}
    />
  );
}
