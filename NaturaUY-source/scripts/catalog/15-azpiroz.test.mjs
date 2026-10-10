import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ABUNDANCE, DIETS, HABITATS, buildProfile, guideSize, parseCodes, parseSize, scientificKey } from './15-azpiroz.mjs';
const reference = new URL('../../data/reference/azpiroz-2003/', import.meta.url);
const read = (file) => JSON.parse(readFileSync(new URL(file, reference), 'utf8'));
const original = read('original.json');
const corrections = read('corrections.json');
test('435 identifiers survive with unique targets and documented exceptions', () => {
  assert.equal(original.length, 435);
  assert.deepEqual(original.map((row) => row.numero_guia), Array.from({length:435}, (_,i) => i+1));
  const crosswalk = read('crosswalk.json');
  const ids = crosswalk.filter((row) => row.speciesId).map((row) => row.speciesId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(crosswalk.find((row) => row.number === 72).speciesId, 'sarkidiornis-sylvicola');
  assert.equal(crosswalk.find((row) => row.number === 387).speciesId, null);
});
test('Rhea body length, abundance and source number are independent', () => {
  const { profile } = buildProfile(original[0], corrections);
  assert.equal(guideSize(profile), '150 cm');
  assert.equal(ABUNDANCE[profile.abundanceCode], 'fairly_common');
  assert.deepEqual(profile.presence.months, Array.from({length:12}, (_,i)=>i+1));
  assert.deepEqual(profile.diet, ['Hb','In','Fr','Se']);
});
test('marine wingspan differs from body length and wing length', () => {
  assert.deepEqual(parseSize(original[12]), [{kind:'body_length',valueCm:80},{kind:'wingspan',valueCm:220}]);
  assert.equal(guideSize(buildProfile(original[12],corrections).profile), '80 cm');
});
test('sex-specific sizes are not a range; invalid OCR size is not published', () => {
  assert.deepEqual(parseSize(original[93]), [{kind:'body_length',valueCm:48,sex:'male'},{kind:'body_length',valueCm:58,sex:'female'}]);
  assert.deepEqual(parseSize({...original[0],tamano_cm_guia:'400'}), []);
  assert.deepEqual(parseSize({...original[0],tamano_cm_guia:'2'}), []);
});
test('PM stays intact; aquatic prey and unresolved cells are preserved', () => {
  assert.deepEqual(parseCodes('PM•M•A',HABITATS).codes, ['PM','M','A']);
  assert.equal(DIETS.Ps, 'Peces, crustáceos y otras presas acuáticas');
  assert.deepEqual(parseCodes('Seein',DIETS,corrections.fields.diet).codes,['Se','In']);
  assert.equal(parseCodes('#NAME?',ABUNDANCE).unresolved,'#NAME?');
  assert.equal(buildProfile({...original[0],abundancia_guia:'=BC'},corrections).profile.abundanceCode,'BC');
});
test('seasonal exceptions stay separate from conservation', () => {
  const {profile} = buildProfile({...original[0],estatus_guia:'VI*'},corrections);
  assert.equal(profile.presence.outsidePeriod,true);
  assert.deepEqual(profile.presence.months,[4,5,6,7,8,9]);
  assert.equal(buildProfile({...original[0],estatus_guia:'Ww'},corrections).profile.presence,null);
  assert.equal(scientificKey('Crypturellus o. obsoletus'), 'crypturellus obsoletus');
});
