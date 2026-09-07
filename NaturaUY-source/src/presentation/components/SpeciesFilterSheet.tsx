import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from './Chip';
import { CloseIcon } from './TabIcons';
import { useTheme } from '../theme/ThemeProvider';

export interface SpeciesSelection {
  classes: string[];
  habitats: string[];
  diets: string[];
  seasonalities: string[];
  onlyNative: boolean;
  onlyPriority: boolean;
}

export interface SpeciesFilterOptions {
  habitats: string[];
  diets: string[];
  seasonalities: string[];
}

export const blankSpeciesSelection = (): SpeciesSelection => ({
  classes: [], habitats: [], diets: [], seasonalities: [], onlyNative: false, onlyPriority: false,
});

export const toggleSpeciesSelection = (items: string[], value: string): string[] => (
  items.includes(value) ? items.filter((item) => item !== value) : [...items, value]
);

export const speciesSelectionCount = (selection: SpeciesSelection): number => (
  selection.classes.length + selection.habitats.length + selection.diets.length + selection.seasonalities.length
  + Number(selection.onlyNative) + Number(selection.onlyPriority)
);

export const friendlyFilterValue = (value: string): string => (
  ({ migratory: 'Migratoria', resident: 'Residente', summer_visitor: 'Visitante estival' }[value]
    ?? value.replaceAll('_', ' '))
);

function Group({ title, values, selected, change }: { title: string; values: string[]; selected: string[]; change: (value: string) => void }): React.JSX.Element | null {
  const { colors, typography } = useTheme();
  if (!values.length) return null;
  return (
    <View style={styles.group}>
      <Text style={[typography.eyebrow, { color: colors.textMuted }]}>{title}</Text>
      <View style={styles.chips}>
        {values.map((value) => <Chip key={value} label={friendlyFilterValue(value)} selected={selected.includes(value)} onPress={() => change(value)} />)}
      </View>
    </View>
  );
}

export function SpeciesFilterSheet({
  visible,
  draft,
  classes,
  options,
  onChange,
  onClose,
  onApply,
  onClear,
}: {
  visible: boolean;
  draft: SpeciesSelection;
  classes: string[];
  options: SpeciesFilterOptions;
  onChange: (next: SpeciesSelection) => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
}): React.JSX.Element {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const setList = (key: 'classes' | 'habitats' | 'diets' | 'seasonalities', value: string): void => {
    onChange({ ...draft, [key]: toggleSpeciesSelection(draft[key], value) });
  };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.layer}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} />
        <MotiView
          from={{ translateY: 80 }}
          animate={{ translateY: 0 }}
          transition={{ type: 'timing', duration: 260 }}
          style={[styles.sheet, { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + spacing.sm }]}
        >
          <View style={[styles.header, { padding: spacing.lg }]}>
            <View>
              <Text style={[typography.title, { color: colors.text }]}>Filtrar especies</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Podés combinar varios criterios.</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar filtros"><CloseIcon color={colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
            <Group title="CLASE" values={classes} selected={draft.classes} change={(value) => setList('classes', value)} />
            <Group title="HÁBITAT" values={options.habitats} selected={draft.habitats} change={(value) => setList('habitats', value)} />
            <Group title="ALIMENTACIÓN" values={options.diets} selected={draft.diets} change={(value) => setList('diets', value)} />
            <Group title="ESTACIONALIDAD" values={options.seasonalities} selected={draft.seasonalities} change={(value) => setList('seasonalities', value)} />
            <View style={styles.chips}>
              <Chip label="Solo nativas" selected={draft.onlyNative} onPress={() => onChange({ ...draft, onlyNative: !draft.onlyNative })} />
              <Chip label="Prioridad de conservación" selected={draft.onlyPriority} onPress={() => onChange({ ...draft, onlyPriority: !draft.onlyPriority })} />
            </View>
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: colors.border, padding: spacing.lg }]}>
            <Pressable onPress={onClear} style={styles.clear}><Text style={[typography.label, { color: colors.textSecondary }]}>Limpiar</Text></Pressable>
            <Pressable onPress={onApply} style={[styles.apply, { backgroundColor: colors.primary, borderRadius: radius.md }]}><Text style={[typography.label, { color: colors.onPrimary }]}>Aplicar{speciesSelectionCount(draft) ? ` (${speciesSelectionCount(draft)})` : ''}</Text></Pressable>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  clear: { padding: 14 },
  apply: { flex: 1, alignItems: 'center', padding: 15 },
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
