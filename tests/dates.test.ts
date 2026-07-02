import { describe, it, expect } from 'vitest';
import { monthToTimeRange } from '../src/utils/dates.js';

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
