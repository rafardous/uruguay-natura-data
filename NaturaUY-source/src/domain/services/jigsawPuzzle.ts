export interface JigsawPiece { id: number; x: number; y: number; turns: number; placed: boolean }
export function newJigsaw(grid: number, size: number, random = Math.random): JigsawPiece[] {
  const cell = size / grid;
  const ids = Array.from({ length: grid * grid }, (_, id) => id);
  for (let i=ids.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [ids[i],ids[j]]=[ids[j]!,ids[i]!]; }
  // Every piece has an exposed centre, even with sixteen pieces in a small tray.
  const slots = new Map(ids.map((id,index)=>[id,index]));
  return ids.map(id=>{const slot=slots.get(id)!;return { id, x: cell*.24+(slot%grid)*(size-cell*1.48)/(grid-1), y: size+cell*.25+Math.floor(slot/grid)*cell*.55, turns:Math.floor(random()*4),placed:false };}).sort((a,b)=>a.id-b.id);
}
export function snapJigsaw(piece: JigsawPiece, grid: number, size: number): JigsawPiece {
  const cell = size / grid; const x = (piece.id % grid) * cell; const y = Math.floor(piece.id / grid) * cell;
  return piece.turns % 4 === 0 && Math.hypot(piece.x - x, piece.y - y) <= cell * 0.35 ? { ...piece, x, y, placed: true } : piece;
}
// The right/bottom protrusions exactly match the adjacent left/top sockets.
export function jigsawPath(id: number, grid: number, cell: number): string {
  const row = Math.floor(id / grid), col = id % grid, k = cell;
  // Build each edge in a rotated local frame, then concatenate its coordinates.
  const points = (hasTab: boolean, inward: boolean, dx: number, dy: number) => {
    if (!hasTab) return `l ${dx*k} ${dy*k}`;
    const bend = inward ? .23 : -.23;
    return `l ${dx*k*.35} ${dy*k*.35} c ${-dy*k*bend} ${dx*k*bend} ${dx*k*.3-dy*k*bend} ${dy*k*.3+dx*k*bend} ${dx*k*.3} ${dy*k*.3} l ${dx*k*.35} ${dy*k*.35}`;
  };
  return `M 0 0 ${points(row>0,true,1,0)} ${points(col<grid-1,false,0,1)} ${points(row<grid-1,false,-1,0)} ${points(col>0,true,0,-1)} Z`;
}
