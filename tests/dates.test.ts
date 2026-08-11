import { describe, it, expect } from 'vitest';
import { dateRangeToTimeRange, monthToTimeRange, getIsoWeekLabel } from '../src/utils/dates.js';

describe('monthToTimeRange', () => {
  it('returns unix timestamps at 08:00 UTC starting from the 19th for a given month', () => {
    const { time_after, time_before } = monthToTimeRange('2026-06');
    // 2026-06-19T08:00:00Z
    expect(time_after).toBe(Math.floor(new Date('2026-06-19T08:00:00Z').getTime() / 1000));
    // 2026-07-19T08:00:00Z
    expect(time_before).toBe(Math.floor(new Date('2026-07-19T08:00:00Z').getTime() / 1000));
  });

  it('handles December → January year rollover', () => {
    const { time_after, time_before } = monthToTimeRange('2025-12');
    expect(time_after).toBe(Math.floor(new Date('2025-12-19T08:00:00Z').getTime() / 1000));
    expect(time_before).toBe(Math.floor(new Date('2026-01-19T08:00:00Z').getTime() / 1000));
  });

  it('time_before is strictly after time_after', () => {
    const { time_after, time_before } = monthToTimeRange('2026-03');
    expect(time_before).toBeGreaterThan(time_after);
  });

  it('throws on invalid format', () => {
    expect(() => monthToTimeRange('2026-6')).toThrow('YYYY-MM');
    expect(() => monthToTimeRange('June 2026')).toThrow();
  });

  it('throws on invalid month value', () => {
    expect(() => monthToTimeRange('2026-13')).toThrow();
    expect(() => monthToTimeRange('2026-00')).toThrow();
  });
});

describe('dateRangeToTimeRange', () => {
  it('returns inclusive range by using end + 1 day at midnight PST (08:00 UTC)', () => {
    const { time_after, time_before } = dateRangeToTimeRange('2026-06-01', '2026-06-03');
    expect(time_after).toBe(Math.floor(new Date('2026-06-01T08:00:00Z').getTime() / 1000));
    expect(time_before).toBe(Math.floor(new Date('2026-06-04T08:00:00Z').getTime() / 1000));
  });

  it('supports same-day range as one full inclusive day', () => {
    const { time_after, time_before } = dateRangeToTimeRange('2026-06-15', '2026-06-15');
    expect(time_after).toBe(Math.floor(new Date('2026-06-15T08:00:00Z').getTime() / 1000));
    expect(time_before).toBe(Math.floor(new Date('2026-06-16T08:00:00Z').getTime() / 1000));
  });

  it('throws when start is after end', () => {
    expect(() => dateRangeToTimeRange('2026-06-20', '2026-06-10')).toThrow('start');
  });

  it('throws on invalid date format', () => {
    expect(() => dateRangeToTimeRange('2026-6-01', '2026-06-10')).toThrow('YYYY-MM-DD');
    expect(() => dateRangeToTimeRange('06-01-2026', '2026-06-10')).toThrow('YYYY-MM-DD');
  });
});

describe('getIsoWeekLabel', () => {
  it('handles a plain mid-year date', () => {
    expect(getIsoWeekLabel('2007-01-01')).toBe('2007-W01');
  });

  it('assigns a date to the following ISO year when its week belongs to it', () => {
    // Dec 29, 2008 (Mon) starts the week containing Jan 1, 2009 (Thu).
    expect(getIsoWeekLabel('2008-12-29')).toBe('2009-W01');
  });

  it('assigns a date to the previous ISO year when its week belongs to it', () => {
    // Jan 1, 2005 (Sat) falls in the last ISO week of 2004.
    expect(getIsoWeekLabel('2005-01-01')).toBe('2004-W53');
  });

  it('handles a year with a 53rd ISO week', () => {
    expect(getIsoWeekLabel('2010-01-03')).toBe('2009-W53');
  });

  it('groups consecutive days in the same Mon-Sun week together', () => {
    expect(getIsoWeekLabel('2026-06-15')).toBe(getIsoWeekLabel('2026-06-16'));
  });
});
