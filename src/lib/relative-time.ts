const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", YEAR],
  ["month", MONTH],
  ["week", WEEK],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
];

/**
 * "3 weeks ago", "2 hours ago", "just now" — the coarsest unit that still says
 * something true. Anything under a minute reads as just now rather than as a
 * count of seconds nobody asked for.
 *
 * The locale is fixed to English: the product speaks one language (DESIGN.md
 * section 9), and reading the browser's locale here put "il y a 3 semaines"
 * next to an English sentence.
 */
export function relativeTime(timestamp: number, now = Date.now()) {
  const elapsed = now - timestamp;
  if (elapsed < MINUTE) return "just now";
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of steps) {
    if (elapsed >= size) {
      return format.format(-Math.floor(elapsed / size), unit);
    }
  }
  return "just now";
}
