import { Fragment } from "react";

/** Cuts an address after each run of slashes, keeping them ("https://" stays whole). */
export function addressSegments(url: string) {
  const segments: string[] = [];
  let current = "";
  for (let index = 0; index < url.length; index += 1) {
    const character = url[index];
    current += character;
    if (character === "/" && url[index + 1] !== "/") {
      segments.push(current);
      current = "";
    }
  }
  if (current) segments.push(current);
  return segments;
}

/**
 * A public address that wraps only after a slash, never inside a word: on a
 * phone, "getsomeproof.com/c/fernhill-studio" breaks before "c/" or before
 * the slug, not in the middle of it. A segment too long for any line may
 * still break, as a last resort.
 */
export function PublicAddress({ url }: { url: string }) {
  const segments = addressSegments(url);
  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={`${index}-${segment}`}>
          <span
            className={
              segment.length > 26
                ? "[overflow-wrap:anywhere]"
                : "whitespace-nowrap"
            }
          >
            {segment}
          </span>
          {index < segments.length - 1 ? <wbr /> : null}
        </Fragment>
      ))}
    </>
  );
}
