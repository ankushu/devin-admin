import { describe, it, expect, vi } from 'vitest';
import { mapWithConcurrency } from '../src/utils/concurrency.js';

describe('mapWithConcurrency', () => {
  it('preserves result order regardless of completion order', async () => {
    const items = [30, 10, 20];
    const results = await mapWithConcurrency(items, 3, (ms) => new Promise((resolve) => setTimeout(() => resolve(ms), ms)));
    expect(results).toEqual([
      { status: 'fulfilled', value: 30 },
      { status: 'fulfilled', value: 10 },
      { status: 'fulfilled', value: 20 },
    ]);
  });

  it('reports per-item rejections without failing the whole batch', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, (n) =>
      n === 2 ? Promise.reject(new Error('boom')) : Promise.resolve(n * 10)
    );
    expect(results[0]).toEqual({ status: 'fulfilled', value: 10 });
    expect(results[1].status).toBe('rejected');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 30 });
  });

  it('never runs more than `limit` calls concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    await mapWithConcurrency(items, 3, async (n) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return n;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('invokes onItemDone once per completed item with a running count', async () => {
    const onItemDone = vi.fn();
    await mapWithConcurrency([1, 2, 3], 2, (n) => Promise.resolve(n), onItemDone);
    expect(onItemDone).toHaveBeenCalledTimes(3);
    expect(onItemDone).toHaveBeenLastCalledWith(3, 3);
  });

  it('resolves immediately for an empty input array', async () => {
    const results = await mapWithConcurrency([], 5, () => Promise.resolve(1));
    expect(results).toEqual([]);
  });
});
