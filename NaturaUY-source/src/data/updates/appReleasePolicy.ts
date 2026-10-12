import { compareVersions } from '../db/catalogUpdatePolicy';

export interface AndroidAppRelease {
  version: string;
  build: number;
  download_url: string;
  apk_size: number;
  catalog_schema: number;
  published_at: string;
}

export interface AppReleaseManifest { android: AndroidAppRelease | null }

/** Accept an Expo artifact, never a build details page or embedded credentials. */
export function isDirectExpoApkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'expo.dev'
      && !url.username && !url.password && !url.port && !url.search && !url.hash
      && /^\/artifacts\/eas\/[A-Za-z0-9_-]+\.apk$/.test(url.pathname);
  } catch { return false; }
}

export function assertAppReleaseManifest(value: unknown): asserts value is AppReleaseManifest {
  if (!value || typeof value !== 'object' || !('android' in value)) throw new Error('manifest_app_invalid');
  const android = (value as AppReleaseManifest).android;
  if (android === null) return;
  if (!android || typeof android !== 'object'
    || typeof android.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(android.version)
    || !Number.isSafeInteger(android.build) || android.build <= 0
    || typeof android.download_url !== 'string' || !isDirectExpoApkUrl(android.download_url)
    || !Number.isSafeInteger(android.apk_size) || android.apk_size <= 0
    || !Number.isSafeInteger(android.catalog_schema) || android.catalog_schema < 1
    || typeof android.published_at !== 'string' || Number.isNaN(Date.parse(android.published_at))) throw new Error('manifest_app_invalid');
}

export function isNewerAndroidRelease(release: AndroidAppRelease, installedBuild: number | null, installedVersion: string): boolean {
  return installedBuild !== null && release.build > installedBuild && compareVersions(release.version, installedVersion) >= 0;
}

export const APP_NOTICE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export function releaseSupportsCatalog(release: AndroidAppRelease | null, requiredVersion: string | null, requiredSchema: number | null): boolean {
  return release !== null && (requiredVersion === null || compareVersions(release.version, requiredVersion) >= 0)
    && (requiredSchema === null || release.catalog_schema >= requiredSchema);
}

export function shouldShowAppNotice(lastShown: string | null, now: number): boolean {
  const timestamp = Number(lastShown);
  return lastShown === null || !Number.isFinite(timestamp) || timestamp <= 0 || now - timestamp >= APP_NOTICE_INTERVAL_MS;
}
