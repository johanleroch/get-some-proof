import Image from "next/image";

import { CameraTripod, SpeechBubbleStars } from "@/components/doodles";
import { accentInk } from "@/lib/color-contrast";

/**
 * Static preview of the public Collection Form's first step, driven by the
 * onboarding form's current values. Decorative: the real form lives at /c.
 */
export function CollectionFormPreview({
  accentColor,
  description,
  logoUrl,
  name,
  title,
}: {
  accentColor: string;
  description: string;
  logoUrl: string | null;
  name: string;
  title: string;
}) {
  const brandName = name.trim() || "Your Brand";
  const ink = accentInk(accentColor);

  return (
    <div
      aria-hidden="true"
      className="bg-surface overflow-hidden rounded-xl border"
      data-slot="collection-form-preview"
    >
      <div className="space-y-5 p-6">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <Image
              alt=""
              className="size-12 rounded-xl object-cover"
              height={48}
              src={logoUrl}
              unoptimized
              width={48}
            />
          ) : (
            <span
              className="grid size-12 place-items-center rounded-xl text-base font-semibold"
              style={{ background: accentColor, color: ink }}
            >
              {brandName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="text-ink-2 type-small">{brandName}</span>
        </div>
        <div className="space-y-1.5">
          <p className="type-heading text-balance">
            {title.trim() ||
              (name.trim()
                ? `Share your ${brandName} story`
                : "Share your story")}
          </p>
          <p className="type-body text-ink-2">
            {description.trim() || "Tell us what changed for you."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3].map((step) => (
            <span
              className="bg-surface-2 h-1.5 flex-1 rounded-full"
              key={step}
              style={step === 0 ? { background: accentColor } : undefined}
            />
          ))}
        </div>
        <div className="space-y-2">
          <p className="type-ui font-semibold">What would you like to share?</p>
          {/* Mirrors the real Collection Form: this card is as narrow as a
              phone, so it shows the band the phone shows. A preview that
              flatters is a preview that lies. */}
          <ul className="space-y-2">
            {[
              {
                hint: "Write 20 to 2,000 characters",
                label: "Send a text testimonial",
                Spot: SpeechBubbleStars,
                verb: "Write it",
              },
              {
                hint: "Up to 2 minutes",
                label: "Record or upload a video",
                Spot: CameraTripod,
                verb: "Film it",
              },
            ].map(({ hint, label, Spot, verb }) => (
              <li
                className="border-line flex items-center gap-3 rounded-lg border py-3 pr-3 pl-4"
                key={label}
              >
                <span className="min-w-0 flex-1">
                  <span className="type-subheading block">{verb}</span>
                  <span className="text-ink-2 type-small mt-0.5 block truncate">
                    {label}
                  </span>
                  <span className="text-ink-2 type-small block">{hint}</span>
                </span>
                <Spot className="text-ink h-12 shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
