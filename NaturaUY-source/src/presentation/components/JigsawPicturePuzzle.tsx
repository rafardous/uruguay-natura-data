import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { ClipPath, Defs, Image, Path } from 'react-native-svg';
import { jigsawPath, snapJigsaw, type JigsawPiece } from '../../domain/services/jigsawPuzzle';

function Piece({ piece, size, grid, source, onChange, onSelect }: { piece: JigsawPiece; size: number; grid: number; source: ImageSourcePropType; onChange: (piece: JigsawPiece) => void; onSelect: () => void }): React.JSX.Element {
  const cell = size / grid, pad = cell * .24;
  const [position] = useState(()=>new Animated.ValueXY());
  const current = useRef({ piece, onChange, onSelect });
  useEffect(()=>{current.current={piece,onChange,onSelect};},[piece,onChange,onSelect]);
  // PanResponder registers event callbacks; it never invokes them during render.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder: () => !current.current.piece.placed,
    onMoveShouldSetPanResponder: () => !current.current.piece.placed,
    onPanResponderGrant: () => current.current.onSelect(),
    onPanResponderMove: (_, gesture) => position.setValue({ x: gesture.dx, y: gesture.dy }),
    onPanResponderRelease: (_, gesture) => {
      const p = current.current.piece;
      const moved = Math.hypot(gesture.dx, gesture.dy) > 6;
      const next = moved ? { ...p, x: Math.max(0, Math.min(size-cell, p.x+gesture.dx)), y: Math.max(0, Math.min(size+cell*1.8, p.y+gesture.dy)) } : { ...p, turns: (p.turns + 1) % 4 };
      position.setValue({ x: 0, y: 0 }); current.current.onChange(snapJigsaw(next, grid, size));
    },
    onPanResponderTerminate: () => position.setValue({ x: 0, y: 0 }),
  }),[position,size,cell,grid]);
  const path = jigsawPath(piece.id, grid, cell);
  return <Animated.View {...responder.panHandlers} accessibilityRole="button" accessibilityLabel={`Pieza ${piece.id+1}${piece.placed ? ', encastrada' : ', tocá para rotar; arrastrá para colocar'}`} style={{ position: 'absolute', left: piece.x, top: piece.y, width: cell, height: cell, overflow:'visible', transform: [...position.getTranslateTransform(), { rotate: `${piece.turns*90}deg` }] }}>
    <Svg pointerEvents="none" style={{position:'absolute',left:-pad,top:-pad}} width={cell+2*pad} height={cell+2*pad} viewBox={`${-pad} ${-pad} ${cell+2*pad} ${cell+2*pad}`}>
      <Defs><ClipPath id={`piece-${piece.id}`}><Path d={path}/></ClipPath></Defs>
      <Image href={source} x={-(piece.id%grid)*cell} y={-Math.floor(piece.id/grid)*cell} width={size} height={size} preserveAspectRatio="xMidYMid slice" clipPath={`url(#piece-${piece.id})`}/>
      <Path d={path} fill="none" stroke={piece.placed ? '#FFFFFF' : '#564738'} strokeWidth={1}/>
    </Svg>
  </Animated.View>;
}

export function JigsawPicturePuzzle({ size, grid, pieces, source, onChange }: { size: number; grid: number; pieces: JigsawPiece[]; source: ImageSourcePropType; onChange: (piece: JigsawPiece) => void }): React.JSX.Element {
  const [selected, setSelected] = useState<number | null>(null);
  const cell = size/grid;
  const completed=pieces.length===grid*grid&&pieces.every(piece=>piece.placed);
  return <View>
    <View style={{ width: size, height: completed?size:size+cell*3.2, backgroundColor: '#F2ECDD', overflow: 'hidden' }}>
      <View pointerEvents="none" style={[styles.board, { width: size, height: size }]}>
        {Array.from({ length: grid*grid }, (_, id) => <View key={id} style={{ position: 'absolute', left: id%grid*cell, top: Math.floor(id/grid)*cell, width: cell, height: cell, borderWidth: .5, borderColor: '#B6AD9C' }}/>) }
      </View>
      {[...pieces].sort((a,b) => Number(a.id===selected)-Number(b.id===selected)).map(piece => <Piece key={piece.id} piece={piece} size={size} grid={grid} source={source} onChange={onChange} onSelect={()=>setSelected(piece.id)}/>)}
    </View>
    {!completed&&<View style={styles.controls}><Text style={styles.text}>Pieza {selected===null?'—':selected+1}</Text><Pressable disabled={selected===null||pieces[selected]?.placed} accessibilityLabel="Rotar pieza seleccionada" onPress={()=>{const p=pieces[selected!];if(p)onChange(snapJigsaw({...p,turns:(p.turns+1)%4},grid,size));}} style={styles.button}><Text style={styles.text}>Rotar ↻</Text></Pressable><Text style={styles.text}>{pieces.filter(p=>p.placed).length}/{grid*grid}</Text></View>}
  </View>;
}
const styles = StyleSheet.create({ board: { backgroundColor: '#E6E0D2', borderWidth: 1, borderColor: '#B6AD9C' }, controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8 }, button: { padding: 10, backgroundColor: '#E6E0D2', borderRadius: 18 }, text: { color: '#403D36', fontSize: 13 } });
