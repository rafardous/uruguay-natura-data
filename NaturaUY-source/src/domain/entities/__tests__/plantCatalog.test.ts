import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Plant = {
  id:string; catalogCode:string; scientificName:string;
  taxonomy:{kingdom:string;phylum:string;class:string;family:string;genus:string};
  presenceCertainty:string; naturalHistory:{plant?:{habit?:string|null;vegetationFormations?:string[]}};
  sources:{source:string;record:string|null;fieldPath:string}[];
};

const plants=JSON.parse(readFileSync(resolve(__dirname,'../../../../data/catalog/plantae.json'),'utf8')) as Plant[];

describe('Flora Uruguaya schema 12 snapshot',()=>{
  it('accounts for every row as one stable plant species',()=>{
    expect(plants).toHaveLength(3157);
    expect(new Set(plants.map((plant)=>plant.id)).size).toBe(plants.length);
    expect(plants.every((plant)=>plant.catalogCode.startsWith('plant-'))).toBe(true);
    expect(plants.every((plant)=>plant.taxonomy.kingdom==='Plantae'&&plant.taxonomy.phylum==='Tracheophyta')).toBe(true);
  });

  it('keeps source-per-field evidence and the four initial branches',()=>{
    expect(new Set(plants.map((plant)=>plant.taxonomy.class))).toEqual(new Set(['Angiospermae','Gymnospermae','Lycopodiopsida','Polypodiopsida']));
    expect(plants.every((plant)=>plant.presenceCertainty==='confirmed')).toBe(true);
    expect(plants.every((plant)=>plant.sources.some((source)=>source.source==='flora_uruguaya'&&source.fieldPath==='presence'&&source.record))).toBe(true);
  });
});
