import type { BirdNaturalHistory } from '../entities/species';

export const BIRD_HABITATS: Record<string, string> = { C: 'Costa', I: 'Islas y océano', P: 'Pastizales y praderas', M: 'Bosques autóctonos y palmares', PM: 'Pastizales con árboles', A: 'Ambientes acuáticos', H: 'Ambientes antrópicos' };
export const BIRD_DIETS: Record<string, string> = { Hb: 'Vegetales verdes', Se: 'Semillas y granos', Fr: 'Frutos', Ne: 'Néctar', In: 'Insectos', Ib: 'Invertebrados litorales y bentónicos', Ps: 'Peces, crustáceos y otras presas acuáticas', Tp: 'Pequeños vertebrados', 'Cñ': 'Carroña' };
export const BIRD_ABUNDANCE: Record<string, string> = { C: 'Común', BC: 'Bastante común', PC: 'Poco común', R: 'Rara' };
export function birdMeasureLabel(measurement: BirdNaturalHistory['measurements'][number]): string {
  if (measurement.kind === 'wingspan') return 'Envergadura';
  return measurement.sex === 'male' ? 'Largo · macho' : measurement.sex === 'female' ? 'Largo · hembra' : 'Largo corporal';
}
export function formatBirdMeasure(valueCm: number): string {
  return `${valueCm.toLocaleString('es-UY', { maximumFractionDigits: 1 })} cm`;
}
