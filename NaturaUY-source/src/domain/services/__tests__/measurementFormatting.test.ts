import { formatLegacyMeasurementText, formatMeasurement } from '../measurementFormatting';

const measurement = (value: number, unit: 'mm' | 'g') => ({
  kind: unit === 'g' ? 'body_mass' as const : 'body_length' as const,
  value,
  unit,
  basis: unit === 'g' ? null : 'body_length' as const,
  estimated: false,
});

describe('formatMeasurement', () => {
  it.each([
    [9.9, 'mm', '9,9 mm'],
    [10, 'mm', '1 cm'],
    [999, 'mm', '99,9 cm'],
    [1000, 'mm', '1 m'],
    [1250, 'mm', '1,25 m'],
    [999, 'g', '999 g'],
    [1000, 'g', '1 kg'],
    [23500, 'g', '23,5 kg'],
  ] as const)('formats %s %s as %s', (value, unit, expected) => {
    expect(formatMeasurement(measurement(value, unit))).toBe(expected);
  });

  it('formats legacy free-text measurements too', () => {
    expect(formatLegacyMeasurementText('Largo corporal: 114 mm · Masa: 1250 g')).toBe('Largo corporal: 11,4 cm · Masa: 1,25 kg');
  });
});
