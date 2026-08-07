// Runs `fn` over `items` with at most `limit` calls in flight at once.
// Preserves input order in the returned array. Each item's outcome is
// reported individually so a single failure doesn't reject the whole batch.
export type ConcurrencyResult<R> = { status: 'fulfilled'; value: R } | { status: 'rejected'; reason: unknown };

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onItemDone?: (done: number, total: number) => void
): Promise<ConcurrencyResult<R>[]> {
  const results: ConcurrencyResult<R>[] = new Array(items.length);
  let next = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
      completed += 1;
      onItemDone?.(completed, items.length);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}
