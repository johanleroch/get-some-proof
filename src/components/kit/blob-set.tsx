import { IconArrowLeft } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { BlobLoader } from "@/components/brand/blob-loader";
import { BlobPlayground } from "@/components/kit/blob-playground";
import { BlobToasts } from "@/components/kit/blob-toasts";
import { animatedBlobSvg, blobAnimations } from "@/lib/blob-animations";
import { blobExpressions, blobSvg } from "@/lib/blob-expressions";

/**
 * Development gallery of the blob mascot's expressions. One body, eleven
 * faces; each card shows the expression at 160px and at the sizes the product
 * uses (96, 48, 32). Files for Figma live in public/brand/blob/.
 */
export function BlobSet() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading">Blob expressions</h1>
            <p className="text-muted-foreground type-small">
              One mascot, eleven moods, six motions, one transition. Development
              only.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/kit">
              <IconArrowLeft aria-hidden="true" />
              Kit
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-10 px-6 py-8">
        <section className="max-w-prose">
          <h2 className="type-heading">The set</h2>
          <p className="text-muted-foreground type-body mt-1">
            The body never changes: it is the blob from the official icon,
            gradient and inner shadows included. Only the eyes change, and there
            is never a mouth: shape, tilt, position and size of the eyes carry
            the mood, plus three props (hearts, stars, sunglasses) and one sweat
            drop. Every file is in{" "}
            <code className="font-mono text-[13px]">public/brand/blob/</code>.
          </p>
        </section>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {blobExpressions.map((expression) => (
            <li
              className="bg-card flex flex-col gap-4 rounded-lg border p-5"
              key={expression.name}
            >
              <div
                aria-hidden="true"
                className="mx-auto size-40"
                dangerouslySetInnerHTML={{
                  __html: blobSvg(expression, {
                    id: `card-${expression.name}`,
                  }),
                }}
              />
              <div className="space-y-1">
                <p className="type-subheading">{expression.label}</p>
                <p className="text-muted-foreground type-small">
                  {expression.use}
                </p>
                <p className="text-muted-foreground type-small italic">
                  {expression.how}
                </p>
              </div>
              <div className="flex items-end gap-4 border-t pt-4">
                {[96, 48, 32].map((size) => (
                  <div
                    aria-hidden="true"
                    className="shrink-0"
                    dangerouslySetInnerHTML={{
                      __html: blobSvg(expression, {
                        id: `${expression.name}-${size}`,
                        size,
                      }),
                    }}
                    key={size}
                  />
                ))}
                <p className="text-muted-foreground font-mono text-[11px]">
                  {expression.name}.svg
                </p>
              </div>
            </li>
          ))}
        </ul>

        <section className="space-y-5">
          <div className="max-w-prose">
            <h2 className="type-heading">Animated</h2>
            <p className="text-muted-foreground type-body mt-1">
              Six behaviours for loaders, idle states and success moments, and
              every one of them blinks. Transforms and opacity only, amplitudes
              of 2 to 5%, every squash keeps the volume, the body pivots on its
              base. Reduced motion freezes them on the neutral face. Files in{" "}
              <code className="font-mono text-[13px]">
                public/brand/blob/animated/
              </code>
              , component{" "}
              <code className="font-mono text-[13px]">AnimatedBlob</code>.
            </p>
          </div>
          <div className="bg-card flex flex-wrap items-center gap-6 rounded-lg border p-5">
            <BlobLoader label="Loading your inbox" />
            <div className="max-w-prose space-y-1">
              <p className="type-subheading">The site loader</p>
              <p className="text-muted-foreground type-small">
                <code className="font-mono text-[12px]">
                  &lt;BlobLoader /&gt;
                </code>{" "}
                is the blob looking around, at 64px, for every indeterminate
                wait that has no skeleton: route transitions (the root{" "}
                <code className="font-mono text-[12px]">loading.tsx</code>), a
                form submitting, a video processing. Compact mascots also appear
                in inline waits and above page skeletons. Buttons use a small
                spinner.
              </p>
            </div>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {blobAnimations.map((animation) => (
              <li
                className="bg-card flex flex-col gap-4 rounded-lg border p-5"
                key={animation.name}
              >
                <div
                  aria-hidden="true"
                  className="mx-auto size-40"
                  dangerouslySetInnerHTML={{
                    __html: animatedBlobSvg(animation, {
                      id: `card-${animation.name}`,
                    }),
                  }}
                />
                <div className="space-y-1">
                  <p className="type-subheading">{animation.label}</p>
                  <p className="text-muted-foreground type-small">
                    {animation.use}
                  </p>
                  <p className="text-muted-foreground type-small italic">
                    {animation.how}
                  </p>
                </div>
                <div className="flex items-end gap-4 border-t pt-4">
                  {[48, 32].map((size) => (
                    <div
                      aria-hidden="true"
                      className="shrink-0"
                      dangerouslySetInnerHTML={{
                        __html: animatedBlobSvg(animation, {
                          id: `${animation.name}-${size}`,
                          size,
                        }),
                      }}
                      key={size}
                    />
                  ))}
                  <p className="text-muted-foreground font-mono text-[11px]">
                    {animation.duration}s · variant=&quot;{animation.name}&quot;
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-5">
          <div className="max-w-prose">
            <h2 className="type-heading">Transitions</h2>
            <p className="text-muted-foreground type-body mt-1">
              Click an expression in the strip. The blob blinks, swaps its face
              while the eyes are shut, and reopens with a small settle of the
              body: 380 ms, the same move between any two faces, props and sweat
              drop included. In the app,{" "}
              <code className="font-mono text-[13px]">
                &lt;Blob expression=&quot;…&quot; /&gt;
              </code>{" "}
              does this on every change of its prop, so the character never
              snaps.
            </p>
          </div>
          <BlobPlayground />
        </section>

        <section className="space-y-5">
          <div className="max-w-prose">
            <h2 className="type-heading">Toasts</h2>
            <p className="text-muted-foreground type-body mt-1">
              Notifications are told by the mascot: the blob on the left, its
              message in a speech bubble. The blob appears neutral and blinks
              into the mood of the message; loading uses the site loader.
              Success, info, warning, error and loading, from{" "}
              <code className="font-mono text-[13px]">blobToast.*</code>, the
              same calls as sonner.
            </p>
          </div>
          <BlobToasts />
        </section>

        <section className="bg-card rounded-lg border p-5">
          <h2 className="type-subheading">On ink</h2>
          <p className="text-muted-foreground type-small mt-1 mb-4">
            The body carries its own light, so the set works on the dark theme
            without a variant.
          </p>
          <div className="flex flex-wrap items-center gap-6 rounded-md bg-[#1F1B18] p-6">
            {blobExpressions.map((expression) => (
              <div
                aria-hidden="true"
                dangerouslySetInnerHTML={{
                  __html: blobSvg(expression, {
                    id: `ink-${expression.name}`,
                    size: 72,
                  }),
                }}
                key={expression.name}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
