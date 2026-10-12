import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAppReleaseManifest, type AppReleaseManifest } from '../../NaturaUY-source/src/data/updates/appReleasePolicy';
import { compareVersions } from '../../NaturaUY-source/src/data/db/catalogUpdatePolicy';

// Deliberately separate from catalogue publication. Never selects the newest unapproved EAS build.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
function argument(name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Falta ${name}`);
  return resolve(value);
}
function fail(message: string): never { throw new Error(message); }

async function hashFile(path: string): Promise<{ hash: string; size: number }> {
  const hash = createHash('sha256'); let size = 0;
  for await (const chunk of createReadStream(path)) { hash.update(chunk); size += (chunk as Buffer).length; }
  return { hash: hash.digest('hex'), size };
}

interface EasBuild {
  id: string; status: string; platform: string; buildProfile: string; distribution: string;
  project: { id: string }; appVersion: string; appBuildVersion: string; gitCommitHash: string;
  expirationDate?: string; artifacts: { applicationArchiveUrl?: string; buildUrl?: string };
}
interface Acceptance {
  buildId: string; appVersion: string; androidVersionCode: number; apkSha256: string; sourceCommit: string;
  verifiedAt: string; deviceModel: string; testerDeviceModel: string;
  catalogSchema: number;
  installedAsUpdate: boolean; favoritesPreserved: boolean; learningProgressPreserved: boolean; gameRecordsPreserved: boolean;
  offlineColdStart: boolean; foregroundKeepsInstalledCatalog: boolean; coldStartAppliesPendingCatalog: boolean;
  directExpoDownloadFromArapyVerified: boolean;
}

async function main(): Promise<void> {
  if (args.includes('--help')) {
    console.log('npm run app:prepare-release -- --build-json <eas-build.json> --apk <build.apk> --acceptance <aceptacion.json> [--write]\nSin --write valida e imprime el manifiesto; --write anuncia la build en public/updates/app.json.');
    return;
  }
  const build = JSON.parse(readFileSync(argument('--build-json'), 'utf8')) as EasBuild;
  const acceptance = JSON.parse(readFileSync(argument('--acceptance'), 'utf8')) as Acceptance;
  const apkPath = argument('--apk');
  const app = JSON.parse(readFileSync(join(root, 'NaturaUY-source/app.json'), 'utf8')) as { expo: { version: string; android: { package: string }; extra: { eas: { projectId: string } } } };
  const baseline = JSON.parse(readFileSync(join(root, 'NaturaUY-source/data/reports/arapy-android-build-verification.json'), 'utf8')) as { appVersion: string; androidVersionCode: number; signingCertificateSha256: string };
  const currentPath = join(root, 'NaturaUY-admin/public/updates/app.json');
  const current: unknown = JSON.parse(readFileSync(currentPath, 'utf8'));
  assertAppReleaseManifest(current);
  if (build.status !== 'FINISHED' || build.platform !== 'ANDROID' || build.buildProfile !== 'field-guide' || build.distribution !== 'INTERNAL'
    || build.project?.id !== app.expo.extra.eas.projectId) fail('La build debe estar terminada, ser field-guide Android interna y pertenecer a Arapy.');
  if (build.expirationDate && Date.parse(build.expirationDate) <= Date.now()) fail('La build de Expo está vencida.');
  const buildNumber = Number(build.appBuildVersion);
  if (build.appVersion !== app.expo.version || buildNumber <= Math.max(baseline.androidVersionCode, current.android?.build ?? 0)) fail('La versión no coincide con app.json o el número de build no supera la publicación anterior.');
  if (compareVersions(build.appVersion, current.android?.version ?? baseline.appVersion) < 0) fail('La versión de app no puede ser inferior a la ya publicada.');
  const schemaSource = readFileSync(join(root, 'NaturaUY-source/src/data/db/catalogUpdater.ts'), 'utf8');
  const schema = Number(/SUPPORTED_CATALOG_SCHEMA\s*=\s*(\d+)/.exec(schemaSource)?.[1]);
  const local = await hashFile(apkPath);
  const release: AppReleaseManifest = { android: {
    version: build.appVersion, build: buildNumber,
    download_url: build.artifacts.applicationArchiveUrl ?? build.artifacts.buildUrl ?? '',
    apk_size: local.size, catalog_schema: schema, published_at: new Date().toISOString(),
  } };
  assertAppReleaseManifest(release);
  if (acceptance.buildId !== build.id || acceptance.appVersion !== build.appVersion || acceptance.androidVersionCode !== buildNumber
    || acceptance.catalogSchema !== schema
    || acceptance.apkSha256 !== local.hash || acceptance.sourceCommit !== build.gitCommitHash
    || !/^[a-f0-9]{40}$/.test(acceptance.sourceCommit) || !acceptance.deviceModel?.trim() || !acceptance.testerDeviceModel?.trim()
    || Number.isNaN(Date.parse(acceptance.verifiedAt)) || Date.parse(acceptance.verifiedAt) > Date.now()) fail('La aceptación no identifica esta build, su APK, su commit y los dispositivos probados.');
  for (const field of ['installedAsUpdate', 'favoritesPreserved', 'learningProgressPreserved', 'gameRecordsPreserved', 'offlineColdStart', 'foregroundKeepsInstalledCatalog', 'coldStartAppliesPendingCatalog', 'directExpoDownloadFromArapyVerified'] as const) {
    if (acceptance[field] !== true) fail(`Falta aceptación Android real: ${field}`);
  }
  const sdkRoot = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(homedir(), 'AppData/Local/Android/Sdk');
  const toolsRoot = join(sdkRoot, 'build-tools');
  const version = readdirSync(toolsRoot).filter((item) => /^\d+(\.\d+)+$/.test(item)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
  if (!version) fail('No hay Android SDK build-tools para verificar paquete y firma.');
  const tool = join(toolsRoot, version);
  const badging = execFileSync(join(tool, process.platform === 'win32' ? 'aapt.exe' : 'aapt'), ['dump', 'badging', apkPath], { encoding: 'utf8' });
  const identity = /package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/.exec(badging);
  if (!identity || identity[1] !== app.expo.android.package || Number(identity[2]) !== buildNumber || identity[3] !== build.appVersion) fail('El APK no tiene el paquete, versión y build esperados.');
  const signer = execFileSync(process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java', ['-jar', join(tool, 'lib/apksigner.jar'), 'verify', '--print-certs', apkPath], { encoding: 'utf8' });
  const certificate = /Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/i.exec(signer)?.[1]?.toLowerCase();
  if (certificate !== baseline.signingCertificateSha256.toLowerCase()) fail('La firma difiere del APK existente; no se puede anunciar una actualización compatible.');
  // Fetch anonymously, follow Expo's artifact redirect, and compare the actual public bytes.
  const response = await fetch(release.android!.download_url, { signal: AbortSignal.timeout(300_000), cache: 'no-store' });
  if (!response.ok || !response.body) fail(`No se puede descargar el APK sin login (HTTP ${response.status}).`);
  const remoteHash = createHash('sha256'); let remoteSize = 0;
  for await (const chunk of response.body) {
    remoteHash.update(chunk); remoteSize += chunk.length;
    if (remoteSize > local.size) fail('La descarga pública supera el tamaño del APK probado.');
  }
  if (remoteSize !== local.size || remoteHash.digest('hex') !== local.hash) fail('El enlace de Expo no entrega el APK que pasó la aceptación.');
  if (args.includes('--write')) writeFileSync(currentPath, `${JSON.stringify(release, null, 2)}\n`);
  console.log(JSON.stringify(release, null, 2));
  console.log(args.includes('--write') ? 'Manifiesto preparado. Revisar el diff y desplegar Cloudflare Pages desde main.' : 'Validación completa. No se modificó el manifiesto.');
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
