import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { SpeciesGalleryItem } from '../../domain/services/speciesGallery';
import { TransientZoomView } from './TransientZoomView';
import { GalleryIcon } from './TabIcons';

function GalleryImage({ item, label }: { item: SpeciesGalleryItem; label: string }): React.JSX.Element {
  const [failed, setFailed] = useState(0);
  useEffect(() => { setFailed(0); }, [item.id, item.url, item.thumbnailUrl]);
  const thumbnailAvailable = Boolean(item.thumbnailUrl && item.thumbnailUrl !== item.url);
  if (failed >= (thumbnailAvailable ? 2 : 1)) {
    return <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} accessibilityLabel={`${label}: imagen no disponible`}><View style={{ alignItems: 'center', gap: 12, padding: 20, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.64)' }}><GalleryIcon color="#FFFFFF" size={40} /><Text style={{ color: '#FFFFFF', fontSize: 14 }}>Imagen no disponible</Text></View></View>;
  }
  return <Image source={{ uri: failed ? item.thumbnailUrl : item.url }} contentFit="contain" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} accessibilityLabel={label} onError={() => setFailed((previous) => previous + 1)} />;
}

interface Props {
  items: SpeciesGalleryItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onPress?: () => void;
  label: string;
  height?: number;
  radius?: number;
  foreground: string;
  background: string;
  fullscreen?: boolean;
}

export function SpeciesPhotoCarousel({ items, index, onIndexChange, onPress, label, height, radius = 0, foreground, background, fullscreen = false }: Props): React.JSX.Element {
  const list = useRef<FlatList<SpeciesGalleryItem>>(null);
  const [width, setWidth] = useState(0);
  const [zooming, setZooming] = useState(false);
  const safeIndex = Math.min(Math.max(index, 0), Math.max(items.length - 1, 0));
  useEffect(() => { if (width) list.current?.scrollToOffset({ offset: safeIndex * width, animated: false }); }, [width, safeIndex]);
  const go = (next: number): void => {
    if (zooming || next < 0 || next >= items.length) return;
    list.current?.scrollToOffset({ offset: next * width, animated: true });
    onIndexChange(next);
  };
  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%', height: height ?? (width ? width * 3 / 5 : 208), backgroundColor: background, borderRadius: radius, overflow: 'hidden' }}>
    {width > 0 && <FlatList ref={list} data={items} horizontal pagingEnabled bounces={false} scrollEnabled={!zooming && items.length > 1} showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.id} getItemLayout={(_, position) => ({ length: width, offset: width * position, index: position })}
      onMomentumScrollEnd={(event) => onIndexChange(Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
      renderItem={({ item, index: position }) => <View style={{ width, height: '100%' }}>
        <TransientZoomView onPress={onPress} onZoomActiveChange={setZooming} showControls={fullscreen} accessibilityLabel={`${label}, imagen ${position + 1} de ${items.length}`}>
          <GalleryImage item={item} label={`${label}, imagen ${position + 1}`} />
        </TransientZoomView>
      </View>} />}
    {items.length > 1 && <View style={[styles.pagination, { bottom: fullscreen ? 90 : 10 }]}>
      <View accessible accessibilityLabel={`Imagen ${safeIndex + 1} de ${items.length}`} style={styles.counter}>
        <View style={styles.dots}>{items.map((item, position) => <View key={item.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: foreground, opacity: position === safeIndex ? 1 : 0.35 }} />)}</View>
      </View>
    </View>}
    {items.length > 1 && safeIndex > 0 && <Pressable disabled={zooming} onPress={() => go(safeIndex - 1)} accessibilityRole="button" accessibilityLabel="Imagen anterior" style={[styles.arrow, { left: 6, opacity: zooming ? 0.25 : 1 }]}><Text style={[styles.chevron, { color: foreground }]}>‹</Text></Pressable>}
    {items.length > 1 && safeIndex < items.length - 1 && <Pressable disabled={zooming} onPress={() => go(safeIndex + 1)} accessibilityRole="button" accessibilityLabel="Imagen siguiente" style={[styles.arrow, { right: 6, opacity: zooming ? 0.25 : 1 }]}><Text style={[styles.chevron, { color: foreground }]}>›</Text></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  pagination: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 9, paddingVertical: 7, backgroundColor: 'rgba(0,0,0,0.44)', borderRadius: 12 },
  arrow: { position: 'absolute', top: '50%', marginTop: -22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chevron: { fontSize: 20, lineHeight: 26, width: 28, height: 28, textAlign: 'center', borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.38)' },
  counter: { minWidth: 22, alignItems: 'center' }, dots: { flexDirection: 'row', gap: 5 },
});
