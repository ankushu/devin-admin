import type { TimeRange } from '../api/ConsumptionApi.js';

// Month "YYYY-MM" → unix timestamps at midnight PST (= 08:00 UTC), matching
// the Devin API's billing-cycle boundary.
export function monthToTimeRange(month: string): TimeRange {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Invalid month format "${month}" — expected YYYY-MM`);

  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (mon < 1 || mon > 12) throw new Error(`Invalid month value in "${month}"`);

  const time_after = toUnix(year, mon);

  let nextYear = year;
  let nextMon = mon + 1;
  if (nextMon > 12) {
    nextMon = 1;
    nextYear += 1;
  }
  const time_before = toUnix(nextYear, nextMon);

  return { time_after, time_before };
}

// Date "YYYY-MM-DD" → unix timestamp at midnight PST (= 08:00 UTC).
export function dateToUnix(dateStr: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) throw new Error(`Invalid date format "${dateStr}" — expected YYYY-MM-DD`);
  return Math.floor(new Date(`${dateStr}T08:00:00Z`).getTime() / 1000);
}

/**
 * Resolve a CLI date range from mutually exclusive options.
 * Accepts either `--month YYYY-MM` or both `--start YYYY-MM-DD` and `--end YYYY-MM-DD`.
 * Returns the TimeRange and a human-readable display string.
 */
export function resolveDateRange(opts: {
  month?: string;
  start?: string;
  end?: string;
}): { range: TimeRange; display: string } {
  const hasMonth = opts.month !== undefined;
  const hasStart = opts.start !== undefined;
  const hasEnd = opts.end !== undefined;

  if (hasMonth && (hasStart || hasEnd)) {
    throw new Error('Use either --month or --start/--end, not both.');
  }
  if (!hasMonth && !hasStart && !hasEnd) {
    throw new Error('Specify a date range: --month <YYYY-MM>  or  --start <YYYY-MM-DD> --end <YYYY-MM-DD>');
  }
  if (hasStart !== hasEnd) {
    throw new Error('--start and --end must be used together.');
  }

  if (hasMonth) {
    return { range: monthToTimeRange(opts.month!), display: formatMonth(opts.month!) };
  }

  // hasStart && hasEnd guaranteed here
  const time_after = dateToUnix(opts.start!);
  const time_before = dateToUnix(opts.end!);
  if (time_before <= time_after) {
    throw new Error(`--end must be after --start (got ${opts.start} to ${opts.end})`);
  }
  return { range: { time_after, time_before }, display: `${opts.start} to ${opts.end}` };
}

function toUnix(year: number, mon: number): number {
  const iso = `${year}-${String(mon).padStart(2, '0')}-01T08:00:00Z`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

export function formatMonth(month: string): string {
  const [year, mon] = month.split('-');
  const d = new Date(`${year}-${mon}-01T12:00:00Z`);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
