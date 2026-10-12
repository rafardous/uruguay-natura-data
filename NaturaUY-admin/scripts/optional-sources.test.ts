import assert from 'node:assert/strict';
import {test} from 'node:test';
import {emptySpeciesPayload} from '../src/domain';
import {withOptionalSources} from '../src/lib/optionalSources';

test('fuentes vacías quedan explícitas y medidas no verificadas, sin mutar el borrador',()=>{
  const payload=emptySpeciesPayload();payload.abundanceStatus='abundant';
  payload.measurements=[{kind:'body_length',value:500,unit:'mm',basis:'body_length',estimated:false,sourceCode:'',sourceRecordId:null,provenance:'verified'}];
  const result=withOptionalSources(payload);
  assert.deepEqual(result.fieldSources.abundance_status,['Sin fuente']);
  assert.equal(result.measurements[0]?.sourceCode,'Sin fuente');
  assert.equal(result.measurements[0]?.provenance,'legacy_unverified');
  assert.equal(payload.measurements[0]?.sourceCode,'');
  const sourced={...payload,fieldSources:{abundance_status:['Fuente real']},measurements:[{...payload.measurements[0]!,sourceCode:'fuente_real'}]};
  const preserved=withOptionalSources(sourced);
  assert.deepEqual(preserved.fieldSources,sourced.fieldSources);assert.deepEqual(preserved.measurements,sourced.measurements);
});
