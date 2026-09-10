import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';

import type { PuzzleDifficulty } from '../../domain/entities/puzzle';
import { movablePieceIndexes } from '../../domain/services/slidingPuzzle';

interface SlidingPicturePuzzleProps {
  size: number;
  gridSize: PuzzleDifficulty;
  pieces: readonly number[];
  hiddenPiece: number;
  source: ImageSourcePropType;
  onMove: (piece: number) => void;
  disabled?: boolean;
  revealHidden?: boolean;
  label: string;
}

/**
 * Modern Expo-compatible implementation of the interaction model from
 * cawfree/react-native-picture-puzzle (MIT): one empty cell and tap-to-slide.
 * Stable Animated values are kept per piece, so gestures cannot recreate or
 * fight responders while a tile is moving.
 */
export function SlidingPicturePuzzle({
  size,
  gridSize,
  pieces,
  hiddenPiece,
  source,
  onMove,
  disabled = false,
  revealHidden = false,
  label,
}: SlidingPicturePuzzleProps): React.JSX.Element {
  const pieceSize = size / gridSize;
  const [translations] = useState(() => {
    const values = Array.from({ length: gridSize * gridSize }, () => new Animated.ValueXY());
    pieces.forEach((piece, index) => {
      values[piece]?.setValue({
        x: (index % gridSize) * pieceSize,
        y: Math.floor(index / gridSize) * pieceSize,
      });
    });
    return values;
  });
  const movable = useMemo(
    () => new Set(movablePieceIndexes(pieces, hiddenPiece, gridSize).map((index) => pieces[index])),
    [gridSize, hiddenPiece, pieces],
  );

  useEffect(() => {
    const animations = pieces.map((piece, index) => Animated.spring(translations[piece]!, {
      toValue: {
        x: (index % gridSize) * pieceSize,
        y: Math.floor(index / gridSize) * pieceSize,
      },
      damping: 19,
      stiffness: 210,
      mass: 0.72,
      useNativeDriver: true,
    }));
    Animated.parallel(animations).start();
  }, [gridSize, pieceSize, pieces, translations]);

  return (
    <View style={[styles.board, { width: size, height: size }]}>
      {pieces.map((piece) => {
        if (piece === hiddenPiece && !revealHidden) return null;
        const sourceRow = Math.floor(piece / gridSize);
        const sourceColumn = piece % gridSize;
        const canMove = movable.has(piece) && !disabled;
        return (
          <Animated.View
            key={piece}
            style={[
              styles.piece,
              {
                width: pieceSize,
                height: pieceSize,
                transform: translations[piece]!.getTranslateTransform(),
              },
            ]}
          >
            <Pressable
              onPress={() => canMove && onMove(piece)}
              disabled={!canMove}
              accessibilityRole="button"
              accessibilityLabel={`Puzzle de ${label}, ficha ${piece + 1}${canMove ? ', se puede mover' : ''}`}
              style={({ pressed }) => [styles.pressable, { opacity: pressed && canMove ? 0.78 : 1 }]}
            >
              <Image
                source={source}
                contentFit="cover"
                style={{
                  position: 'absolute',
                  width: size,
                  height: size,
                  left: -sourceColumn * pieceSize,
                  top: -sourceRow * pieceSize,
                }}
              />
              <View pointerEvents="none" style={styles.edge} />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { overflow: 'hidden', position: 'relative', backgroundColor: '#26352B' },
  piece: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  pressable: { flex: 1, overflow: 'hidden' },
  edge: { ...StyleSheet.absoluteFill, borderWidth: 0.75, borderColor: 'rgba(255,255,255,0.58)' },
});
