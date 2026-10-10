import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CloseIcon } from './TabIcons';
import { SpeciesPhotoCarousel } from './SpeciesPhotoCarousel';
import type { SpeciesGalleryItem } from '../../domain/services/speciesGallery';
import { haptics } from '../haptics';

export interface PhotoLightboxProps {
  visible: boolean;
  uri: string | undefined;
  label: string;
  onClose: () => void;
  items?: SpeciesGalleryItem[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

/** Full-resolution viewer with transient pinch-to-zoom. */
export function PhotoLightbox(props: PhotoLightboxProps): React.JSX.Element | null {
  if (!props.visible) return null;
  return <PhotoLightboxContent key={`${props.label}-${props.initialIndex ?? 0}`} {...props} />;
}

function PhotoLightboxContent({ visible, uri, label, onClose, items, initialIndex = 0, onIndexChange }: PhotoLightboxProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const gallery = items?.length ? items : uri ? [{ id: 'single', url: uri, thumbnailUrl: uri, attribution: '', license: '', page: null }] : [];
  if (!gallery.length) return null;
  const close = (): void => { onIndexChange?.(index); onClose(); };
  const selected = gallery[Math.min(index, gallery.length - 1)]!;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      {/* Android presents a Modal in a separate native window. It therefore
          needs its own gesture root; the app-level root does not receive
          pinch events through this boundary. */}
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={styles.backgroundTap} onPress={close} accessibilityLabel="Cerrar foto" />
        <View style={styles.imageWrap}>
          <SpeciesPhotoCarousel items={gallery} index={index} onIndexChange={setIndex} label={label} height={height - insets.top - insets.bottom - 80} foreground="#FFFFFF" background="transparent" fullscreen />
        </View>
        <Pressable
          onPress={() => { haptics.tap(); close(); }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <CloseIcon color="#FFFFFF" size={22} />
        </Pressable>
        <View pointerEvents="none" style={[styles.hint, { top: insets.top + 18 }]}> 
          <Text style={styles.hintText}>Pellizcá para ampliar</Text>
        </View>
        {selected.attribution && <View pointerEvents="none" style={[styles.credit, { bottom: insets.bottom + 12 }]}><Text style={styles.hintText}>{selected.attribution}{selected.license ? ` · ${selected.license}` : ''}</Text></View>}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  backgroundTap: { ...StyleSheet.absoluteFill },
  imageWrap: { width: '100%' },
  credit: { position: 'absolute', left: 20, right: 20 },
  close: { position: 'absolute', right: 16, padding: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)' },
  hint: { position: 'absolute', left: 62, right: 62, alignItems: 'center' },
  hintText: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
