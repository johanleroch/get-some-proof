import type { CSSProperties, ReactNode } from "react";

import { accentInk } from "@/lib/color-contrast";
import type { WallTheme } from "@/lib/templates-catalog";
import { cn } from "@/lib/utils";

/**
 * The surface a template renders on: the Public Wall theme (its own light or
 * dark palette, independent from the site theme) plus the Brand accent and
 * its readable ink as CSS variables, exactly like the hosted Wall. It is a
 * CSS container, so templates lay themselves out from the width they get
 * (`@xl:` from 576px, `@3xl:` from 768px), not from the viewport: a 390px
 * stage really shows the phone layout.
 */
export function TemplateStage({
  accentColor,
  centered = false,
  children,
  className,
  maxWidth,
  theme,
}: {
  accentColor: string;
  /** Small pieces float in the middle instead of hugging the top left. */
  centered?: boolean;
  children: ReactNode;
  className?: string;
  /** Preview width in px; the stage animates between widths. */
  maxWidth?: number;
  theme: WallTheme;
}) {
  return (
    <div
      className={cn(
        "public-wall-theme bg-background text-foreground @container w-full transition-[max-width] duration-[var(--motion-settle)] ease-[var(--ease-settle-soft)] motion-reduce:transition-none",
        className,
      )}
      data-template-stage=""
      data-wall-theme={theme}
      style={
        {
          "--wall-accent": accentColor,
          "--wall-accent-ink": accentInk(accentColor),
          maxWidth: maxWidth ?? "100%",
        } as CSSProperties
      }
    >
      <div
        className={cn(
          "p-5 @xl:p-8",
          centered && "grid min-h-56 place-items-center",
        )}
      >
        {children}
      </div>
    </div>
  );
}
