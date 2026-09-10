export interface CatalogVersionPolicy {
  dataVersion: number;
  schemaVersion: number;
  minAppVersion: string;
}

export type CatalogUpdateDecision = 'current' | 'stage' | 'app_update_required';

export interface LocalCatalogVersion { dataVersion: number; schemaVersion: number }

/** A schema upgrade must replace an older installed catalogue even if its data release number stayed the same. */
export function shouldActivateBundledCatalog(installed: LocalCatalogVersion, bundled: LocalCatalogVersion): boolean {
  return bundled.schemaVersion > installed.schemaVersion
    || (bundled.schemaVersion === installed.schemaVersion && bundled.dataVersion > installed.dataVersion);
}

export function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number); const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index++) { const difference = (a[index] ?? 0) - (b[index] ?? 0); if (difference !== 0) return difference; }
  return 0;
}

export function decideCatalogUpdate(policy: CatalogVersionPolicy, installedDataVersion: number, supportedSchema: number, appVersion: string): CatalogUpdateDecision {
  if (!Number.isInteger(policy.dataVersion) || policy.dataVersion <= installedDataVersion) return 'current';
  if (policy.schemaVersion > supportedSchema || compareVersions(appVersion, policy.minAppVersion) < 0) return 'app_update_required';
  return 'stage';
}
