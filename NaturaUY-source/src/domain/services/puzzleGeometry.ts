/** Deterministic complementary jigsaw outline. `id` is row*grid+column. */
export function puzzlePiecePath(id: number, grid: number, side: number): string {
  const row = Math.floor(id / grid); const col = id % grid; const tab = side * 0.16;
  const hash = (n: number) => ((n * 1103515245 + 12345) >>> 0) % 2 === 0 ? 1 : -1;
  const top = row === 0 ? `M0 0 H${side}` : `M0 0 H${side * 0.34} C${side * 0.42} ${hash(id - grid) * tab} ${side * 0.58} ${hash(id - grid) * tab} ${side * 0.66} 0 H${side}`;
  const right = col === grid - 1 ? `V${side}` : `V${side * 0.34} C${side + hash(id) * tab} ${side * 0.42} ${side + hash(id) * tab} ${side * 0.58} ${side} ${side * 0.66} V${side}`;
  const bottom = row === grid - 1 ? `H0` : `H${side * 0.66} C${side * 0.58} ${side - hash(id + grid) * tab} ${side * 0.42} ${side - hash(id + grid) * tab} ${side * 0.34} ${side} H0`;
  const left = col === 0 ? `Z` : `V${side * 0.66} C${hash(id - 1) * tab} ${side * 0.58} ${hash(id - 1) * tab} ${side * 0.42} 0 ${side * 0.34} Z`;
  return `${top} ${right} ${bottom} ${left}`;
}
