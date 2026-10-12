import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '../src/presentation/components/AppHeader';
import { ChevronRightIcon } from '../src/presentation/components/TabIcons';
import { haptics } from '../src/presentation/haptics';
import { useTheme } from '../src/presentation/theme/ThemeProvider';
import { navigationBottomInset } from '../src/presentation/navigationPolicy';
import { useCatalogUpdate } from '../src/data/db/CatalogUpdateProvider';
import { useAppUpdate } from '../src/data/updates/AppUpdateProvider';
import { installedAppVersion, installedAndroidBuild } from '../src/data/updates/installedApp';
import { updateErrorMessage } from '../src/data/updates/updateErrors';
import { releaseSupportsCatalog } from '../src/data/updates/appReleasePolicy';
import { APK_INSTALL_HELP, CATALOG_RESTART_HELP } from '../src/presentation/components/UpdateNotices';

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography } = useTheme();
  const catalog = useCatalogUpdate();
  const app = useAppUpdate();
  const build = installedAndroidBuild();
  const compatibleApp = releaseSupportsCatalog(app.release, catalog.requiredAppVersion, catalog.requiredSchema);
  const catalogStatus = (() => {
    switch (catalog.state) {
      case 'checking': return 'Buscando novedades…';
      case 'downloading': return `Descargando catálogo v${catalog.availableVersion} · ${((catalog.downloadSize ?? 0) / 1_000_000).toFixed(1)} MB…`;
      case 'verifying': return 'Verificando la descarga…';
      case 'current': return 'Tu catálogo está actualizado.';
      case 'staged': return 'Catálogo actualizado; se aplicará al volver a abrir Arapy.';
      case 'app_update_required': return compatibleApp ? 'Hay un catálogo nuevo. Actualizá Arapy para descargarlo.' : 'Hay un catálogo nuevo que requiere otra versión de Arapy. No hay una build compatible anunciada; conservamos tu catálogo actual.';
      case 'error': return updateErrorMessage(catalog.error ?? 'storage');
      case 'web': return 'La vista web usa el catálogo incluido. Las descargas se realizan en la app Android.';
    }
  })();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader eyebrow="PREFERENCIAS" title="Configuración" onClose={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: navigationBottomInset(insets.bottom, spacing.xl) }}>
        <Text style={[typography.eyebrow, { color: colors.textMuted }]}>ACTUALIZACIONES</Text>
        <View style={[styles.group, { padding: 16, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}>
          <Text style={[typography.label, { color: colors.text }]}>Arapy {installedAppVersion()}{build !== null ? ` · build ${build}` : ''}</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>Catálogo instalado: {catalog.installedVersion === null ? 'consultando…' : `v${catalog.installedVersion}`}</Text>
          {catalog.pendingVersion !== null && <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>Descargado: v{catalog.pendingVersion} · pendiente de aplicación</Text>}
          {catalog.availableVersion !== null && catalog.installedVersion !== null && catalog.availableVersion > catalog.installedVersion && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Disponible: v{catalog.availableVersion}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            {catalog.busy && <ActivityIndicator size="small" color={colors.primary} />}
            <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>{catalogStatus}</Text>
          </View>
          {catalog.pendingVersion !== null && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>{CATALOG_RESTART_HELP}</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: catalog.busy || catalog.state === 'web', busy: catalog.busy }} disabled={catalog.busy || catalog.state === 'web'}
            onPress={() => { haptics.tap(); void catalog.check(); }} style={[styles.action, { backgroundColor: colors.primary, borderRadius: radius.md, opacity: catalog.busy || catalog.state === 'web' ? 0.5 : 1 }]}>
            <Text style={[typography.label, { color: colors.onPrimary }]}>Buscar actualización del catálogo</Text>
          </Pressable>
          {app.release && <>
            <Text style={[typography.label, { color: colors.text, marginTop: 20 }]}>Nueva app: {app.release.version} · build {app.release.build}</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>{(app.release.apk_size / 1_000_000).toFixed(1)} MB · {APK_INSTALL_HELP}</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: app.opening }} disabled={app.opening} onPress={() => {
              void app.openDownload().catch(() => Alert.alert('No pudimos abrir la descarga', 'Revisá tu conexión y volvé a intentar.'));
            }} style={[styles.action, { backgroundColor: colors.primary, borderRadius: radius.md }]}>
              <Text style={[typography.label, { color: colors.onPrimary }]}>Actualizar Arapy</Text>
            </Pressable>
          </>}
          {app.state === 'checking' && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 12 }]}>Buscando versiones de Arapy…</Text>}
          {app.state === 'current' && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 12 }]}>No hay una versión más nueva de Arapy anunciada.</Text>}
          {app.state === 'error' && <>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 12 }]}>No pudimos buscar versiones de Arapy. {updateErrorMessage(app.error ?? 'server')}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void app.check(); }} style={[styles.action, { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }]}>
              <Text style={[typography.label, { color: colors.text }]}>Reintentar búsqueda de Arapy</Text>
            </Pressable>
          </>}
        </View>
        <Text style={[typography.eyebrow, { color: colors.textMuted, marginTop: spacing.xl }]}>ACERCA DE</Text>

        <Pressable
          onPress={() => router.push({ pathname: '/report', params: { kind: 'bug' } } as unknown as Href)}
          style={[styles.group, styles.linkRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}
        >
          <View style={styles.flex}>
            <Text style={[typography.label, { color: colors.text }]}>Reportar un problema</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Requiere iniciar sesión para evitar spam</Text>
          </View>
          <ChevronRightIcon color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: '/report', params: { kind: 'suggestion' } } as unknown as Href)}
          style={[styles.group, styles.linkRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}
        >
          <View style={styles.flex}>
            <Text style={[typography.label, { color: colors.text }]}>Enviar una sugerencia</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Ideas breves para mejorar la aplicación o el catálogo</Text>
          </View>
          <ChevronRightIcon color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/credits')}
          style={[styles.group, styles.linkRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}
        >
          <View style={styles.flex}>
            <Text style={[typography.label, { color: colors.text }]}>Créditos y licencias</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Fuentes de datos y autoría de las fotografías
            </Text>
          </View>
          <ChevronRightIcon color={colors.textMuted} />
        </Pressable>

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, textAlign: 'center' }]}>
          Arapy · versión {installedAppVersion()}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  group: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  action: { minHeight: 48, padding: 12, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
});
