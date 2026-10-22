export const DAY_MS = 86_400_000;

/** Convert an instant into a stable ISO-style calendar key in the clinic timezone. */
function localDayKey(formatter, date) {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Every local day ("2026-10-21") or month ("2026-10") between two instants. */
export function buildPeriodKeys(start, end, unit, timeZone) {
  // Read endpoints in the selected zone, then iterate UTC calendar dates to avoid DST drift.
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const firstLocalDay = localDayKey(formatter, start);
  const lastLocalDay = localDayKey(formatter, end);

  // The service never requests a reversed interval, but return an empty series if one is supplied.
  if (firstLocalDay > lastLocalDay) return [];

  // UTC arithmetic advances civil dates by one day without inheriting local DST hour changes.
  const firstUtcDay = Date.parse(`${firstLocalDay}T00:00:00.000Z`);
  const lastUtcDay = Date.parse(`${lastLocalDay}T00:00:00.000Z`);
  const keys = new Set();

  for (let time = firstUtcDay; time <= lastUtcDay; time += DAY_MS) {
    const day = new Date(time).toISOString().slice(0, 10);
    keys.add(unit === 'day' ? day : day.slice(0, 7));
  }

  // Ensure the exact ending local date is present even if the range is shorter than one day.
  keys.add(unit === 'day' ? lastLocalDay : lastLocalDay.slice(0, 7));
  return [...keys];
}
