import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  if (!items.length) return null;
  return <View style={{ marginTop: 28 }}>
    <Text accessibilityRole="header" style={[typography.label, { color: colors.text, marginBottom: 4 }]}>Su lugar en la naturaleza</Text>
    <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 16 }]}>De lo general a lo particular · tocá un grupo para explorarlo</Text>
    {items.map((item, index) => {
      const indent = index * 12;
      const previous = (index - 1) * 12;
      return <View key={item.rank}>
        {index > 0 && <Svg width={indent + 32} height={26} accessible={false} style={{ pointerEvents: 'none' }}>
          <Path d={`M ${previous + 20} 0 C ${previous + 20} 14, ${indent + 20} 10, ${indent + 20} 24`} fill="none" stroke={accent} strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" />
          <Path d={`M ${indent + 17} 20 L ${indent + 20} 24 L ${indent + 23} 20`} fill="none" stroke={accent} strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>}
        <Pressable onPress={() => onNavigate(item.rank)} accessibilityRole="link" accessibilityLabel={`Ver ${item.label}: ${item.value}`} style={({ pressed }) => ({ marginLeft: indent, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: container, borderRadius: radius.lg, opacity: pressed ? 0.75 : 1 })}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent }} />
          <View style={{ flex: 1 }}><Text style={[typography.caption, { color: foreground, opacity: 0.75 }]}>{item.label}</Text><Text style={[typography.label, { color: foreground, marginTop: 2 }]}>{item.value}</Text></View>
          <ChevronRightIcon color={accent} size={16} />
        </Pressable>
      </View>;
    })}
  </View>;
}
