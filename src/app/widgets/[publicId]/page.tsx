import Script from "next/script";
import { notFound } from "next/navigation";
export const metadata = {
  title: "Customer testimonials",
  robots: { index: false, follow: false },
};
export default async function PublicWidgetPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(publicId)) notFound();
  return (
    <main className="mx-auto w-full max-w-6xl p-5 sm:p-8">
      <div data-gsp-widget={publicId} />
      <Script src="/embed/v2.js" strategy="afterInteractive" />
    </main>
  );
}
