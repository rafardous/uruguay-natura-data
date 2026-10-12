import { fetchUpdateManifest, MANIFEST_TIMEOUT_MS } from '../fetchUpdateManifest';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

test('a server error is not reported as offline and requests bypass cached manifests', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  await expect(fetchUpdateManifest('https://example.com/app.json')).rejects.toMatchObject({ kind: 'server' });
  expect(global.fetch).toHaveBeenCalledWith('https://example.com/app.json', expect.objectContaining({ cache: 'no-store' }));
});

test('the manifest deadline also cancels an HTTP body which never finishes', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockImplementation((_url, options: RequestInit) => Promise.resolve({ ok: true, json: () => new Promise((_, reject) => options.signal?.addEventListener('abort', () => reject(new Error('aborted')))) }));
  const request = fetchUpdateManifest('https://example.com/app.json');
  const rejection = expect(request).rejects.toMatchObject({ kind: 'interrupted' });
  await jest.advanceTimersByTimeAsync(MANIFEST_TIMEOUT_MS);
  await rejection;
});

test('malformed JSON is a validation error, not a network error', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } });
  await expect(fetchUpdateManifest('https://example.com/app.json')).rejects.toMatchObject({ kind: 'invalid' });
});
