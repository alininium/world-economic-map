import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.resolve(import.meta.dirname, '../.cache');

/** Minimum gap between requests to the same host, to stay well inside public rate limits. */
const MIN_INTERVAL_MS = 1000;
const lastRequest = new Map<string, number>();

async function politeDelay(url: string): Promise<void> {
  const host = new URL(url).host;
  const wait = (lastRequest.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest.set(host, Date.now());
}

export interface FetchOptions {
  /** Re-download even if a cached copy exists. */
  refresh?: boolean;
  headers?: Record<string, string>;
  retries?: number;
}

/**
 * Downloads a URL as text, caching the raw response under pipeline/.cache so re-running
 * the transforms does not hit the source again. Retries with exponential backoff.
 */
export async function cachedFetch(url: string, opts: FetchOptions = {}): Promise<string> {
  const key = createHash('sha256').update(url).digest('hex').slice(0, 16);
  const file = path.join(CACHE_DIR, `${key}-${path.basename(new URL(url).pathname) || 'index'}`);
  if (!opts.refresh) {
    try {
      return await readFile(file, 'utf8');
    } catch {
      // not cached yet
    }
  }
  const retries = opts.retries ?? 4;
  for (let attempt = 0; ; attempt++) {
    await politeDelay(url);
    try {
      const res = await fetch(url, { headers: opts.headers });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const text = await res.text();
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(file, text);
      return text;
    } catch (err) {
      if (attempt >= retries) throw err;
      const backoff = 2000 * 2 ** attempt;
      console.warn(`  retrying in ${backoff / 1000}s: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}
