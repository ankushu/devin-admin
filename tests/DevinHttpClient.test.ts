import { describe, it, expect, vi, afterEach } from 'vitest';
import { DevinHttpClient, ApiError } from '../src/http/DevinHttpClient.js';

describe('DevinHttpClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('aborts and throws a clear timeout error when a request never resolves', async () => {
    global.fetch = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    const client = new DevinHttpClient('https://api.example.com', 'token', 20);
    await expect(client.request('GET', '/v3/enterprise/orgs')).rejects.toThrow(/timed out after 20ms/);
  });

  it('resolves normally when the request completes before the timeout', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    }) as unknown as typeof fetch;

    const client = new DevinHttpClient('https://api.example.com', 'token', 5000);
    const result = await client.request('GET', '/v3/enterprise/orgs');
    expect(result).toEqual({ hello: 'world' });
  });

  it('throws ApiError with status on a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'not found',
    }) as unknown as typeof fetch;

    const client = new DevinHttpClient('https://api.example.com', 'token');
    await expect(client.request('GET', '/v3/enterprise/orgs')).rejects.toBeInstanceOf(ApiError);
  });
});
