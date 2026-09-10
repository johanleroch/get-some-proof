const shortMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Product English and UTC keep SSR and hydration identical across ICU versions and time zones. */
export function formatShortDate(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  return `${date.getUTCDate()} ${shortMonths[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
