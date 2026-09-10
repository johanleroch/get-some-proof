import { PublicTestimonialImport } from "@/components/testimonials/public-testimonial-import";

export const metadata = { title: "Import your testimonials | Get Some Proof" };

export default async function ImportPage({
  searchParams,
}: {
  searchParams?: Promise<{ handoff?: string }>;
}) {
  const failed = (await searchParams)?.handoff === "failed";
  return (
    <main className="bg-paper text-ink min-h-svh p-5 md:p-8 [&_[data-slot=button]]:min-h-11 [&_label:has([role=checkbox])]:min-h-11 [&_label:has([role=checkbox])]:min-w-11">
      <PublicTestimonialImport handoffFailed={failed} />
    </main>
  );
}
