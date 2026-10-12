import { assertAppReleaseManifest, isDirectExpoApkUrl, isNewerAndroidRelease, releaseSupportsCatalog, shouldShowAppNotice, APP_NOTICE_INTERVAL_MS } from '../appReleasePolicy';
import { classifyUpdateError, UpdateError } from '../updateErrors';

const release = { version: '1.4.0', build: 8, download_url: 'https://expo.dev/artifacts/eas/ApprovedBuild123.apk', apk_size: 166_000_000, catalog_schema: 15, published_at: '2026-10-12T00:00:00Z' };

test('detects a newer build with the same app version and excludes downgrades and unknown installed builds', () => {
  expect(isNewerAndroidRelease(release, 7, '1.4.0')).toBe(true);
  expect(isNewerAndroidRelease(release, 8, '1.4.0')).toBe(false);
  expect(isNewerAndroidRelease(release, 7, '1.5.0')).toBe(false);
  expect(isNewerAndroidRelease(release, null, '1.3.1')).toBe(false);
});

test('accepts no announcement; rejects build pages, credentials, and misleading hosts', () => {
  expect(() => assertAppReleaseManifest({ android: null })).not.toThrow();
  expect(() => assertAppReleaseManifest({ android: release })).not.toThrow();
  for (const url of ['https://expo.dev/accounts/a/projects/b/builds/c', 'http://expo.dev/artifacts/eas/a.apk', 'https://expo.dev.evil.test/artifacts/eas/a.apk', 'https://user:pass@expo.dev/artifacts/eas/a.apk', 'https://expo.dev/artifacts/eas/a.apk?token=secret']) {
    expect(isDirectExpoApkUrl(url)).toBe(false);
    expect(() => assertAppReleaseManifest({ android: { ...release, download_url: url } })).toThrow();
  }
  expect(() => assertAppReleaseManifest({ android: { ...release, build: -1 } })).toThrow();
});

test('only offers an app for the new catalogue if both schema and minimum version are supported', () => {
  expect(releaseSupportsCatalog(release, '1.4.0', 15)).toBe(true);
  expect(releaseSupportsCatalog(release, '1.4.0', 16)).toBe(false);
  expect(releaseSupportsCatalog(release, '1.5.0', 15)).toBe(false);
  expect(releaseSupportsCatalog(null, '1.4.0', 15)).toBe(false);
});

test('a dismissed or shown app notice stays silent for 24 hours for that build', () => {
  const now = Date.now();
  expect(shouldShowAppNotice(null, now)).toBe(true);
  expect(shouldShowAppNotice(String(now), now + APP_NOTICE_INTERVAL_MS - 1)).toBe(false);
  expect(shouldShowAppNotice(String(now), now + APP_NOTICE_INTERVAL_MS)).toBe(true);
});

test('reports server, storage, interruption and invalid data independently of connectivity', () => {
  expect(classifyUpdateError(new UpdateError('server', 'manifest_http_503'), false)).toBe('server');
  expect(classifyUpdateError(new Error('Network request failed'), true)).toBe('offline');
  expect(classifyUpdateError(new Error('ENOSPC'), false)).toBe('space');
  expect(classifyUpdateError(new Error('aborted'), false)).toBe('interrupted');
  expect(classifyUpdateError(new Error('catalog_sha256_mismatch'), false)).toBe('invalid');
});
