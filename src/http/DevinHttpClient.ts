import type { IHttpClient, RequestOptions } from './IHttpClient.js';
import type { PaginatedResponse } from '../models/types.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class DevinHttpClient implements IHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const base = this.baseUrl.replace(/\/$/, '');
    const url = new URL(`${base}${path}`);

    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(res.status, `${method} ${path} failed (${res.status} ${res.statusText}): ${text}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // Follows cursor-based pagination (items / end_cursor / has_next_page) and
  // returns all items. Every Devin list endpoint uses this same flat shape.
  async paginateAll<TItem>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {}
  ): Promise<TItem[]> {
    const all: TItem[] = [];
    let after: string | undefined;

    for (;;) {
      const q = after ? { ...query, after } : query;
      const res = await this.request<PaginatedResponse<TItem>>('GET', path, { query: q });
      all.push(...(res.items ?? []));
      if (!res.has_next_page || !res.end_cursor) break;
      after = res.end_cursor;
    }

    return all;
  }
}
