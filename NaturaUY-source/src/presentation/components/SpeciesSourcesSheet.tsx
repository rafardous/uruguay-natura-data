import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Species, SpeciesSource } from '../../domain/entities/species';
import { sourceLabel } from '../../domain/catalogLabels';
import { CloseIcon, DatabaseIcon, ExternalLinkIcon } from './TabIcons';
import { useTheme } from '../theme/ThemeProvider';

interface SpeciesSourcesSheetProps {
  visible: boolean;
  species: Species;
  onClose: () => void;
}

const GROUPS = [
  ['taxonomy', 'Nombres y taxonomía'],
  ['conservation', 'Conservación'],
  ['traits', 'Tamaño y ecología'],
  ['habitat', 'Hábitat'],
  ['diet', 'Alimentación'],
  ['description', 'Descripción'],
  ['relevant', 'Información relevante'],
  ['general', 'Fuentes generales'],
] as const;

function groupFor(fieldPath: string): typeof GROUPS[number][0] {
  const field = fieldPath.toLocaleLowerCase('es');
  if (field.includes('taxonomy') || field.includes('name') || field.includes('common')) return 'taxonomy';
  if (field.includes('conservation')) return 'conservation';
  if (field.includes('trait') || field.includes('size') || field.includes('measurement')) return 'traits';
  if (field.includes('habitat')) return 'habitat';
  if (field.includes('diet') || field.includes('aliment')) return 'diet';
  if (field.includes('description')) return 'description';
  if (field.includes('relevant') || field.includes('fact')) return 'relevant';
  return 'general';
}

function normalizedReference(reference: SpeciesSource): SpeciesSource & { group: typeof GROUPS[number][0]; label: string } {
  const oldField = reference.record && /^(general|taxonomy|common_name|scientific_name|conservation|description|habitat|diet|size|traits|relevant_note)/.test(reference.record)
    ? reference.record
    : 'general';
  const fieldPath = reference.fieldPath ?? oldField;
  const inferredCode = reference.sourceCode ?? reference.source.split(':', 1)[0]?.trim() ?? reference.source;
  const label = reference.name ?? sourceLabel(inferredCode);
  return { ...reference, fieldPath, sourceCode: inferredCode, group: groupFor(fieldPath), label };
}

export function SpeciesSourcesSheet({ visible, species, onClose }: SpeciesSourcesSheetProps): React.JSX.Element {
  const { colors, radius, spacing, typography } = useTheme();
  const references = [
    ...species.sources.map(normalizedReference),
    ...species.traits.sources.map((code) => normalizedReference({ source: code, record: null, fieldPath: 'traits', sourceCode: code })),
    ...species.facts.flatMap((fact) => fact.sourceCode && !species.sources.some((source) => (source.sourceCode ?? source.source) === fact.sourceCode && source.record === (fact.sourceRecordId ?? null))
      ? [normalizedReference({ source: fact.sourceCode, record: fact.sourceRecordId ?? null, fieldPath: 'relevant_note', sourceCode: fact.sourceCode })]
      : []),
  ].filter((item, index, all) => all.findIndex((candidate) => `${candidate.group}|${candidate.sourceCode}|${candidate.record}|${candidate.url}` === `${item.group}|${item.sourceCode}|${item.record}|${item.url}`) === index);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar fuentes" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
          <View style={[styles.header, { padding: spacing.lg, borderBottomColor: colors.border }]}>
            <View style={[styles.icon, { backgroundColor: colors.primaryContainer, borderRadius: radius.md }]}><DatabaseIcon color={colors.onPrimaryContainer} /></View>
            <View style={styles.flex}><Text style={[typography.title, { color: colors.text }]}>Fuentes de datos</Text><Text style={[typography.caption, { color: colors.textMuted }]}>{species.displayName}</Text></View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" style={[styles.close, { backgroundColor: colors.surfaceVariant, borderRadius: radius.pill }]}><CloseIcon color={colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}>
            {references.length === 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Este registro todavía sólo conserva referencias generales del catálogo histórico.</Text>}
            {GROUPS.map(([group, title]) => {
              const items = references.filter((reference) => reference.group === group);
              if (!items.length) return null;
              return <View key={group} style={{ gap: spacing.sm }}><Text style={[typography.eyebrow, { color: colors.primary }]}>{title.toLocaleUpperCase('es')}</Text>{items.map((reference, index) => {
                const url = reference.url ?? (reference.source.startsWith('http') ? reference.source : null);
                const record = reference.record && reference.record !== reference.fieldPath ? reference.record : null;
                return <Pressable key={`${reference.sourceCode}-${record}-${index}`} disabled={!url} onPress={() => url && void Linking.openURL(url)} style={[styles.reference, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md }]} accessibilityRole={url ? 'link' : undefined}><View style={styles.flex}><Text style={[typography.label, { color: colors.text }]}>{reference.label}</Text>{reference.citation && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{reference.citation}</Text>}{record && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Registro: {record}</Text>}{reference.license && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{reference.license}</Text>}</View>{url && <ExternalLinkIcon color={colors.primary} />}</Pressable>;
              })}</View>;
            })}
            <Text style={[typography.caption, { color: colors.textMuted }]}>La autoría y licencia de la fotografía se muestran junto a la imagen y no forman parte de esta lista.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.38)' },
  sheet: { maxHeight: '82%', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  reference: { minHeight: 58, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});
