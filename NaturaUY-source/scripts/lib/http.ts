/** Polite HTTP helpers for the public biodiversity APIs the pipeline consumes. */

const USER_AGENT =
  'NaturaUY/1.0 (biodiversity field guide for Uruguay; contact: agustin.morelle@abstracta.us)';

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Serialises calls to one host so we never exceed its published rate limit.
 * iNaturalist asks for <=60 requests/minute; GBIF is more permissive.
 */
export class RateLimiter {
  private next = 0;

  constructor(private readonly minIntervalMs: number) {}

  async take(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.next - now);
    this.next = Math.max(now, this.next) + this.minIntervalMs;
    if (wait > 0) await sleep(wait);
  }
}

export interface FetchOptions {
  limiter?: RateLimiter;
  retries?: number;
  timeoutMs?: number;
}

/**
 * GETs JSON with bounded retries and exponential backoff.
 * Returns `null` rather than throwing on 404 — a missing taxon is an expected
 * outcome for this dataset, not an error.
 */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T | null> {
  const { limiter, retries = 3, timeoutMs = 25_000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (limiter) await limiter.take();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 404) return null;

      // Back off hard on throttling or transient server errors.
      if (res.status === 429 || res.status >= 500) {
        if (attempt === retries) return null;
        await sleep(2000 * 2 ** attempt);
        continue;
      }

      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      if (attempt === retries) return null;
      await sleep(1000 * 2 ** attempt);
    }
  }

  return null;
}

/** Downloads binary content, returning `null` on any failure. */
export async function fetchBuffer(url: string, timeoutMs = 40_000): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
