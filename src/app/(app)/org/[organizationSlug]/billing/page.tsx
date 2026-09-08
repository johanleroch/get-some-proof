import { redirect } from "next/navigation";

export default async function OrganizationBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const query = new URLSearchParams();
  if (checkout) query.set("checkout", checkout);
  if (query.size) redirect(`/account/billing?${query}`);
  redirect("/account/billing");
}
