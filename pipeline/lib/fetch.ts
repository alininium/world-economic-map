import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.resolve(import.meta.dirname, '../.cache');

/** Minimum gap between requests to the same host, to stay well inside public rate limits. */
const MIN_INTERVAL_MS = 1000;
const lastRequest = new Map<string, number>();

/** When true, sources already in pipeline/.cache are reused instead of downloaded again. */
let useCache = false;
export function setUseCache(value: boolean): void {
  useCache = value;
}

async function politeDelay(url: string): Promise<void> {
  const host = new URL(url).host;
  const wait = (lastRequest.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest.set(host, Date.now());
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

/** Rate limiting and server errors may clear up; other HTTP errors will not. */
export const isRetryable = (err: unknown): boolean =>
  !(err instanceof HttpError) || err.status === 429 || err.status >= 500;

export interface FetchOptions {
  headers?: Record<string, string>;
  retries?: number;
}

export interface Fetched {
  body: string;
  /** ISO date (YYYY-MM-DD) the body was actually downloaded. */
  retrievedAt: string;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Downloads a URL as text and keeps the raw response in pipeline/.cache. Transient failures
 * are retried with exponential backoff; the cache is only read back with `--cached`.
 */
export async function cachedFetch(url: string, opts: FetchOptions = {}): Promise<Fetched> {
  const key = createHash('sha256').update(url).digest('hex').slice(0, 16);
  const file = path.join(CACHE_DIR, `${key}-${path.basename(new URL(url).pathname) || 'index'}`);
  if (useCache) {
    try {
      const [body, info] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
      return { body, retrievedAt: isoDate(info.mtime) };
    } catch {
      // not cached yet
    }
  }
  const retries = opts.retries ?? 4;
  for (let attempt = 0; ; attempt++) {
    await politeDelay(url);
    try {
      const res = await fetch(url, { headers: opts.headers });
      if (!res.ok) throw new HttpError(res.status, url);
      const body = await res.text();
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(file, body);
      return { body, retrievedAt: isoDate(new Date()) };
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      const backoff = 2000 * 2 ** attempt;
      console.warn(`  retrying in ${backoff / 1000}s: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}
