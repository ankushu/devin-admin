// Month "YYYY-MM" → unix timestamps at midnight PST (= 08:00 UTC), matching
// the Devin API's billing-cycle boundary.
export function monthToTimeRange(month: string): { time_after: number; time_before: number } {
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

function toUnix(year: number, mon: number): number {
  const iso = `${year}-${String(mon).padStart(2, '0')}-01T08:00:00Z`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

export function formatMonth(month: string): string {
  const [year, mon] = month.split('-');
  const d = new Date(`${year}-${mon}-01T12:00:00Z`);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
