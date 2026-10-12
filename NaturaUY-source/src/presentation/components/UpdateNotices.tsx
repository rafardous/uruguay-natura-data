import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCatalogUpdate } from '../../data/db/CatalogUpdateProvider';
import { useAppUpdate } from '../../data/updates/AppUpdateProvider';
import { releaseSupportsCatalog, shouldShowAppNotice } from '../../data/updates/appReleasePolicy';
import { settingsRepository } from '../../data/repositories/settingsRepository';
import { useUserDatabase } from '../../data/db/UserDatabaseProvider';
import { useStartup } from './StartupExperience';

export const APK_INSTALL_HELP = 'Cuando termine la descarga, abrí el archivo y tocá Actualizar. Si Android te pide permiso, habilitá la instalación desde ese navegador. Tus favoritos y tu progreso se conservan.';
export const CATALOG_RESTART_HELP = 'Cerrá completamente Arapy y volvé a abrirla. Volver desde segundo plano no aplica la actualización.';

export function UpdateNotices(): React.JSX.Element | null {
  const app = useAppUpdate();
  const catalog = useCatalogUpdate();
  const userDb = useUserDatabase();
  const { visible } = useStartup();
  const announced = useRef(new Set<number>());
  const [dismissedCatalog, setDismissedCatalog] = useState<number | null>(null);
  const release = app.release;
  const catalogRequiresApp = catalog.state === 'app_update_required';
  const compatible = releaseSupportsCatalog(release, catalog.requiredAppVersion, catalog.requiredSchema);
  const download = app.openDownload;

  useEffect(() => {
    if (visible || !release || !compatible || app.state === 'checking' || announced.current.has(release.build)) return;
    let active = true;
    const key = `updates.app_notice.${release.build}`;
    void (async () => {
      const saved = await settingsRepository.get(userDb, key).catch(() => null);
      if (!active || !shouldShowAppNotice(saved, Date.now()) || announced.current.has(release.build)) return;
      announced.current.add(release.build);
      // Record when shown, including dismissal by Android's back button, to avoid repeated prompts.
      Alert.alert(catalogRequiresApp ? 'Actualizá Arapy para recibir el catálogo' : 'Hay una nueva versión de Arapy',
        `Versión ${release.version} · ${(release.apk_size / 1_000_000).toFixed(1)} MB.\n\n${APK_INSTALL_HELP}`,
        [{ text: 'Más adelante', style: 'cancel' }, { text: 'Actualizar Arapy', onPress: () => { void download().catch(() => Alert.alert('No pudimos abrir la descarga', 'Volvé a intentar desde Configuración.')); } }],
        { cancelable: true });
      void settingsRepository.set(userDb, key, String(Date.now())).catch(() => {});
    })();
    return () => { active = false; };
  }, [app.state, catalogRequiresApp, compatible, download, release, userDb, visible]);

  if (visible || catalog.busy) return null;
  const pending = catalog.pendingVersion;
  if (pending !== null && pending !== dismissedCatalog) return <View style={styles.wrap} pointerEvents="box-none">
    <View style={styles.notice} accessibilityRole="alert">
      <Text style={styles.text}>Catálogo actualizado; se aplicará al volver a abrir Arapy.{`\n`}{CATALOG_RESTART_HELP}</Text>
      <Pressable onPress={() => setDismissedCatalog(pending)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar aviso de actualización"><Text style={styles.close}>Cerrar</Text></Pressable>
    </View>
  </View>;
  if (catalogRequiresApp && !compatible) return <View style={styles.wrap} pointerEvents="box-none">
    <View style={styles.notice} accessibilityRole="alert"><Text style={styles.text}>Hay un catálogo nuevo que requiere actualizar Arapy. Seguís usando tu catálogo actual; revisá Configuración para ver si la app compatible está disponible.</Text></View>
  </View>;
  return null;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 140, zIndex: 80, alignItems: 'center' },
  notice: { maxWidth: 520, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: '#293832' },
  text: { flex: 1, color: '#FFF9EA', fontSize: 13, lineHeight: 19 },
  close: { color: '#BDD0B7', fontWeight: '700' },
});
