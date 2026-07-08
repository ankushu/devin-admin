import { describe, it, expect } from 'vitest';
import { dateRangeToTimeRange, monthToTimeRange } from '../src/utils/dates.js';

describe('monthToTimeRange', () => {
  it('returns unix timestamps at midnight PST (08:00 UTC) for a given month', () => {
    const { time_after, time_before } = monthToTimeRange('2026-06');
    // 2026-06-01T08:00:00Z
    expect(time_after).toBe(Math.floor(new Date('2026-06-01T08:00:00Z').getTime() / 1000));
    // 2026-07-01T08:00:00Z
    expect(time_before).toBe(Math.floor(new Date('2026-07-01T08:00:00Z').getTime() / 1000));
  });

  it('handles December → January year rollover', () => {
    const { time_after, time_before } = monthToTimeRange('2025-12');
    expect(time_after).toBe(Math.floor(new Date('2025-12-01T08:00:00Z').getTime() / 1000));
    expect(time_before).toBe(Math.floor(new Date('2026-01-01T08:00:00Z').getTime() / 1000));
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
