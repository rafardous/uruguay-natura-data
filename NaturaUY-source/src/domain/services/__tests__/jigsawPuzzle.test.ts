import { jigsawPath, newJigsaw, snapJigsaw } from '../jigsawPuzzle';
import { seededRng } from '../../../testing/speciesFactory';
describe('Encastrar',()=>{
  it.each([3,4])('creates all %i × %i pieces and keeps them off the board',grid=>{
    const pieces=newJigsaw(grid,360,seededRng(17));expect(pieces).toHaveLength(grid*grid);expect(new Set(pieces.map(p=>p.id)).size).toBe(grid*grid);
    expect(pieces.every(p=>!p.placed&&p.y>360&&p.turns>=0&&p.turns<=3)).toBe(true);
  });
  it('snaps only close pieces with the correct orientation',()=>{
    const piece={id:4,x:102,y:98,turns:0,placed:false};
    expect(snapJigsaw(piece,3,300)).toEqual({...piece,x:100,y:100,placed:true});
    expect(snapJigsaw({...piece,turns:1},3,300).placed).toBe(false);
    expect(snapJigsaw({...piece,x:10},3,300).placed).toBe(false);
  });
  it('uses flat outside edges and four shaped inside edges',()=>{
    expect((jigsawPath(4,3,100).match(/ c /g)??[]).length).toBe(4);
    expect((jigsawPath(0,3,100).match(/ c /g)??[]).length).toBe(2);
    expect(jigsawPath(0,3,100)).toContain('M 0 0 l 100 0');
  });
});
