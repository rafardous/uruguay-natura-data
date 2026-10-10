import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { SpeciesGalleryItem } from '../../domain/services/speciesGallery';
import { TransientZoomView } from './TransientZoomView';

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
  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%', height: height ?? (width ? width * 3 / 4 : 260), backgroundColor: background, borderRadius: radius, overflow: 'hidden' }}>
    {width > 0 && <FlatList ref={list} data={items} horizontal pagingEnabled bounces={false} scrollEnabled={!zooming && items.length > 1} showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.id} getItemLayout={(_, position) => ({ length: width, offset: width * position, index: position })}
      onMomentumScrollEnd={(event) => onIndexChange(Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
      renderItem={({ item, index: position }) => <View style={{ width, height: '100%' }}>
        <TransientZoomView onPress={onPress} onZoomActiveChange={setZooming} showControls={fullscreen} accessibilityLabel={`${label}, imagen ${position + 1} de ${items.length}`}>
          <Image source={{ uri: item.url }} contentFit="contain" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} accessibilityLabel={`${label}, imagen ${position + 1}`} />
        </TransientZoomView>
      </View>} />}
    {items.length > 1 && <View style={[styles.pagination, { bottom: fullscreen ? 90 : 10 }]}>
      <Pressable disabled={safeIndex === 0 || zooming} onPress={() => go(safeIndex - 1)} accessibilityRole="button" accessibilityLabel="Imagen anterior" style={styles.arrow}><Text style={{ color: foreground, fontSize: 24 }}>‹</Text></Pressable>
      <View accessible accessibilityLabel={`Imagen ${safeIndex + 1} de ${items.length}`} style={styles.counter}>
        <Text style={{ color: foreground, fontSize: 12 }}>{safeIndex + 1} / {items.length}</Text>
        <View style={styles.dots}>{items.map((item, position) => <View key={item.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: foreground, opacity: position === safeIndex ? 1 : 0.35 }} />)}</View>
      </View>
      <Pressable disabled={safeIndex === items.length - 1 || zooming} onPress={() => go(safeIndex + 1)} accessibilityRole="button" accessibilityLabel="Imagen siguiente" style={styles.arrow}><Text style={{ color: foreground, fontSize: 24 }}>›</Text></Pressable>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  pagination: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.64)', borderRadius: 24 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  counter: { minWidth: 40, alignItems: 'center', gap: 5 }, dots: { flexDirection: 'row', gap: 4 },
});
