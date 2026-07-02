export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface IHttpClient {
  request<T>(method: string, path: string, options?: RequestOptions): Promise<T>;
}
