export const DAY_MS = 86_400_000;

/** Every day ("2026-10-21") or month ("2026-10") between start and end, in `timeZone`. */
export function buildPeriodKeys(start, end, unit, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const keys = new Set();

  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    const day = fmt.format(new Date(time));
    keys.add(unit === 'day' ? day : day.slice(0, 7));
  }

  const last = fmt.format(end);
  keys.add(unit === 'day' ? last : last.slice(0, 7));
  return [...keys];
}
