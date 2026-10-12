import type {SpeciesPayload} from '../domain';

/** Ausencia explícita de evidencia, nunca una fuente científica inventada. */
export function withOptionalSources(payload:SpeciesPayload):SpeciesPayload {
  const fields={...payload.fieldSources};
  const missing=(path:string)=>!fields[path]?.some(value=>value.trim()&&!/^sin[ _]fuente[.\s]*$/i.test(value));
  if(payload.abundanceStatus&&missing('abundance_status'))fields.abundance_status=['Sin fuente'];
  if(payload.naturalHistory?.bird&&missing('natural_history.bird'))fields['natural_history.bird']=['Sin fuente'];
  return {...payload,fieldSources:fields,measurements:payload.measurements.map(item=>
    !item.sourceCode.trim()||/^sin[ _]fuente[.\s]*$/i.test(item.sourceCode)
      ? {...item,sourceCode:'Sin fuente',provenance:'legacy_unverified',sourceRecordId:item.sourceRecordId&& !/^sin[ _]fuente[.\s]*$/i.test(item.sourceRecordId)?item.sourceRecordId:null}
      : item
  )};
}
