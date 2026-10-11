import { memo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import type { Species } from '../../domain/entities/species';
import { thumbnailFor } from '../../data/assets/thumbMap';
import { useTheme } from '../theme/ThemeProvider';
import { FamilyGlyph } from './FamilyGlyph';
import { LeafIcon } from './TabIcons';

export interface SpeciesImageProps {
  species: Species;
  height?: number;
  glyphSize?: number;
  style?: ViewStyle;
  full?: boolean;
  transition?: number;
  borderRadius?: number;
  bordered?: boolean;
}

/** La clave reinicia el estado al reciclar una fila para otra foto. */
export const SpeciesImage = memo(function SpeciesImage(props: SpeciesImageProps): React.JSX.Element {
  const { species, full = false } = props;
  const remote = full ? species.photo?.fullUrl ?? species.photo?.url : species.photo?.url;
  return <ImageContent key={species.codigo + ':' + (remote ?? '')} {...props} remote={remote} />;
});

function ImageContent({
  species, height = 190, glyphSize = 56, style, transition = 0,
  borderRadius = 0, bordered = true, remote,
}: SpeciesImageProps & { remote?: string | null }): React.JSX.Element {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const thumb = thumbnailFor(species.photo?.thumbAsset ? species.codigo : null);
  const source = remote && !failed ? { uri: remote } : thumb;
  return (
    <View style={[styles.container, { height, borderRadius, backgroundColor: colors.surfaceVariant }, style]}>
      <View style={styles.center} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {species.taxonomy.kingdom === 'Plantae'
          ? <LeafIcon color={colors.outline} size={glyphSize} strokeWidth={1.35} />
          : <FamilyGlyph clase={species.taxonomy.clase} color={colors.outline} size={glyphSize} opacity={0.5} />}
      </View>
      {source !== null && source !== undefined && <Image
        source={source}
        contentFit="cover"
        transition={transition}
        cachePolicy="memory-disk"
        recyclingKey={species.codigo + ':' + (remote ?? '')}
        onError={() => setFailed(true)}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={species.displayName}
      />}
      {bordered && <View pointerEvents="none" style={[styles.hairline, { borderRadius, borderColor: colors.border }]} />}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  hairline: { ...StyleSheet.absoluteFill, borderWidth: StyleSheet.hairlineWidth },
});
