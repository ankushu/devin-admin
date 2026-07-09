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

export function dateRangeToTimeRange(start: string, end: string): { time_after: number; time_before: number } {
  const startParts = parseYyyyMmDd(start, 'start');
  const endParts = parseYyyyMmDd(end, 'end');

  const time_after = toDayUnix(startParts.year, startParts.mon, startParts.day);

  const endDate = new Date(Date.UTC(endParts.year, endParts.mon - 1, endParts.day));
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const time_before = toDayUnix(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, endDate.getUTCDate());

  if (time_after >= time_before) throw new Error(`Invalid date range: start "${start}" must be <= end "${end}"`);
  return { time_after, time_before };
}

function toUnix(year: number, mon: number): number {
  const iso = `${year}-${String(mon).padStart(2, '0')}-18T08:00:00Z`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

function toDayUnix(year: number, mon: number, day: number): number {
  const iso = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}T08:00:00Z`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

function parseYyyyMmDd(value: string, label: string): { year: number; mon: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ${label} date format "${value}" — expected YYYY-MM-DD`);
  const year = Number(match[1]);
  const mon = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, mon - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === mon - 1 &&
    date.getUTCDate() === day;
  if (!valid) throw new Error(`Invalid ${label} date value "${value}"`);
  return { year, mon, day };
}

export function formatMonth(month: string): string {
  const [yearStr, monStr] = month.split('-');
  const year = Number(yearStr);
  const mon = Number(monStr);

  const startD = new Date(Date.UTC(year, mon - 1, 18, 12, 0, 0));
  
  let nextYear = year;
  let nextMon = mon + 1;
  if (nextMon > 12) {
    nextMon = 1;
    nextYear += 1;
  }
  const endD = new Date(Date.UTC(nextYear, nextMon - 1, 17, 12, 0, 0));

  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return `${monthFormatter.format(startD)} (${formatter.format(startD)} - ${formatter.format(endD)})`;
}

export function getCycleForDate(dateStr: string): string {
  const { year, mon, day } = parseYyyyMmDd(dateStr, 'date');
  if (day >= 18) {
    return `${year}-${String(mon).padStart(2, '0')}`;
  } else {
    let prevYear = year;
    let prevMon = mon - 1;
    if (prevMon < 1) {
      prevMon = 12;
      prevYear -= 1;
    }
    return `${prevYear}-${String(prevMon).padStart(2, '0')}`;
  }
}
