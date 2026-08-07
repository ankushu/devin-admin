import { describe, it, expect, vi } from 'vitest';
import { withRetries } from '../src/utils/retry.js';

describe('withRetries', () => {
  it('returns the result on the first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetries(fn, 2);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries the given number of times after failures before succeeding', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('ok');
    const result = await withRetries(fn, 2);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once retries are exhausted', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('final failure'));
    await expect(withRetries(fn, 2)).rejects.toThrow('final failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('makes exactly one attempt when retries is 0', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(withRetries(fn, 0)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
