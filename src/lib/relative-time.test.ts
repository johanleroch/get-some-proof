import { describe, expect, it } from "vitest";

import { relativeTime } from "./relative-time";

const NOW = Date.UTC(2026, 8, 13, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("relativeTime", () => {
  it("says the coarsest unit that is still true", () => {
    expect(relativeTime(NOW - 2 * HOUR, NOW)).toBe("2 hours ago");
    expect(relativeTime(NOW - 21 * DAY, NOW)).toBe("3 weeks ago");
    expect(relativeTime(NOW - 400 * DAY, NOW)).toBe("last year");
    expect(relativeTime(NOW - 90 * MINUTE, NOW)).toBe("1 hour ago");
  });

  it("never counts seconds", () => {
    expect(relativeTime(NOW - 20_000, NOW)).toBe("just now");
    expect(relativeTime(NOW, NOW)).toBe("just now");
  });

  it("reads a timestamp in the future as just now rather than as a negative", () => {
    expect(relativeTime(NOW + HOUR, NOW)).toBe("just now");
  });

  it("speaks English whatever the machine's locale is", () => {
    expect(relativeTime(NOW - 3 * DAY, NOW)).toBe("3 days ago");
  });
});
