import { describe, expect, it } from 'vitest';
import { HttpError, isRetryable } from './fetch';

describe('isRetryable', () => {
  it('retries rate limiting, server errors and network failures', () => {
    expect(isRetryable(new HttpError(429, 'u'))).toBe(true);
    expect(isRetryable(new HttpError(503, 'u'))).toBe(true);
    expect(isRetryable(new TypeError('fetch failed'))).toBe(true);
  });

  it('gives up at once on client errors', () => {
    for (const status of [400, 401, 403, 404]) {
      expect(isRetryable(new HttpError(status, 'u'))).toBe(false);
    }
  });
});
