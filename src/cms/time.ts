/**
 * Editorial time zone helpers. Timestamps are stored in UTC; editors read and enter
 * them in the newsroom's zone (EDITORIAL_TIMEZONE, default Asia/Kolkata), regardless of
 * where their browser is.
 */
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function formatInZone(iso: string | Date | null | undefined, timeZone = DEFAULT_TIMEZONE, withZone = true) {
  if (!iso) return "";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: withZone ? "short" : undefined,
  }).format(date);
}

/** Offset of `timeZone` from UTC at `date`, in minutes (IST → +330). */
export function zoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** "2026-10-20T09:30" meant as wall-clock time in `timeZone` → UTC Date. */
export function zonedLocalToUtc(local: string, timeZone = DEFAULT_TIMEZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = wall - zoneOffsetMinutes(new Date(wall), timeZone) * 60000;
  // Second pass settles DST boundaries.
  utc = wall - zoneOffsetMinutes(new Date(utc), timeZone) * 60000;
  return new Date(utc);
}

/** UTC Date → "YYYY-MM-DDTHH:mm" wall-clock in `timeZone`, for <input type="datetime-local">. */
export function utcToZonedLocal(date: Date, timeZone = DEFAULT_TIMEZONE) {
  const shifted = new Date(date.getTime() + zoneOffsetMinutes(date, timeZone) * 60000);
  return shifted.toISOString().slice(0, 16);
}

export function zoneLabel(timeZone = DEFAULT_TIMEZONE, at = new Date()) {
  const offset = zoneOffsetMinutes(at, timeZone);
  const sign = offset >= 0 ? "+" : "−";
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${timeZone.replace("_", " ")} (UTC${sign}${hh}:${mm})`;
}
