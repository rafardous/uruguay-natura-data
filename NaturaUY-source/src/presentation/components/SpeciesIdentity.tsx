import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Species } from '../../domain/entities/species';
import { useTheme } from '../theme/ThemeProvider';
import { ChevronRightIcon } from './TabIcons';

/** Alternate names stay visible beside the main name, with accessible full text. */
export function SpeciesNames({ species }: { species: Species }): React.JSX.Element {
  const { colors, typography } = useTheme();
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
  const alternateNames = [...new Set(extra.map((row) => row.value.trim()).filter(Boolean))];
  return <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
    <Text selectable accessibilityRole="header" style={[typography.display, { color: colors.text, flexShrink: 1, maxWidth: alternateNames.length ? '70%' : '100%' }]}>{species.displayName}</Text>
    {alternateNames.length > 0 && <Text selectable numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={`Otros nombres: ${extra.map((row) => `${row.label}: ${row.value}`).join('; ')}`} style={[typography.caption, { color: colors.textMuted, flex: 1, minWidth: 0 }]}>{alternateNames.join(' · ')}</Text>}
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
      const previous = (index - 1) * 8;
      return <View key={item.rank}>
        {index > 0 && <Svg width={indent + 32} height={14} accessible={false} style={{ pointerEvents: 'none' }}>
          <Path d={`M ${previous + 16} 0 C ${previous + 16} 8, ${indent + 16} 5, ${indent + 16} 12`} fill="none" stroke={accent} strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" />
          <Path d={`M ${indent + 13} 9 L ${indent + 16} 12 L ${indent + 19} 9`} fill="none" stroke={accent} strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>}
        <Pressable onPress={() => onNavigate(item.rank)} accessibilityRole="link" accessibilityLabel={`Explorar ${item.label}: ${item.value}`} style={({ pressed }) => ({ marginLeft: indent, width: '78%', height: nodeHeight, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, backgroundColor: container, borderRadius: radius.md, opacity: pressed ? 0.75 : 1 })}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: accent }} />
          <Text numberOfLines={1} style={[typography.label, { color: foreground, flex: 1 }]}><Text style={{ fontWeight: '400' }}>{item.label}: </Text>{item.value}</Text>
          <ChevronRightIcon color={accent} size={16} />
        </Pressable>
      </View>;
    })}
  </View>;
}
