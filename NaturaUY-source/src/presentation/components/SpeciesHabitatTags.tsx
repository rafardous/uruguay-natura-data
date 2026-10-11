import { useRouter } from 'expo-router';
import { habitatLabel } from '../../domain/catalogLabels';
import { useHabitatCatalog } from '../hooks/useHabitatCatalog';
import { SpeciesEcologyTags } from './SpeciesEcologyTags';

export function SpeciesHabitatTags({values,accent,container,foreground}:{values:string[];accent:string;container?:string;foreground?:string}) {
  const {items,aliases}=useHabitatCatalog();const router=useRouter();
  const byCode=new Map(items.map(h=>[h.code,h]));
  const codes=[...new Set(values.map(v=>aliases[v]??v))];
  const labels=codes.map(v=>byCode.get(v)?.name??habitatLabel(v));
  return <SpeciesEcologyTags title="Dónde vive" values={labels} accent={accent} container={container} foreground={foreground} onPressValue={label=>{const code=codes[labels.indexOf(label)];if(code&&byCode.has(code))router.push(`/habitats/${code}` as never);}} clickableValues={labels.filter((_,i)=>byCode.has(codes[i]!))} />;
}
