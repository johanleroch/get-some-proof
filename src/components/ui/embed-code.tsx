import { cn } from "@/lib/utils";

/** Highlights installation HTML as text, never as executable markup. */
export function EmbedCode({
  code,
  id,
  className,
}: {
  code: string;
  id: string;
  className?: string;
}) {
  const tokens = code.split(
    /("[^"]*"|'[^']*'|<\/?[\w-]+|\/?>|[\w-]+(?=\s*=)|\basync\b)/g,
  );

  return (
    <pre
      id={id}
      tabIndex={0}
      role="region"
      aria-label="Embed code"
      className={cn(
        "border-line bg-surface-2 text-ink focus-visible:ring-ring min-h-28 w-full min-w-0 overflow-x-auto rounded-md border p-3 font-mono text-xs leading-6 break-all whitespace-pre-wrap outline-none focus-visible:ring-2",
        className,
      )}
    >
      <code>
        {tokens.map((token, index) => (
          <span
            key={index}
            className={
              /^["']/.test(token)
                ? "text-success"
                : /^<\/?[\w-]/.test(token)
                  ? "text-info"
                  : /^[\w-]+$/.test(token)
                    ? "text-brand-text"
                    : undefined
            }
          >
            {token}
          </span>
        ))}
      </code>
    </pre>
  );
}
