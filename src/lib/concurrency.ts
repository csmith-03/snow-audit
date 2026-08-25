/**
 * Maps over items with at most `limit` in flight at once. A real Update Set
 * can carry dozens of scripts — firing them all at the AI pass simultaneously
 * risks rate limits on day one, so this bounds it without pulling in a
 * dependency for something this small.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  // Fires as each item settles (in completion order, not input order) — lets
  // a caller report "n of m done" progress without waiting for the whole batch.
  onSettle?: (result: R, item: T, index: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      const result = await fn(items[i], i);
      results[i] = result;
      onSettle?.(result, items[i], i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}
