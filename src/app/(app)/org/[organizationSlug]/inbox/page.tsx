import { TestimonialInbox } from "@/components/testimonials/testimonial-inbox";

export default async function OrganizationInboxPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  return <TestimonialInbox slug={organizationSlug} />;
}
