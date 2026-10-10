import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { Species } from '../../domain/entities/species';
import { useTheme } from '../theme/ThemeProvider';
import { ChevronRightIcon, CloseIcon } from './TabIcons';

/** Names are available from the name itself, without hiding the taxonomy links. */
export function SpeciesNames({ species, accent }: { species: Species; accent: string }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const { colors, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const guide = species.naturalHistory?.bird?.guide;
  const names = [...species.commonNames, ...(guide?.commonName ? [guide.commonName] : [])]
    .filter((name, index, all) => name.toLocaleLowerCase('es') !== species.displayName.toLocaleLowerCase('es')
      && all.findIndex((value) => value.toLocaleLowerCase('es') === name.toLocaleLowerCase('es')) === index);
  const extra = [
    ...names.map((name) => ({ label: 'Otro nombre común', value: name })),
    ...(guide?.englishName ? [{ label: 'En inglés', value: guide.englishName }] : []),
    ...(species.acceptedName && species.acceptedName !== species.scientificName ? [{ label: 'Nombre aceptado', value: species.acceptedName }] : []),
    ...(guide?.scientificName && guide.scientificName !== species.scientificName ? [{ label: 'Nombre científico histórico', value: guide.scientificName }] : []),
  ];
  return <>
    <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Ver nombres de ${species.displayName}`} style={{ flex: 1, minHeight: 44 }}>
      <Text style={[typography.display, { color: colors.text }]}>{species.displayName}<Text style={{ color: accent, fontSize: 18 }}> ›</Text></Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,30,24,0.60)' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar nombres" />
        <View accessibilityViewIsModal style={{ maxHeight: '75%', padding: 24, paddingBottom: Math.max(insets.bottom, 24), backgroundColor: '#FFFFFF', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Text accessibilityRole="header" style={[typography.title, { flex: 1, color: colors.text }]}>Nombres de la especie</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><CloseIcon color={colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14 }}>
            {[{ label: 'Nombre común', value: species.displayName }, { label: 'Nombre científico', value: species.scientificName }, ...extra].map((row) => <View key={`${row.label}-${row.value}`}><Text style={[typography.caption, { color: colors.textMuted }]}>{row.label}</Text><Text selectable style={[typography.body, { color: colors.text, marginTop: 3 }]}>{row.value}</Text></View>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

export function SpeciesTaxonomy<Rank extends string>({ items, onNavigate, accent, container, foreground }: { items: { label: string; rank: Rank; value: string }[]; onNavigate: (rank: Rank) => void; accent: string; container: string; foreground: string }): React.JSX.Element | null {
  const { typography, colors, radius } = useTheme();
  const [visibleCount, setVisibleCount] = useState(1);
  const { fontScale } = useWindowDimensions();
  const nodeHeight = Math.max(48, Math.ceil(48 * fontScale));
  const maximumIndent = Math.max(0, items.length - 1) * 12;
  if (!items.length) return null;
  return <View style={{ marginTop: 28 }}>
    <Text accessibilityRole="header" style={[typography.label, { color: colors.text, marginBottom: 4 }]}>Su lugar en la naturaleza</Text>
    <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 16 }]}>Tocá cada nodo para descubrir el siguiente nivel</Text>
    {items.slice(0, visibleCount).map((item, index) => {
      const indent = index * 12;
      const previous = (index - 1) * 12;
      const hasChildren = index < items.length - 1;
      const expanded = visibleCount > index + 1;
      return <View key={item.rank}>
        {index > 0 && <Svg width={indent + 32} height={26} accessible={false} style={{ pointerEvents: 'none' }}>
          <Path d={`M ${previous + 20} 0 C ${previous + 20} 14, ${indent + 20} 10, ${indent + 20} 24`} fill="none" stroke={accent} strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" />
          <Path d={`M ${indent + 17} 20 L ${indent + 20} 24 L ${indent + 23} 20`} fill="none" stroke={accent} strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>}
        <View style={{ marginLeft: indent, marginRight: maximumIndent - indent, height: nodeHeight, flexDirection: 'row', alignItems: 'center', backgroundColor: container, borderRadius: radius.lg }}>
          <Pressable onPress={() => hasChildren ? setVisibleCount(expanded ? index + 1 : index + 2) : onNavigate(item.rank)} accessibilityRole="button" accessibilityLabel={`${item.label}: ${item.value}`} accessibilityHint={hasChildren ? `Tocá para ${expanded ? 'plegar los niveles siguientes' : `mostrar ${items[index + 1].label}`}` : 'Explorar este grupo'} accessibilityState={hasChildren ? { expanded } : undefined} style={({ pressed }) => ({ flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, opacity: pressed ? 0.75 : 1 })}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: accent }} />
            <Text numberOfLines={1} style={[typography.label, { color: foreground, flex: 1 }]}><Text style={{ fontWeight: '400' }}>{item.label}: </Text>{item.value}</Text>
            {hasChildren && <Text style={[typography.label, { color: accent, paddingHorizontal: 4 }]}>{expanded ? '−' : '+'}</Text>}
          </Pressable>
          <Pressable onPress={() => onNavigate(item.rank)} accessibilityRole="link" accessibilityLabel={`Explorar ${item.label}: ${item.value}`} style={{ width: 44, height: '100%', alignItems: 'center', justifyContent: 'center' }}><ChevronRightIcon color={accent} size={16} /></Pressable>
        </View>
      </View>;
    })}
  </View>;
}
