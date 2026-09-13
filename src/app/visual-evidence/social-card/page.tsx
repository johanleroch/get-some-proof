import Image from "next/image";
import { notFound } from "next/navigation";

export default function SocialCardPreview() {
  if (process.env.VISUAL_EVIDENCE_FIXTURES !== "true") notFound();
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="font-display mb-6 text-3xl">Link preview</h1>
      <div className="border-line bg-paper overflow-hidden rounded-xl border">
        <Image
          src="/brand/social-card.png"
          alt="Get Some Proof with the happy amber mascot"
          width={1200}
          height={630}
          unoptimized
          className="h-auto w-full"
        />
        <div className="border-line border-t p-5">
          <p className="text-ink-2 text-sm">getsomeproof.com</p>
          <h2 className="mt-1 text-lg font-semibold">Get Some Proof</h2>
          <p className="text-ink-2 mt-1">
            Collect customer testimonials and publish proof your website can
            use.
          </p>
        </div>
      </div>
    </main>
  );
}
