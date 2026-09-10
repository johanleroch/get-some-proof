import { TestimonialInbox } from "@/components/testimonials/testimonial-inbox";

export default async function OrganizationInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams?: Promise<{ import?: string | string[] }>;
}) {
  const { organizationSlug } = await params;
  const query = await searchParams;
  const importJobId = Array.isArray(query?.import) ? "" : query?.import;
  return (
    <TestimonialInbox
      slug={organizationSlug}
      {...(importJobId !== undefined ? { importJobId } : {})}
    />
  );
}
