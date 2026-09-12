import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CloseIcon } from './TabIcons';
import { TransientZoomView } from './TransientZoomView';
import { haptics } from '../haptics';

export interface PhotoLightboxProps {
  visible: boolean;
  uri: string | undefined;
  label: string;
  onClose: () => void;
}

/** Full-resolution viewer with transient pinch-to-zoom. */
export function PhotoLightbox({ visible, uri, label, onClose }: PhotoLightboxProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  if (!visible || !uri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Android presents a Modal in a separate native window. It therefore
          needs its own gesture root; the app-level root does not receive
          pinch events through this boundary. */}
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={styles.backgroundTap} onPress={onClose} accessibilityLabel="Cerrar foto" />
        <View style={styles.imageWrap}>
          <TransientZoomView accessibilityLabel={label}>
            <Image source={{ uri }} contentFit="contain" cachePolicy="memory-disk" style={styles.image} accessibilityLabel={label} />
          </TransientZoomView>
        </View>
        <Pressable
          onPress={() => { haptics.tap(); onClose(); }}
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
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  backgroundTap: { ...StyleSheet.absoluteFill },
  imageWrap: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  close: { position: 'absolute', right: 16, padding: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)' },
  hint: { position: 'absolute', left: 62, right: 62, alignItems: 'center' },
  hintText: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
