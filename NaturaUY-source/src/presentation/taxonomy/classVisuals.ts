export interface ClassVisual {
  colors: readonly [string, string];
  description: string;
}

/**
 * One visual language for vertebrate classes, reused by taxonomy and games.
 * Fish deliberately share a hue so both classes still read as one familiar
 * group before the scientific distinction is learned.
 */
export const CLASS_VISUALS = {
  Aves: {
    colors: ['#A84A45', '#763534'],
    description: 'Vertebrados de sangre caliente, con plumas, pico y huevos con cáscara.',
  },
  Actinopterygii: {
    colors: ['#357687', '#285A6C'],
    description: 'Peces de esqueleto óseo y aletas sostenidas por radios.',
  },
  Chondrichthyes: {
    colors: ['#357687', '#285A6C'],
    description: 'Peces de esqueleto cartilaginoso: tiburones, rayas y quimeras.',
  },
  Mammalia: {
    colors: ['#8A641B', '#684916'],
    description: 'Vertebrados de sangre caliente con pelo; alimentan a sus crías con leche.',
  },
  Reptilia: {
    colors: ['#6F7135', '#4E5429'],
    description: 'Vertebrados de piel seca y escamosa; su temperatura depende del ambiente.',
  },
  Amphibia: {
    colors: ['#3F7A5E', '#285C45'],
    description: 'Vertebrados de piel húmeda que alternan entre el agua y la tierra.',
  },
} as const satisfies Record<string, ClassVisual>;

export const classVisual = (clase: string): ClassVisual | undefined =>
  (CLASS_VISUALS as Record<string, ClassVisual>)[clase];
