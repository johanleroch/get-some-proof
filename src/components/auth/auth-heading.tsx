import type { ReactNode } from "react";

/** Title and one-sentence lead above an authentication form. */
export function AuthHeading({
  description,
  title,
}: {
  description: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="mb-6 space-y-1.5">
      <h1 className="type-heading">{title}</h1>
      <p className="type-body text-ink-2">{description}</p>
    </header>
  );
}
