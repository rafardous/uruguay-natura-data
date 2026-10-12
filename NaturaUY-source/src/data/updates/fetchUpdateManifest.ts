import { UpdateError } from './updateErrors';

export const MANIFEST_TIMEOUT_MS = 8_000;

export async function fetchUpdateManifest(url: string, signal?: AbortSignal): Promise<unknown> {
  try { if (new URL(url).protocol !== 'https:') throw new Error(); }
  catch { throw new UpdateError('invalid', 'manifest_url_invalid'); }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, MANIFEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new UpdateError('server', `manifest_http_${response.status}`);
    try { return await response.json() as unknown; }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new UpdateError('invalid', 'manifest_json_invalid');
    }
  } catch (error) {
    if (controller.signal.aborted) throw new UpdateError('interrupted', 'manifest_timeout_or_cancelled');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
