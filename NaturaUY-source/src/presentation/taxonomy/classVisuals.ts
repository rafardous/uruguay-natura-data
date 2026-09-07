export interface ClassVisual {
  colors: readonly [string, string];
  foreground: string;
  mutedForeground: string;
  description: string;
  image: number;
  imageAccessibilityLabel: string;
}

/**
 * One visual language for vertebrate classes, reused by taxonomy and games.
 * Fish deliberately share a hue so both classes still read as one familiar
 * group before the scientific distinction is learned.
 */
export const CLASS_VISUALS = {
  Aves: {
    colors: ['#F1D6D2', '#E8C1BC'],
    foreground: '#5D302D',
    mutedForeground: 'rgba(93,48,45,.78)',
    description: 'Vertebrados de sangre caliente, con plumas, pico y huevos con cáscara.',
    image: require('../../../assets/images/taxonomy/aves.png'),
    imageAccessibilityLabel: 'Cardenal copete rojo, ñandú, halconcito, biguá y tero',
  },
  Actinopterygii: {
    colors: ['#D7E2E4', '#C4D3D6'],
    foreground: '#29484F',
    mutedForeground: 'rgba(41,72,79,.78)',
    description: 'Peces de esqueleto óseo y aletas sostenidas por radios.',
    image: require('../../../assets/images/taxonomy/actinopterygii.png'),
    imageAccessibilityLabel: 'Dorado, tararira, pejerrey, bagre amarillo y pez anual',
  },
  Chondrichthyes: {
    colors: ['#D0DCE5', '#B8CAD8'],
    foreground: '#294759',
    mutedForeground: 'rgba(41,71,89,.78)',
    description: 'Peces de esqueleto cartilaginoso: tiburones, rayas y quimeras.',
    image: require('../../../assets/images/taxonomy/chondrichthyes.png'),
    imageAccessibilityLabel: 'Gatuzo, angelito, raya a lunares, chucho y raya de río',
  },
  Mammalia: {
    colors: ['#EADCB8', '#DDC996'],
    foreground: '#554118',
    mutedForeground: 'rgba(85,65,24,.78)',
    description: 'Vertebrados de sangre caliente con pelo; alimentan a sus crías con leche.',
    image: require('../../../assets/images/taxonomy/mammalia.png'),
    imageAccessibilityLabel: 'Carpincho, venado de campo, zorro gris, mulita y lobo marino fino',
  },
  Reptilia: {
    colors: ['#DDE0BD', '#C9CF9B'],
    foreground: '#404626',
    mutedForeground: 'rgba(64,70,38,.78)',
    description: 'Vertebrados de piel seca y escamosa; su temperatura depende del ambiente.',
    image: require('../../../assets/images/taxonomy/reptilia.png'),
    imageAccessibilityLabel: 'Yacaré, lagarto overo, tortuga verde, culebra verde y lagartija de la arena',
  },
  Amphibia: {
    colors: ['#CDE5D8', '#ACD2BF'],
    foreground: '#245442',
    mutedForeground: 'rgba(36,84,66,.78)',
    description: 'Vertebrados de piel húmeda que alternan entre el agua y la tierra.',
    image: require('../../../assets/images/taxonomy/amphibia.png'),
    imageAccessibilityLabel: 'Escuerzo, ranita de zarzal, sapito de Darwin, rana monito y cecilia',
  },
} as const satisfies Record<string, ClassVisual>;

export const classVisual = (clase: string): ClassVisual | undefined =>
  (CLASS_VISUALS as Record<string, ClassVisual>)[clase];
