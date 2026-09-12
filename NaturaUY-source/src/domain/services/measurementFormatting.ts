import type { SpeciesMeasurement } from '../entities/species';

const NUMBER = new Intl.NumberFormat('es-UY', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatMeasurement(measurement: SpeciesMeasurement): string {
  let value = measurement.value;
  let unit: 'mm' | 'cm' | 'm' | 'g' | 'kg' = measurement.unit;

  if (measurement.unit === 'mm') {
    if (value >= 1000) {
      value /= 1000;
      unit = 'm';
    } else if (value >= 10) {
      value /= 10;
      unit = 'cm';
    }
  } else if (measurement.unit === 'g' && value >= 1000) {
    value /= 1000;
    unit = 'kg';
  }

  return `${NUMBER.format(value)} ${unit}`;
}

export function formatSpeciesMeasurement(measurement: SpeciesMeasurement): string {
  const basis = measurement.basis && measurement.basis !== 'body_length'
    ? ` · ${measurement.basis}`
    : measurement.kind === 'max_length' && measurement.basis === null
      ? ' · convención no informada'
      : '';
  return `${formatMeasurement(measurement)}${basis}${measurement.estimated ? ' · estimado' : ''}`;
}

/** Keeps legacy free-text size fields readable when structured traits are absent. */
export function formatLegacyMeasurementText(value: string): string {
  return value.replace(/(\d+(?:[.,]\d+)?)\s*(mm|g)\b/gi, (_match, raw: string, unit: string) => {
    const numeric = Number(raw.replace(',', '.'));
    return Number.isFinite(numeric)
      ? formatMeasurement({ kind: unit.toLowerCase() === 'g' ? 'body_mass' : 'body_length', value: numeric, unit: unit.toLowerCase() as 'mm' | 'g', basis: null, estimated: false })
      : _match;
  });
}
