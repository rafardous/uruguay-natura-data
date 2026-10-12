import * as Application from 'expo-application';
import Constants from 'expo-constants';

export function installedAppVersion(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';
}

export function installedAndroidBuild(): number | null {
  const build = Number(Application.nativeBuildVersion);
  return Number.isSafeInteger(build) && build > 0 ? build : null;
}
