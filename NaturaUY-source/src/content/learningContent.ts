import type { LearningModule, LearningPath, LearningQuestion, LearningSource } from '../domain/entities/learning';

const q = (id: string, type: LearningQuestion['type'], prompt: string, options: string[], correct: string[], explanation: string, extra: Partial<LearningQuestion> = {}): LearningQuestion => ({
  id, objectiveId: id, version: 1, type, prompt, options, correct, explanation, ...extra,
});
const m = (id: string, title: string, hook: string, blocks: LearningModule['blocks'], questions: LearningQuestion[], sourceCodes: string[], minutes = 6): LearningModule => ({ id, title, hook, blocks, questions, sourceCodes, minutes });

export const LEARNING_SOURCES: LearningSource[] = [
  { code: 'ICZN', name: 'Código Internacional de Nomenclatura Zoológica', url: 'https://www.iczn.org/the-code/the-code-online/' },
  { code: 'ICN', name: 'Código Internacional de Nomenclatura para algas, hongos y plantas', url: 'https://www.iapt-taxon.org/nomen/main.php' },
  { code: 'GBIF-TAX', name: 'GBIF — What is a species?', url: 'https://www.gbif.org/species' },
  { code: 'OPENSTAX-ECO', name: 'OpenStax Biology 2e — Community ecology', url: 'https://openstax.org/books/biology-2e/pages/45-6-community-ecology' },
  { code: 'IUCN-CAT', name: 'UICN — Categorías y criterios de la Lista Roja', url: 'https://www.iucnredlist.org/resources/categories-and-criteria' },
  { code: 'IUCN-ASSESS', name: 'UICN — Proceso de evaluación', url: 'https://www.iucnredlist.org/assessment/process' },
  { code: 'UY-PRIOR', name: 'Ministerio de Ambiente — Especies prioritarias para la conservación', url: 'https://www.gub.uy/ministerio-ambiente/politicas-y-gestion/especies-prioritarias-para-conservacion' },
  { code: 'UY-AVES-RL', name: 'Lista Roja de las Aves del Uruguay', url: 'https://www.gub.uy/ministerio-ambiente/sites/ministerio-ambiente/files/documentos/publicaciones/Lista_Roja_Web_Azpiroz_et_al_2012_ultima.pdf' },
  { code: 'UY-CARD-AM', name: 'Ministerio de Ambiente — Reintroducción del cardenal amarillo', url: 'https://www.gub.uy/ministerio-ambiente/comunicacion/noticias/cardenal-amarillo-especie-extincion' },
  { code: 'UY-CARD-ROJO', name: 'Observatorio Ambiental — Paroaria coronata', url: 'https://www.ambiente.gub.uy/especies/especie/P_coronata/' },
  { code: 'INIA-COTORRA', name: 'INIA — Manejo del daño de cotorras', url: 'https://inia.uy/proyectos/metodo-contraceptivo-para-el-manejo-del-dano-de-cotorras' },
  { code: 'MGAP-TORCAZA', name: 'MGAP — Manejo del daño ocasionado por paloma torcaza', url: 'https://www.gub.uy/ministerio-ganaderia-agricultura-pesca/comunicacion/publicaciones/manejo-del-dano-ocasionado-paloma-torcaza-zenaida-auriculata' },
  { code: 'UY-VENADO', name: 'IMPO — Decreto 12/985, venado de campo', url: 'https://www.impo.com.uy/bases/decretos/12-1985' },
  { code: 'UY-CAZA', name: 'Ministerio de Ambiente — Permisos de tenencia y caza deportiva', url: 'https://www.gub.uy/ministerio-ambiente/politicas-y-gestion/permisos-tenencia-caza-deportiva', note: 'Normativa consultada en setiembre de 2026.' },
  { code: 'LEY-9481', name: 'IMPO — Ley de Fauna 9.481', url: 'https://www.impo.com.uy/bases/leyes/9481-1935' },
  { code: 'DEC-200-026', name: 'IMPO — Decreto 200/026', url: 'https://www.impo.com.uy/bases/decretos/200-2026', note: 'Suspende desde 2027 la caza deportiva de tres especies de patos.' },
  { code: 'OAN-2024', name: 'Observatorio Ambiental Nacional — Informe del estado del ambiente 2024', url: 'https://www.ambiente.gub.uy/oan/documentos/INFORME-DEL-ESTADO-DEL-AMBIENTE-2024-1.21.pdf' },
];

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'ordenar-la-vida', shortTitle: 'Taxonomía', title: 'Ordenar la vida', icon: 'tree', color: '#8D6725',
    description: 'Cómo nombramos, agrupamos y revisamos el parentesco de los seres vivos.',
    modules: [
      m('para-que-clasificar', '¿Para qué clasificar?', 'Un cardenal y un ceibo tienen nombre común. ¿Alcanza para saber de qué organismo hablamos?', [
        { title: 'Un mapa, no un cajón', body: 'La taxonomía identifica, nombra y agrupa organismos. La sistemática además estudia su historia evolutiva. Las clasificaciones cambian cuando aparece mejor evidencia.' },
        { title: 'Nombres que viajan', body: 'Un nombre común puede variar entre lugares o nombrar especies distintas. El nombre científico enlaza observaciones, colecciones y estudios sin depender del idioma.' },
        { title: 'Una hipótesis revisable', body: 'Ubicar dos especies cerca expresa una hipótesis de parentesco. ADN, anatomía, fósiles y conducta pueden sostenerla o hacerla cambiar.', callout: 'Cambiar de clasificación no “cambia” al animal o la planta: mejora nuestro mapa.' },
      ], [q('tax-purpose', 'multi', '¿Qué puede aportar una clasificación científica?', ['Un lenguaje compartido', 'Una hipótesis de parentesco', 'Un ranking de importancia', 'Conectar evidencia'], ['Un lenguaje compartido', 'Una hipótesis de parentesco', 'Conectar evidencia'], 'Clasificar ayuda a comunicar y relacionar evidencia; no decide qué especie vale más.')], ['GBIF-TAX']),
      m('rangos', 'De reino a especie', '¿Qué comparten un carpincho y un cardenal antes de que sus caminos se separen?', [
        { title: 'Una dirección jerárquica', body: 'Una ruta frecuente es reino, filo, clase, orden, familia, género y especie. Cada nivel reúne organismos y el siguiente afina el grupo.' },
        { title: 'No todos los caminos son idénticos', body: 'Puede haber rangos intermedios, y algunas ramas se revisan. Arapy conserva nodos taxonómicos aunque un rango no esté completo.' },
        { title: 'Leer de amplio a preciso', body: 'Animalia incluye animales; Chordata reúne cordados; Aves es una clase; Passeriformes, un orden. Género y epíteto forman el nombre de especie.' },
      ], [q('tax-order', 'order', 'Ordená de más amplio a más específico.', ['Especie', 'Familia', 'Reino', 'Clase'], ['Reino', 'Clase', 'Familia', 'Especie'], 'Los rangos se anidan: reino es más amplio y especie, más específico.')], ['GBIF-TAX']),
      m('nombres', 'Cómo se escribe un nombre científico', '¿Por qué “Paroaria coronata” tiene dos palabras?', [
        { title: 'Binomio', body: 'La primera palabra es el género y empieza con mayúscula; la segunda es el epíteto específico y va en minúscula. Juntas identifican la especie.' },
        { title: 'Las cursivas importan', body: 'Por convención el binomio se escribe en cursiva. El autor y el año pueden acompañarlo, pero no forman parte del nombre binomial.' },
        { title: 'Animales y plantas', body: 'Los nombres zoológicos y botánicos siguen códigos internacionales diferentes. Ambos buscan estabilidad, prioridad y trazabilidad.' },
      ], [q('tax-name', 'single', '¿Cuál está escrito con la forma correcta?', ['paroaria Coronata', 'Paroaria coronata', 'PAROARIA CORONATA'], ['Paroaria coronata'], 'Género con inicial mayúscula, epíteto en minúscula y ambos en cursiva cuando el formato lo permite.')], ['ICZN', 'ICN']),
      m('evidencia', 'Cuando el árbol cambia', 'Dos especies se parecen. ¿Eso prueba que son parientes cercanas?', [
        { title: 'Parecido no siempre es parentesco', body: 'Rasgos semejantes pueden evolucionar de manera independiente frente a desafíos parecidos. Por eso se comparan varias líneas de evidencia.' },
        { title: 'Del rasgo al ADN', body: 'Morfología, desarrollo, distribución, fósiles y secuencias genéticas se analizan en conjunto. Ninguna foto aislada resuelve todo.' },
        { title: 'Nombres estables, hipótesis móviles', body: 'Una revisión puede cambiar género o familia. Los identificadores estables del catálogo permiten conservar favoritos y enlaces aunque cambie el nombre aceptado.' },
      ], [q('tax-evidence', 'classify', 'Clasificá cada elemento.', ['ADN', 'Color parecido', 'Fósiles', 'Nombre popular'], [], 'ADN y fósiles son evidencia directa de una evaluación sistemática; color y nombre popular por sí solos no bastan.', { categories: ['Evidencia útil', 'No alcanza solo'], classification: { ADN: 'Evidencia útil', Fósiles: 'Evidencia útil', 'Color parecido': 'No alcanza solo', 'Nombre popular': 'No alcanza solo' } })], ['GBIF-TAX']),
    ],
  },
  {
    id: 'redes-de-vida', shortTitle: 'Ecología', title: 'Redes de vida', icon: 'network', color: '#477052',
    description: 'Roles ecológicos, interacciones y simbiosis en nuestros ambientes.',
    modules: [
      m('rol-no-etiqueta', 'Un rol depende del lugar', '¿Una especie cumple siempre una sola función?', [
        { title: 'Función en contexto', body: 'El rol ecológico describe cómo una población usa recursos e influye en otras y en el ambiente. Puede cambiar con la edad, la estación o el lugar.' },
        { title: 'Muchas tareas a la vez', body: 'Un ave puede dispersar semillas, consumir insectos y ser presa. Una planta puede dar néctar, refugio y estabilizar suelo.' },
        { title: 'Red, no escalera', body: 'Las relaciones forman redes. Quitar o multiplicar una población puede producir efectos indirectos que no se ven mirando una pareja aislada.' },
      ], [q('eco-role', 'multi', '¿Qué puede hacer variar el rol de una especie?', ['La estación', 'Su etapa de vida', 'El ambiente', 'Su nombre científico'], ['La estación', 'Su etapa de vida', 'El ambiente'], 'El rol surge de interacciones concretas; el nombre no determina la función.')], ['OPENSTAX-ECO']),
      m('simbiosis', 'Vivir en asociación', '¿Toda simbiosis beneficia a las dos especies?', [
        { title: 'Una relación estrecha', body: 'Simbiosis es una asociación cercana y persistente entre especies. No significa automáticamente ayuda mutua.' },
        { title: 'Tres resultados frecuentes', body: 'En mutualismo ambas se benefician; en comensalismo una se beneficia sin efecto claro sobre la otra; en parasitismo una gana y la otra pierde.' },
        { title: 'El balance puede moverse', body: 'Una interacción puede cambiar según abundancia, recursos o estrés. Las etiquetas resumen resultados medidos, no intenciones.' },
      ], [q('eco-symbiosis', 'classify', 'Relacioná cada resultado con su tipo.', ['Ambas se benefician', 'Una se beneficia; la otra casi no cambia', 'Una se beneficia y la otra se perjudica'], [], 'Mutualismo es +/+; comensalismo +/0; parasitismo +/−.', { categories: ['Mutualismo', 'Comensalismo', 'Parasitismo'], classification: { 'Ambas se benefician': 'Mutualismo', 'Una se beneficia; la otra casi no cambia': 'Comensalismo', 'Una se beneficia y la otra se perjudica': 'Parasitismo' } })], ['OPENSTAX-ECO']),
      m('polinizacion-dispersion', 'Mover polen y semillas', '¿Qué obtiene el animal y qué obtiene la planta?', [
        { title: 'Intercambio, no favor', body: 'Muchos polinizadores obtienen alimento mientras trasladan polen. La planta aumenta sus oportunidades de reproducción.' },
        { title: 'Viajar después del fruto', body: 'Animales que comen frutos pueden depositar semillas lejos de la planta madre. No toda visita es efectiva: importa qué transportan y dónde lo dejan.' },
        { title: 'Diversidad de socios', body: 'Insectos, aves y murciélagos pueden participar. Conservar la interacción exige también conservar refugios, ciclos y paisajes conectados.' },
      ], [q('eco-pollination', 'single', '¿Cuál observación demuestra mejor dispersión de semillas?', ['Un ave posa en una rama', 'Una semilla viable aparece en sus heces lejos de la planta', 'Un insecto visita una flor'], ['Una semilla viable aparece en sus heces lejos de la planta'], 'La evidencia conecta transporte, distancia y viabilidad; una visita sola no demuestra el resultado.')], ['OPENSTAX-ECO']),
      m('competencia-depredacion', 'Conflicto también organiza', 'Si un depredador consume una presa, ¿la relación es “mala” para el ecosistema?', [
        { title: 'Efectos individuales y ecológicos', body: 'La depredación perjudica al individuo consumido, pero es un proceso natural que transfiere energía y puede regular poblaciones.' },
        { title: 'Competir por lo limitado', body: 'Hay competencia cuando organismos usan un recurso limitado. Puede ocurrir dentro de una especie o entre especies.' },
        { title: 'Evitar juicios rápidos', body: '“Bueno” y “malo” ocultan escalas. Para evaluar un cambio se pregunta quién, dónde, cuándo y respecto de qué evidencia.' },
      ], [q('eco-interactions', 'multi', '¿Qué preguntas hacen falta para evaluar una interacción?', ['Quiénes participan', 'En qué ambiente', 'Durante qué período', 'Si nos resulta simpática'], ['Quiénes participan', 'En qué ambiente', 'Durante qué período'], 'La evaluación ecológica necesita contexto y escala, no simpatía humana.')], ['OPENSTAX-ECO']),
    ],
  },
  {
    id: 'historias-del-territorio', shortTitle: 'Historias', title: 'Historias del territorio', icon: 'bird', color: '#9A5B00',
    description: 'Cinco especies para entender conservación, cultura y convivencia.',
    modules: [
      m('cardenal-amarillo', 'Cardenal amarillo', '¿Cómo vuelve una especie a un sitio donde desapareció?', [
        { title: 'Una presencia frágil', body: 'El cardenal amarillo (Gubernatrix cristata) sufrió una fuerte presión por captura para el comercio ilegal y pérdida de hábitat.' },
        { title: 'Reintroducir es un proceso', body: 'En Uruguay se liberaron ejemplares con evaluación sanitaria, adaptación previa y seguimiento. Soltar no basta: hay que medir supervivencia y reproducción.' },
        { title: 'La historia continúa', body: 'Cada registro responsable puede aportar información, pero la ubicación de especies sensibles no debe exponerse de forma que facilite su captura.', callout: 'Conservar también es decidir qué dato no conviene publicar con precisión.' },
      ], [q('story-yellow', 'order', 'Ordená una reintroducción responsable.', ['Seguimiento', 'Evaluación y preparación', 'Liberación'], ['Evaluación y preparación', 'Liberación', 'Seguimiento'], 'La liberación es sólo una etapa entre la preparación y el monitoreo posterior.')], ['UY-CARD-AM']),
      m('cardenal-copete-rojo', 'Cardenal de copete rojo', 'Que un ave sea conocida, ¿significa que no necesita atención?', [
        { title: 'Una figura cultural', body: 'Paroaria coronata es reconocible por su copete rojo y aparece en ambientes abiertos y arbolados. Su popularidad también alimentó la tenencia en jaula.' },
        { title: 'Prioritaria no equivale a amenazada', body: 'Uruguay la considera prioritaria por criterios que incluyen su valor cultural y presión de captura. Esa categoría no es lo mismo que una categoría de amenaza.' },
        { title: 'Las etiquetas responden preguntas distintas', body: 'Prioridad de conservación, protección legal y riesgo de extinción pueden coincidir, pero deben leerse por separado.' },
      ], [q('story-red', 'single', '¿Qué afirmación es correcta?', ['“Prioritaria” siempre significa “En Peligro”', 'Prioridad y amenaza son evaluaciones distintas', 'Ser común impide toda protección'], ['Prioridad y amenaza son evaluaciones distintas'], 'Una lista de prioridad puede sumar criterios culturales, ecológicos o de gestión distintos del riesgo de extinción.')], ['UY-CARD-ROJO', 'UY-PRIOR']),
      m('cotorra', 'Cotorra', '¿Cómo se convive con una especie nativa que puede causar daño productivo?', [
        { title: 'Nativa y conflictiva pueden coexistir', body: 'La cotorra (Myiopsitta monachus) es nativa de Uruguay. En ciertos contextos sus colonias pueden afectar cultivos o infraestructura.' },
        { title: 'El problema se mide', body: 'Un manejo responsable identifica daño, escala, lugar y momento. No convierte a todos los individuos ni a toda la especie en “plaga”.' },
        { title: 'Buscar alternativas', body: 'INIA investiga métodos anticonceptivos como herramienta de manejo. La eficacia, el bienestar animal y los efectos no deseados deben evaluarse.' },
      ], [q('story-parakeet', 'multi', '¿Qué debe medir un plan de manejo?', ['Daño real', 'Escala y lugar', 'Efectos del método', 'Una opinión aislada'], ['Daño real', 'Escala y lugar', 'Efectos del método'], 'El manejo se apoya en evidencia del problema y de las consecuencias de intervenir.')], ['INIA-COTORRA']),
      m('torcaza', 'Torcaza: no torcacita', '¿Qué paloma protagoniza los estudios uruguayos sobre daño agrícola?', [
        { title: 'La especie correcta', body: 'La torcaza (Zenaida auriculata) puede formar grandes concentraciones y ocasionar daño en cultivos. No debe confundirse con la torcacita común (Columbina picui).' },
        { title: 'Abundancia no es una esencia', body: 'Los conflictos dependen de alimento disponible, paisaje y concentración. “Hay muchas aquí” no describe automáticamente toda la población nacional.' },
        { title: 'Manejo integrado', body: 'La respuesta puede combinar prevención, monitoreo y medidas autorizadas. El objetivo es reducir daño comprobado, no castigar una especie.' },
      ], [q('story-dove', 'single', '¿Cuál es la especie asociada al daño agrícola documentado por MGAP?', ['Torcacita común (Columbina picui)', 'Torcaza (Zenaida auriculata)'], ['Torcaza (Zenaida auriculata)'], 'Son especies distintas. La documentación citada trata sobre Zenaida auriculata.')], ['MGAP-TORCAZA']),
      m('venado-de-campo', 'Venado de campo', '¿Qué revela que una especie tenga protección especial desde hace décadas?', [
        { title: 'Un habitante de pastizales', body: 'El venado de campo (Ozotoceros bezoarticus) depende de ambientes abiertos y hoy persiste en poblaciones reducidas y separadas.' },
        { title: 'Monumento natural', body: 'Uruguay lo declaró Monumento Natural en 1985. La protección legal reconoce un valor especial, pero no reemplaza el trabajo sobre hábitat y poblaciones.' },
        { title: 'Conservar el paisaje', body: 'Una especie móvil necesita más que un punto protegido: calidad de pastizal, conectividad, acuerdos con productores y seguimiento.' },
      ], [q('story-deer', 'multi', '¿Qué necesita la conservación del venado además de protección legal?', ['Hábitat adecuado', 'Conectividad', 'Seguimiento', 'Sólo una estatua'], ['Hábitat adecuado', 'Conectividad', 'Seguimiento'], 'Una declaración es una herramienta; la conservación ocurre sobre poblaciones y paisajes.')], ['UY-VENADO']),
    ],
  },
  {
    id: 'caza-y-convivencia', shortTitle: 'Caza', title: 'Fauna, caza y convivencia', icon: 'balance', color: '#7A4B36',
    description: 'Historia, reglas vigentes y decisiones públicas basadas en evidencia.',
    modules: [
      m('regla-general', 'La regla general', '¿En Uruguay se puede cazar cualquier especie que no figure como amenazada?', [
        { title: 'Prohibición como punto de partida', body: 'La Ley 9.481 establece un régimen de protección de fauna. Las excepciones, temporadas y permisos surgen de normas y resoluciones específicas.' },
        { title: 'Amenaza y permiso no son lo mismo', body: 'Una especie no amenazada puede estar protegida; una especie habilitada puede tener cupos, fechas o zonas. Son decisiones jurídicas y de gestión.' },
        { title: 'La fuente debe estar vigente', body: 'Las reglas pueden cambiar. Arapy muestra fecha de consulta y enlaza al organismo competente; nunca funciona como permiso.' },
      ], [q('hunt-default', 'single', 'Si una especie no está amenazada, ¿queda automáticamente habilitada para caza?', ['Sí', 'No'], ['No'], 'Estado de conservación y habilitación legal son sistemas distintos.')], ['LEY-9481', 'UY-CAZA']),
      m('categorias-permisos', 'Libre, deportiva y control', '¿“Caza libre” significa sin ninguna regla?', [
        { title: 'Categorías administrativas', body: 'La información oficial distingue especies de libre caza y especies de caza deportiva con permiso, temporada y condiciones. “Libre” no habilita crueldad, riesgos ni ingreso a propiedad ajena.' },
        { title: 'Situación consultada', body: 'En setiembre de 2026 el Ministerio incluye jabalí, cotorra y garibaldino entre las especies de libre caza, y publica aparte especies de caza deportiva.' },
        { title: 'Control no es deporte', body: 'Una acción de control por daño tiene objetivo, autorización y evaluación propios. No conviene mezclarla con recreación ni con conservación.' },
      ], [q('hunt-types', 'classify', 'Separá cada caso.', ['Temporada y permiso recreativo', 'Intervención por daño comprobado', 'Categoría oficial sin temporada ni cupo'], [], 'Deportiva, control y libre son marcos distintos y cada uno conserva obligaciones generales.', { categories: ['Deportiva', 'Control', 'Libre'], classification: { 'Temporada y permiso recreativo': 'Deportiva', 'Intervención por daño comprobado': 'Control', 'Categoría oficial sin temporada ni cupo': 'Libre' } })], ['UY-CAZA']),
      m('evidencia-y-cambios', 'Reglas que cambian con evidencia', '¿Por qué una temporada válida hoy puede suspenderse mañana?', [
        { title: 'Poblaciones, no impresiones', body: 'La ley exige estudios poblacionales para sostener decisiones. Tendencias, reproducción, distribución y presión de extracción importan más que una observación puntual.' },
        { title: 'Un cambio reciente', body: 'El Decreto 200/026 dispuso suspender desde 2027 la caza deportiva de tres especies de patos. Es un ejemplo de norma que modifica una situación previa.' },
        { title: 'Fecha y jurisdicción', body: 'Toda pantalla legal debe indicar vigencia y territorio. Ante una duda concreta corresponde consultar al Ministerio de Ambiente.' },
      ], [q('hunt-evidence', 'multi', '¿Qué vuelve responsable una ficha normativa?', ['Fecha de vigencia', 'Enlace oficial', 'Distinguir categoría y especie', 'Copiar una regla vieja sin fecha'], ['Fecha de vigencia', 'Enlace oficial', 'Distinguir categoría y especie'], 'La trazabilidad evita tratar una regla histórica como permiso actual.')], ['LEY-9481', 'DEC-200-026', 'UY-CAZA']),
      m('impacto-y-fiscalizacion', 'Lo permitido no agota la pregunta', '¿Cumplir la norma garantiza que una acción sea ecológicamente neutra?', [
        { title: 'Legalidad y efecto', body: 'La legalidad fija un mínimo. El impacto también depende de cantidad, lugar, momento, bienestar animal y especies no objetivo.' },
        { title: 'La caza ilegal existe', body: 'El Informe del estado del ambiente reporta un promedio de 115 procedimientos anuales por caza ilegal entre 2012 y 2021. Un procedimiento no equivale a un animal ni a una condena.' },
        { title: 'Participación responsable', body: 'No confrontar ni perseguir. Registrar sólo si es seguro y usar canales oficiales ayuda más que difundir ubicaciones sensibles en redes.' },
      ], [q('hunt-impact', 'single', '¿Qué significa “115 procedimientos” en el informe?', ['115 especies extinguidas', 'Un promedio anual de actuaciones, no de animales', '115 permisos'], ['Un promedio anual de actuaciones, no de animales'], 'La unidad del dato es el procedimiento; interpretarla bien evita exageraciones.')], ['OAN-2024']),
    ],
  },
  {
    id: 'conservacion', shortTitle: 'Conservación', title: '¿Cómo sabemos que una especie está amenazada?', icon: 'shield', color: '#9B3F45',
    description: 'Criterios, datos e instituciones detrás de una categoría de riesgo.',
    modules: [
      m('riesgo-no-conteo', 'Riesgo no es sólo contar', '¿Una especie con miles de individuos puede estar amenazada?', [
        { title: 'Probabilidad de extinción', body: 'Una categoría de amenaza sintetiza riesgo de extinción en un área y período, no sólo cuántos individuos vemos hoy.' },
        { title: 'Cinco familias de criterios', body: 'UICN evalúa reducción poblacional, distribución restringida, tamaño pequeño y declive, población muy pequeña o análisis cuantitativo del riesgo.' },
        { title: 'Umbrales comparables', body: 'Los criterios usan umbrales explícitos y evidencia documentada. La categoría más alta aplicable determina el resultado de la evaluación.' },
      ], [q('cons-criteria', 'multi', '¿Qué puede elevar el riesgo?', ['Declive rápido', 'Distribución muy restringida', 'Población muy pequeña', 'Ser poco fotografiada'], ['Declive rápido', 'Distribución muy restringida', 'Población muy pequeña'], 'Pocas fotos pueden indicar falta de datos, pero no demuestran por sí solas riesgo de extinción.')], ['IUCN-CAT']),
      m('categorias', 'De Preocupación Menor a Extinta', '¿“Datos Insuficientes” significa que no hay riesgo?', [
        { title: 'Una secuencia con matices', body: 'Las categorías incluyen Preocupación Menor, Casi Amenazada, Vulnerable, En Peligro, En Peligro Crítico, Extinta en Estado Silvestre y Extinta.' },
        { title: 'Las amenazadas', body: 'En el sistema UICN, Vulnerable, En Peligro y En Peligro Crítico son las categorías “amenazadas”. Casi Amenazada queda cerca de los umbrales.' },
        { title: 'No evaluada y Datos Insuficientes', body: 'No Evaluada indica que falta aplicar el proceso; Datos Insuficientes, que la información no permite estimar el riesgo. Ninguna equivale a “segura”.' },
      ], [q('cons-category', 'classify', 'Clasificá las categorías.', ['Vulnerable', 'En Peligro', 'Casi Amenazada', 'Datos Insuficientes'], [], 'Vulnerable y En Peligro son amenazadas; Casi Amenazada no lo es formalmente; Datos Insuficientes no permite decidir.', { categories: ['Amenazada', 'No amenazada', 'Sin conclusión'], classification: { Vulnerable: 'Amenazada', 'En Peligro': 'Amenazada', 'Casi Amenazada': 'No amenazada', 'Datos Insuficientes': 'Sin conclusión' } })], ['IUCN-CAT']),
      m('proceso', 'De datos a decisión', '¿Quién “declara” amenazada a una especie?', [
        { title: 'Evaluar, revisar, publicar', body: 'Especialistas reúnen datos, aplican criterios, documentan incertidumbre y someten la evaluación a revisión. La autoridad de cada lista define su publicación.' },
        { title: 'Global no es nacional', body: 'UICN evalúa a escala global. Uruguay puede hacer una evaluación nacional: una especie segura globalmente puede estar en riesgo dentro del país, o al revés.' },
        { title: 'La categoría tiene apellido', body: 'Siempre hay que mostrar sistema, ámbito y fecha: por ejemplo “En Peligro — Lista Roja nacional, 2012”. Sin eso, la etiqueta queda incompleta.' },
      ], [q('cons-process', 'order', 'Ordená un proceso de evaluación.', ['Publicar categoría', 'Aplicar criterios', 'Reunir evidencia', 'Revisión'], ['Reunir evidencia', 'Aplicar criterios', 'Revisión', 'Publicar categoría'], 'La categoría surge después de documentar evidencia, aplicar criterios y revisar.')], ['IUCN-ASSESS', 'UY-AVES-RL']),
      m('amenaza-prioridad-ley', 'Tres etiquetas, tres preguntas', '¿Amenazada, prioritaria y protegida quieren decir lo mismo?', [
        { title: 'Amenaza', body: 'Pregunta por riesgo de extinción bajo un sistema y una escala definidos.' },
        { title: 'Prioridad', body: 'Ayuda a decidir dónde enfocar conservación y puede sumar singularidad, función ecológica, valor cultural, viabilidad o presión humana.' },
        { title: 'Protección legal', body: 'Establece obligaciones y prohibiciones. Puede alcanzar especies que no están amenazadas y variar con la jurisdicción.', callout: 'Arapy muestra estos campos separados para no fabricar equivalencias.' },
      ], [q('cons-labels', 'classify', '¿Qué pregunta responde cada etiqueta?', ['Riesgo de extinción', 'Dónde enfocar acciones', 'Qué permite o prohíbe la norma'], [], 'Amenaza, prioridad y protección legal son capas relacionadas pero distintas.', { categories: ['Amenaza', 'Prioridad', 'Protección legal'], classification: { 'Riesgo de extinción': 'Amenaza', 'Dónde enfocar acciones': 'Prioridad', 'Qué permite o prohíbe la norma': 'Protección legal' } })], ['IUCN-CAT', 'UY-PRIOR', 'LEY-9481']),
    ],
  },
];

export const learningPathById = (id: string) => LEARNING_PATHS.find((path) => path.id === id);
export const learningModuleById = (pathId: string, moduleId: string) => learningPathById(pathId)?.modules.find((module) => module.id === moduleId);
export const learningSourceByCode = (code: string) => LEARNING_SOURCES.find((source) => source.code === code);
