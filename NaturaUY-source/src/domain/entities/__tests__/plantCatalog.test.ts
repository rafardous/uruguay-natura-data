import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Plant = {
  id:string; catalogCode:string; scientificName:string;
  taxonomy:{kingdom:string;phylum:string;class:string;family:string;genus:string};
  ecology:{vegetationFormations:string[]}; naturalHistory:{plant?:{habit?:string|null}};
  sources:{source:string;record:string|null;fieldPath:string}[];
};

const plants=JSON.parse(readFileSync(resolve(__dirname,'../../../../data/catalog/plantae.json'),'utf8')) as Plant[];

describe('Selección botánica de 100 especies',()=>{
  it('conserva una identidad estable por especie',()=>{
    expect(plants).toHaveLength(100);
    expect(new Set(plants.map((plant)=>plant.id)).size).toBe(plants.length);
    expect(plants.every((plant)=>plant.catalogCode.startsWith('plant-'))).toBe(true);
    expect(plants.every((plant)=>plant.taxonomy.kingdom==='Plantae'&&plant.taxonomy.phylum==='Tracheophyta')).toBe(true);
  });

  it('conserva evidencia de presencia y el contrato schema 14',()=>{
    expect(plants.every((plant)=>!Object.prototype.hasOwnProperty.call(plant,'presenceCertainty'))).toBe(true);
    expect(plants.every((plant)=>plant.sources.some((source)=>source.source==='flora_uruguaya'&&source.fieldPath==='presence'&&source.record))).toBe(true);
  });
});
