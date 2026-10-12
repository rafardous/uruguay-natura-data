import { Alert, Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Species } from '../../domain/entities/species';
import { useTheme } from '../theme/ThemeProvider';
import { ChevronRightIcon } from './TabIcons';

/** Leave room for Manrope's descenders, including multiline Android text. */
export function SpeciesNames({ species }: { species: Species }): React.JSX.Element {
  const { colors, typography } = useTheme();
  return <Text selectable accessibilityRole="header" style={[typography.display, { color: colors.text, flex: 1, minWidth: 0, lineHeight: 42, paddingBottom: 4, includeFontPadding: true }]}>{species.displayName}</Text>;
}

export function alternateSpeciesNames(species: Species): { label: string; value: string }[] {
  const guide = species.naturalHistory?.bird?.guide;
  const names = [...species.commonNames, ...(guide?.commonName ? [guide.commonName] : [])]
    .map((name) => name.trim()).filter(Boolean);
  const extra = [
    ...names.map((name) => ({ label: 'Otro nombre común', value: name })),
    ...(guide?.englishName ? [{ label: 'En inglés', value: guide.englishName }] : []),
    ...(species.acceptedName && species.acceptedName !== species.scientificName ? [{ label: 'Nombre aceptado', value: species.acceptedName }] : []),
    ...(guide?.scientificName && guide.scientificName !== species.scientificName ? [{ label: 'Nombre científico histórico', value: guide.scientificName }] : []),
  ];
  const seen = new Set([species.displayName.trim(), species.scientificName.trim()].map((name) => name.toLocaleLowerCase('es')));
  return extra.map((row) => ({ ...row, value: row.value.trim() })).filter((row) => {
    const key = row.value.toLocaleLowerCase('es');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function SpeciesSecondaryNames({ species }: { species: Species }): React.JSX.Element | null {
  const { colors, typography } = useTheme();
  const extra = alternateSpeciesNames(species);
  const scientific = species.scientificName !== species.displayName;
  if (!scientific && !extra.length) return null;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, marginTop: 4 }}>
    {scientific && <Text selectable style={[typography.body, { color: colors.textSecondary, fontStyle: 'italic', flexShrink: 1 }]}>{species.scientificName}</Text>}
    {extra.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Otros nombres: ${extra.map((row) => `${row.label}: ${row.value}`).join('; ')}. Ver todos los nombres`} onPress={() => Alert.alert('Otros nombres', extra.map((row) => row.label + ': ' + row.value).join('\n\n'))} style={{ flexShrink: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' }}><Text style={[typography.caption, { color: colors.primary, lineHeight: 18 }]}>Otros nombres: {extra.map((row) => row.value).join(' · ')}</Text></Pressable>}
  </View>;
}

export function SpeciesTaxonomy<Rank extends string>({ items, onNavigate, accent, container, foreground }: { items: { label: string; rank: Rank; value: string }[]; onNavigate: (rank: Rank) => void; accent: string; container: string; foreground: string }): React.JSX.Element | null {
  const { typography, colors, radius } = useTheme();
  const { fontScale } = useWindowDimensions();
  const nodeHeight = Math.max(44, Math.ceil(40 * fontScale));
  if (!items.length) return null;
  return <View style={{ marginTop: 28 }}>
    <Text accessibilityRole="header" style={[typography.label, { color: colors.text, marginBottom: 12 }]}>Taxonomía</Text>
    {items.map((item, index) => {
      const indent = index * 8;
      return <View key={item.rank}>
        {index > 0 && <Svg width={indent + 32} height={16} style={{ pointerEvents: 'none' }}>
          <Path d={`M ${indent + 8} 0 V 5 Q ${indent + 8} 8 ${indent + 12} 8 H ${indent + 16} V 14 M ${indent + 12} 10 L ${indent + 16} 14 L ${indent + 20} 10`} fill="none" stroke={accent} strokeOpacity={0.6} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>}
        <Pressable onPress={() => onNavigate(item.rank)} accessibilityRole="link" accessibilityLabel={`Explorar ${item.label}: ${item.value}`} style={({ pressed }) => ({ marginLeft: indent, marginRight: 0, minHeight: nodeHeight, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, backgroundColor: container, borderRadius: radius.md, opacity: pressed ? 0.75 : 1 })}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: accent }} />
          <Text style={[typography.label, { color: foreground, flex: 1 }]}><Text style={{ fontWeight: '400' }}>{item.label}: </Text>{item.value}</Text>
          <ChevronRightIcon color={accent} size={16} />
        </Pressable>
      </View>;
    })}
  </View>;
}
