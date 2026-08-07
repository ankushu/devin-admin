// Retries `fn` up to `retries` additional times (so `retries + 1` attempts
// total) after a failure, waiting `delayMs` between attempts. Rethrows the
// last error if every attempt fails.
export async function withRetries<T>(fn: () => Promise<T>, retries: number, delayMs = 0): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries && delayMs > 0) await sleep(delayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
