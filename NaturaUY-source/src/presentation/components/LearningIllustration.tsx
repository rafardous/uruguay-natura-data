import { Fragment, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import type { LearningIllustration as Illustration } from '../../domain/entities/learning';
import type { Species } from '../../domain/entities/species';
import { speciesRepository } from '../../data/repositories/speciesRepository';
import { useTheme } from '../theme/ThemeProvider';
import { SpeciesImage } from './SpeciesImage';

/** Diagramas que se acomodan al ancho disponible y reutilizan las fotos y créditos del catálogo. */
export function LearningIllustration({ illustration, compact = false }: { illustration: Illustration; compact?: boolean }): React.JSX.Element {
  const { colors, typography, radius } = useTheme();
  return <View style={[styles.figure, { backgroundColor: colors.surfaceVariant, borderRadius: radius.lg }]}>
    {!compact && <Text style={[typography.label, { color: colors.text, marginBottom: 12 }]}>{illustration.title}</Text>}
    <View style={illustration.layout === 'sequence' ? styles.sequence : styles.compare}>
      {illustration.items.map((item, index) => <Fragment key={`${item.speciesCode ?? item.label}:${index}`}>
        {illustration.layout === 'sequence' && index > 0 && <Text accessibilityLabel="Después" style={[typography.title, { color: colors.primary, textAlign: 'center' }]}>↓</Text>}
        <View style={[illustration.layout === 'compare' ? styles.item : styles.sequenceItem, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
          {item.speciesCode ? <LearningPhoto key={item.speciesCode} code={item.speciesCode} label={item.label} caption={item.caption} compact={compact} /> : <View style={styles.caption}>
            <Text style={[typography.label, { color: colors.text }]}>{item.label}</Text>
            {!compact && item.caption && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{item.caption}</Text>}
          </View>}
        </View>
      </Fragment>)}
    </View>
  </View>;
}

function LearningPhoto({ code, label, caption, compact }: { code: string; label: string; caption?: string; compact: boolean }): React.JSX.Element {
  const db = useSQLiteContext(); const router = useRouter(); const { colors, typography } = useTheme();
  const [species, setSpecies] = useState<Species | null>(null);
  useEffect(() => {
    let active = true;
    void speciesRepository.findByCodigo(db, code).then(value => { if (active) setSpecies(value); }).catch(() => { if (active) setSpecies(null); });
    return () => { active = false; };
  }, [code, db]);
  const image = <View style={[styles.photo, { height: compact ? 140 : 180, backgroundColor: colors.surfaceVariant }]}>
    {species ? <SpeciesImage species={species} height={compact ? 140 : 180} bordered={false} contentFit="contain" /> : <Text style={[typography.caption, { color: colors.textSecondary, padding: 14 }]}>{label}</Text>}
  </View>;
  const description = <View style={styles.caption}><Text style={[typography.label, { color: colors.text }]}>{label}</Text>{!compact && caption && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{caption}</Text>}</View>;
  if (compact) return <>{image}{description}</>;
  return <>
    <Pressable accessibilityRole="link" accessibilityLabel={`Ver ${label} y sus fuentes en el catálogo`} onPress={() => router.push(`/species/${code}` as never)}>{image}</Pressable>
    {description}
    <View style={styles.credits}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{species?.photo ? `${species.photo.attribution} · ${species.photo.license === 'permission' ? 'Autorización de uso' : species.photo.license}` : 'Foto del catálogo. Créditos en la ficha de la especie.'}</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push(`/species/${code}` as never)} style={styles.link}><Text style={[typography.caption, { color: colors.primary }]}>Ver especie y fuentes ↗</Text></Pressable>
    </View>
  </>;
}

const styles = StyleSheet.create({
  figure: { padding: 12, marginTop: 16 }, compare: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, sequence: { gap: 6 },
  item: { flexGrow: 1, flexBasis: 125, minWidth: 125, overflow: 'hidden' }, sequenceItem: { overflow: 'hidden' },
  photo: { width: '100%' }, caption: { padding: 10 }, credits: { paddingHorizontal: 10, paddingTop: 8 }, link: { minHeight: 40, justifyContent: 'center' },
});
