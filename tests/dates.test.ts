import { describe, it, expect } from 'vitest';
import { monthToTimeRange, resolveDateRange, dateToUnix } from '../src/utils/dates.js';

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

describe('dateToUnix', () => {
  it('converts YYYY-MM-DD to unix at 08:00 UTC', () => {
    expect(dateToUnix('2026-06-15')).toBe(
      Math.floor(new Date('2026-06-15T08:00:00Z').getTime() / 1000)
    );
  });

  it('throws on invalid format', () => {
    expect(() => dateToUnix('2026-6-1')).toThrow('YYYY-MM-DD');
    expect(() => dateToUnix('June 15 2026')).toThrow();
  });
});

describe('resolveDateRange', () => {
  it('returns correct range and display for --month', () => {
    const { range, display } = resolveDateRange({ month: '2026-06' });
    expect(range).toEqual(monthToTimeRange('2026-06'));
    expect(display).toContain('June');
    expect(display).toContain('2026');
  });

  it('returns correct range and display for --start/--end', () => {
    const { range, display } = resolveDateRange({ start: '2026-06-01', end: '2026-06-30' });
    expect(range.time_after).toBe(dateToUnix('2026-06-01'));
    expect(range.time_before).toBe(dateToUnix('2026-06-30'));
    expect(display).toBe('2026-06-01 to 2026-06-30');
  });

  it('throws when no option is given', () => {
    expect(() => resolveDateRange({})).toThrow('date range');
  });

  it('throws when only --start is given (missing --end)', () => {
    expect(() => resolveDateRange({ start: '2026-06-01' })).toThrow('--start and --end must be used together');
  });

  it('throws when only --end is given (missing --start)', () => {
    expect(() => resolveDateRange({ end: '2026-06-30' })).toThrow('--start and --end must be used together');
  });

  it('throws when --month and --start are both given', () => {
    expect(() => resolveDateRange({ month: '2026-06', start: '2026-06-01', end: '2026-06-30' })).toThrow(
      'either --month or --start/--end'
    );
  });

  it('throws when --end is not after --start', () => {
    expect(() => resolveDateRange({ start: '2026-06-30', end: '2026-06-01' })).toThrow('after --start');
    expect(() => resolveDateRange({ start: '2026-06-01', end: '2026-06-01' })).toThrow('after --start');
  });
});
