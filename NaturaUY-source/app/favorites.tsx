import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import type { Species } from '../src/domain/entities/species';
import { speciesRepository } from '../src/data/repositories/speciesRepository';
import { AppHeader } from '../src/presentation/components/AppHeader';
import { EmptyState } from '../src/presentation/components/EmptyState';
import { SpeciesCard, SpeciesCardSkeleton } from '../src/presentation/components/SpeciesCard';
import { CloseIcon } from '../src/presentation/components/TabIcons';
import { useFavorites } from '../src/presentation/hooks/FavoritesProvider';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

export default function FavoritesScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const { codigos, isFavorite, toggle } = useFavorites();

  const [items, setItems] = useState<Species[] | null>(null);

  // Reads the full records for whatever is currently saved. Removing a card
  // updates `codigos`, which re-runs this and drops it from the list.
  useEffect(() => {
    void speciesRepository.findManyByCodigo(db, codigos).then(setItems);
  }, [db, codigos]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        eyebrow="TU COLECCIÓN"
        title="Favoritos"
        badge={`${codigos.length} guardada${codigos.length === 1 ? '' : 's'}`}
      >
        <View style={styles.row}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityLabel="Volver"
            style={{ marginLeft: 'auto' }}
          >
            <CloseIcon color={colors.text} />
          </Pressable>
        </View>
      </AppHeader>

      {items === null ? (
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <SpeciesCardSkeleton />
          <SpeciesCardSkeleton />
        </View>
      ) : items.length === 0 ? (
        <View style={{ padding: spacing.lg, paddingTop: spacing.xl }}>
          <EmptyState
            title="Todavía no guardaste nada"
            message="Tocá el corazón en cualquier ficha para tenerla siempre a mano."
          />
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.codigo}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          // FlashList doesn't reliably honour contentContainerStyle's paddingTop.
          ListHeaderComponent={<View style={{ height: spacing.xl }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
              <SpeciesCard
                species={item}
                index={index}
                favorite={isFavorite(item.codigo)}
                onPress={() => router.push(`/species/${item.codigo}`)}
                onToggleFavorite={() => toggle(item.codigo)}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
