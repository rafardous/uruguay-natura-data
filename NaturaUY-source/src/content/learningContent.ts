import type { LearningPath, LearningSource } from '../domain/entities/learning';

// Lecturas bootstrap: las imágenes reutilizan especies y derechos del catálogo.
export const LEARNING_SOURCES: LearningSource[] = [
  {
    "code": "ICZN",
    "name": "Código Internacional de Nomenclatura Zoológica",
    "url": "https://www.iczn.org/the-code/the-code-online/"
  },
  {
    "code": "ICN",
    "name": "Código Internacional de Nomenclatura para algas, hongos y plantas",
    "url": "https://www.iapt-taxon.org/nomen/main.php"
  },
  {
    "code": "GBIF-TAX",
    "name": "GBIF — What is a species?",
    "url": "https://www.gbif.org/species"
  },
  {
    "code": "NHM-TAX",
    "name": "Natural History Museum — What is taxonomy?",
    "url": "https://www.nhm.ac.uk/discover/what-is-taxonomy.html"
  },
  {
    "code": "LINNEAN-NAMES",
    "name": "The Linnean Society — Naming Nature",
    "url": "https://www.linnean.org/research-collections/on-display/staircase/naming-nature"
  },
  {
    "code": "UOREGON-HISTORY",
    "name": "University of Oregon — A Bibliographic History of Biology",
    "url": "https://expo.uoregon.edu/spotlight/history-biology/feature/greeks-and-romans"
  },
  {
    "code": "OPENSTAX-ECO",
    "name": "OpenStax Biology 2e — Community ecology",
    "url": "https://openstax.org/books/biology-2e/pages/45-6-community-ecology"
  },
  {
    "code": "IUCN-CAT",
    "name": "UICN — Categorías y criterios de la Lista Roja",
    "url": "https://www.iucnredlist.org/resources/categories-and-criteria"
  },
  {
    "code": "IUCN-ASSESS",
    "name": "UICN — Proceso de evaluación",
    "url": "https://www.iucnredlist.org/assessment/process"
  },
  {
    "code": "UY-PRIOR",
    "name": "Ministerio de Ambiente — Especies prioritarias para la conservación",
    "url": "https://www.gub.uy/ministerio-ambiente/politicas-y-gestion/especies-prioritarias-para-conservacion"
  },
  {
    "code": "UY-AVES-RL",
    "name": "Lista Roja de las Aves del Uruguay",
    "url": "https://www.gub.uy/ministerio-ambiente/sites/ministerio-ambiente/files/documentos/publicaciones/Lista_Roja_Web_Azpiroz_et_al_2012_ultima.pdf"
  },
  {
    "code": "UY-CARD-AM",
    "name": "Ministerio de Ambiente — Reintroducción del cardenal amarillo",
    "url": "https://www.gub.uy/ministerio-ambiente/comunicacion/noticias/cardenal-amarillo-especie-extincion"
  },
  {
    "code": "UY-CARD-ROJO",
    "name": "Observatorio Ambiental — Paroaria coronata",
    "url": "https://www.ambiente.gub.uy/especies/especie/P_coronata/"
  },
  {
    "code": "INIA-COTORRA",
    "name": "INIA — Manejo del daño de cotorras",
    "url": "https://inia.uy/proyectos/metodo-contraceptivo-para-el-manejo-del-dano-de-cotorras"
  },
  {
    "code": "MGAP-TORCAZA",
    "name": "MGAP — Manejo del daño ocasionado por paloma torcaza",
    "url": "https://www.gub.uy/ministerio-ganaderia-agricultura-pesca/comunicacion/publicaciones/manejo-del-dano-ocasionado-paloma-torcaza-zenaida-auriculata"
  },
  {
    "code": "UY-VENADO",
    "name": "IMPO — Decreto 12/985, venado de campo",
    "url": "https://www.impo.com.uy/bases/decretos/12-1985"
  },
  {
    "code": "UY-CAZA",
    "name": "Ministerio de Ambiente — Permisos de tenencia y caza deportiva",
    "url": "https://www.gub.uy/ministerio-ambiente/politicas-y-gestion/permisos-tenencia-caza-deportiva",
    "note": "Información consultada el 11 de octubre de 2026. Consultá las normas vigentes ante un caso concreto."
  },
  {
    "code": "LEY-9481",
    "name": "IMPO — Ley de Fauna 9.481",
    "url": "https://www.impo.com.uy/bases/leyes/9481-1935"
  },
  {
    "code": "DEC-200-026",
    "name": "IMPO — Decreto 200/026",
    "url": "https://www.impo.com.uy/bases/decretos/200-2026",
    "note": "Suspende desde 2027 la caza deportiva de tres especies de patos."
  },
  {
    "code": "OAN-2024",
    "name": "Observatorio Ambiental Nacional — Informe del estado del ambiente 2024",
    "url": "https://www.ambiente.gub.uy/oan/documentos/INFORME-DEL-ESTADO-DEL-AMBIENTE-2024-1.21.pdf"
  },
  {
    "code": "UY-TRAFICO-2024",
    "name": "Ministerio de Ambiente — Incautación de aves en Lavalleja",
    "url": "https://www.gub.uy/ministerio-ambiente/comunicacion/noticias/incautacion-aves-silvestres-trafico-ilegal-lavalleja",
    "note": "Caso documentado el 18 de abril de 2024."
  },
  {
    "code": "UY-VENADO-POB",
    "name": "Intendencia de Maldonado — Conservación del venado de campo",
    "url": "https://www.maldonado.gub.uy/noticias/semen-venados-machos-silvestres-inseminara-hembras-ecfa",
    "note": "Descripción de poblaciones y trabajo de conservación publicada en 2022; no es un censo actual."
  },
  {
    "code": "AZPIROZ-2003",
    "name": "Azpiroz — Aves del Uruguay (2003)",
    "url": "https://www.avesuruguay.org.uy/",
    "note": "Guía de campo, Aves Uruguay. Rasgos y alimentación contrastados con los perfiles aprobados del catálogo. Información histórica, no un conteo actual."
  }
];

export const LEARNING_PATHS: LearningPath[] = [
  {
    "id": "ordenar-la-vida",
    "shortTitle": "Taxonomía",
    "title": "Ordenar la vida",
    "icon": "tree",
    "color": "#8D6725",
    "description": "Cómo nombramos, agrupamos y revisamos el parentesco de los seres vivos.",
    "modules": [
      {
        "id": "para-que-clasificar",
        "title": "¿Para qué clasificar?",
        "hook": "¿Cómo nos ayuda poner en orden la enorme variedad de seres vivos?",
        "blocks": [
          {
            "title": "Empecemos por dos seres vivos",
            "body": "Mirá el cardenal de copete rojo y el ceibo. Los dos son seres vivos y ambos tienen el color rojo, pero uno es un animal y el otro una planta, por lo que al clasificarlos los pondríamos en grupos diferentes.\n\nClasificar es reunir organismos en grupos y explicar qué comparten. La taxonomía es la parte de la ciencia que los identifica, les da nombres y los clasifica.",
            "illustration": {
              "title": "Dos ramas de la vida",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "P_coronata",
                  "label": "Cardenal de copete rojo",
                  "caption": "Paroaria coronata"
                },
                {
                  "speciesCode": "plant-erythrina-crista-galli",
                  "label": "Ceibo",
                  "caption": "Erythrina crista-galli"
                }
              ]
            }
          },
          {
            "title": "¿En qué nos ayuda clasificar?",
            "body": "Clasificar nos ayuda a evitar confusiones: podemos saber de qué organismo hablamos aunque en distintos lugares usen nombres comunes diferentes. También permite comparar sus características, ordenar mucha información y descubrir qué seres vivos comparten antepasados. Con esas pistas estudiamos la evolución y podemos decidir qué ambientes y especies necesitan más atención."
          },
          {
            "title": "Una idea que fue creciendo",
            "body": "Hace más de dos mil años, Aristóteles observó animales y buscó maneras de ordenarlos según sus características. Teofrasto, que estudió las plantas, describió cómo eran y cómo crecían. Mucho después, en el siglo XVIII, Carlos Linneo organizó nombres y grupos en un sistema que ayudaba a naturalistas de distintos lugares a conversar sobre las mismas especies. La ciencia de hoy suma nuevas pruebas, como el ADN, y revisa algunas ramas de aquel árbol.",
            "illustration": {
              "title": "Tres momentos de la historia de la clasificación",
              "layout": "sequence",
              "items": [
                { "label": "Aristóteles", "caption": "Observó y agrupó animales." },
                { "label": "Teofrasto", "caption": "Describió plantas y sus formas de crecer." },
                { "label": "Linneo", "caption": "Ordenó grupos y popularizó los nombres de dos palabras." }
              ]
            }
          },
          {
            "title": "Un mapa de parentescos",
            "body": "La clasificación también ayuda a investigar qué seres vivos comparten antepasados. Podemos imaginarla como un árbol con ramas: algunas se separaron hace mucho y otras más recientemente. No es un podio de especies importantes. Cada especie tiene su propia historia."
          },
          {
            "title": "Un mapa que se puede mejorar",
            "body": "Cuando aparecen nuevas pruebas, el árbol puede cambiar. El organismo sigue siendo el mismo: cambió lo que sabemos sobre él. Así, una clasificación sirve para nombrar, comparar y conectar información, y se puede corregir cuando aprendemos algo nuevo."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "Clasificar sirve para reconocer organismos sin confundirlos, comparar sus características y estudiar cómo se relacionan. Aristóteles, Teofrasto y Linneo buscaron formas de ordenar lo que observaban; hoy seguimos revisando esas ideas con nuevas pruebas."
          }
        ],
        "questions": [
          {
            "id": "tax-purpose",
            "objectiveId": "tax-purpose",
            "version": 2,
            "type": "single",
            "prompt": "¿Para qué nos ayuda una clasificación científica?",
            "options": [
              "Para decidir qué especie vale más",
              "Para nombrar, comparar y relacionar información",
              "Para que los seres vivos nunca cambien"
            ],
            "correct": [
              "Para nombrar, comparar y relacionar información"
            ],
            "explanation": "Clasificar permite compartir nombres, comparar seres vivos y estudiar sus parentescos. No es un ranking de importancia."
          },
          {
            "id": "tax-history-comprehension",
            "objectiveId": "tax-history-comprehension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué aporta una clasificación a quienes estudian la naturaleza?",
            "options": [
              "Ayuda a comparar seres vivos y estudiar sus relaciones",
              "Hace que las especies nunca cambien",
              "Sirve para elegir cuál especie es más importante"
            ],
            "correct": [
              "Ayuda a comparar seres vivos y estudiar sus relaciones"
            ],
            "explanation": "Ayuda a comparar seres vivos y estudiar sus relaciones. También permite ordenar información y evitar confusiones; no es una competencia entre especies."
          }
        ],
        "sourceCodes": [
          "GBIF-TAX",
          "NHM-TAX",
          "UOREGON-HISTORY"
        ],
        "contentVersion": 2
      },
      {
        "id": "rangos",
        "title": "De reino a especie",
        "hook": "¿Qué comparten un carpincho y un cardenal antes de que sus caminos se separen?",
        "blocks": [
          {
            "title": "De un grupo grande a uno pequeño",
            "body": "Imaginá cajas dentro de otras cajas. El reino es una caja grande; dentro se encuentran grupos cada vez más precisos. Una ruta frecuente es reino, filo, clase, orden, familia, género y especie. Los rangos son los nombres de esos niveles.",
            "illustration": {
              "title": "De amplio a preciso",
              "layout": "sequence",
              "items": [
                {
                  "label": "Reino"
                },
                {
                  "label": "Filo"
                },
                {
                  "label": "Clase"
                },
                {
                  "label": "Orden"
                },
                {
                  "label": "Familia"
                },
                {
                  "label": "Género"
                },
                {
                  "label": "Especie"
                }
              ]
            }
          },
          {
            "title": "Un tramo compartido",
            "body": "El carpincho y el cardenal de copete rojo pertenecen al reino Animalia y al filo Chordata. Dentro de ese filo, sus caminos se separan: el carpincho está en la clase Mammalia y el cardenal en Aves. Comparten grupos amplios, aunque no sean de la misma clase.",
            "illustration": {
              "title": "Compartimos reino y filo; cambia la clase",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "H_hydrocha",
                  "label": "Carpincho",
                  "caption": "Animalia → Chordata → Mammalia"
                },
                {
                  "speciesCode": "P_coronata",
                  "label": "Cardenal de copete rojo",
                  "caption": "Animalia → Chordata → Aves"
                }
              ]
            }
          },
          {
            "title": "La dirección de una especie",
            "body": "Seguir la rama hacia el género y la especie hace la dirección más precisa. No todos los grupos tienen información completa y pueden existir niveles intermedios. En el catálogo podés tocar un nombre taxonómico para explorar esa rama. Si falta un nivel, eso no inventa un grupo nuevo."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "El carpincho y el cardenal comparten Animalia y Chordata. Sus caminos se separan al llegar a la clase: Mammalia y Aves."
          }
        ],
        "questions": [
          {
            "id": "tax-order",
            "objectiveId": "tax-order",
            "version": 1,
            "type": "order",
            "prompt": "Ordená de más amplio a más específico.",
            "options": [
              "Especie",
              "Familia",
              "Reino",
              "Clase"
            ],
            "correct": [
              "Reino",
              "Clase",
              "Familia",
              "Especie"
            ],
            "explanation": "Los rangos se anidan: reino es más amplio y especie, más específico."
          },
          {
            "id": "rangos-comprension",
            "objectiveId": "rangos-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿En qué nivel se separan los caminos del carpincho y del cardenal?",
            "options": [
              "En la clase",
              "No se separan",
              "En el reino"
            ],
            "correct": [
              "En la clase"
            ],
            "explanation": "En la clase. El carpincho y el cardenal comparten Animalia y Chordata. Sus caminos se separan al llegar a la clase: Mammalia y Aves."
          }
        ],
        "sourceCodes": [
          "GBIF-TAX"
        ],
        "contentVersion": 2
      },
      {
        "id": "nombres",
        "title": "Cómo se escribe un nombre científico",
        "hook": "¿Cómo evita confusiones un nombre científico de dos palabras?",
        "blocks": [
          {
            "title": "Dos palabras que van juntas",
            "body": "El nombre científico del cardenal de copete rojo es Paroaria coronata. Paroaria es el género. Coronata es el epíteto específico: la segunda parte del nombre. Las dos palabras juntas identifican la especie; la segunda sola no alcanza.",
            "illustration": {
              "title": "Leé las dos partes del nombre",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "P_coronata",
                  "label": "Cardenal de copete rojo",
                  "caption": "Paroaria: género · coronata: epíteto específico"
                }
              ]
            }
          },
          {
            "title": "Dos cardenales, dos especies",
            "body": "En una charla, “cardenal” puede alcanzar. Pero el cardenal de copete rojo y el cardenal amarillo son aves distintas. Los nombres comunes varían entre regiones y hasta pueden repetirse. Sus nombres científicos, Paroaria coronata y Gubernatrix cristata, nos permiten saber con precisión de cuál se trata y compartir observaciones sin enredos.",
            "illustration": {
              "title": "El mismo nombre común puede señalar especies distintas",
              "layout": "compare",
              "items": [
                { "speciesCode": "P_coronata", "label": "Cardenal de copete rojo", "caption": "Paroaria coronata" },
                { "speciesCode": "G_cristata", "label": "Cardenal amarillo", "caption": "Gubernatrix cristata" }
              ]
            }
          },
          {
            "title": "Una pequeña regla de escritura",
            "body": "El género empieza con mayúscula y el epíteto va en minúscula. Cuando el formato lo permite, las dos palabras se escriben en cursiva, con letras inclinadas. Probá reconocer la forma correcta antes de seguir: Paroaria coronata."
          },
          {
            "title": "Reglas para compartir los nombres",
            "body": "Los animales y las plantas tienen códigos internacionales diferentes, pero ambos ayudan a usar nombres de manera ordenada. A veces aparece también el nombre de quien describió la especie y el año. Esos datos cuentan parte de su historia, pero no son las dos palabras del nombre de especie."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "El nombre científico usa dos palabras —género y epíteto específico— para identificar la especie con precisión. Por eso Paroaria coronata y Gubernatrix cristata no se confunden aunque a las dos aves les digamos “cardenal”."
          }
        ],
        "questions": [
          {
            "id": "tax-name",
            "objectiveId": "tax-name",
            "version": 1,
            "type": "single",
            "prompt": "¿Cuál está escrito con la forma correcta?",
            "options": [
              "paroaria Coronata",
              "Paroaria coronata",
              "PAROARIA CORONATA"
            ],
            "correct": [
              "Paroaria coronata"
            ],
            "explanation": "Género con inicial mayúscula, epíteto en minúscula y ambos en cursiva cuando el formato lo permite."
          },
          {
            "id": "nombres-comprension",
            "objectiveId": "nombres-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué identifica a la especie en un nombre científico?",
            "options": [
              "Sólo el año de publicación",
              "Sólo la segunda palabra",
              "El género y el epíteto juntos"
            ],
            "correct": [
              "El género y el epíteto juntos"
            ],
            "explanation": "El género y el epíteto juntos. Paroaria coronata tiene dos palabras porque el nombre de la especie combina un género y un epíteto específico."
          },
          {
            "id": "para-que-clasificar-comprension",
            "objectiveId": "para-que-clasificar-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Por qué puede ser confuso decir solamente “cardenal”?",
            "options": [
              "Porque todos los cardenales son la misma especie",
              "Porque distintas especies pueden compartir ese nombre",
              "Porque las aves no tienen nombres"
            ],
            "correct": [
              "Porque distintas especies pueden compartir ese nombre"
            ],
            "explanation": "Distintas especies pueden compartir un nombre común. Paroaria coronata y Gubernatrix cristata son dos ejemplos; sus nombres científicos permiten distinguirlas."
          }
        ],
        "sourceCodes": [
          "ICZN",
          "ICN",
          "LINNEAN-NAMES"
        ],
        "contentVersion": 2
      },
      {
        "id": "evidencia",
        "title": "Cuando el árbol cambia",
        "hook": "Dos especies se parecen. ¿Eso prueba que son parientes cercanas?",
        "blocks": [
          {
            "title": "Parecerse es una pista",
            "body": "Mirá la torcaza y la torcacita común. Ambas son palomas, pero son especies distintas. Una foto permite comparar formas y colores; por sí sola no cuenta toda su historia. En otros casos, seres vivos de ramas lejanas desarrollan rasgos parecidos porque enfrentan desafíos semejantes.",
            "illustration": {
              "title": "Comparar es el comienzo de la investigación",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "Z_auricula",
                  "label": "Torcaza",
                  "caption": "Zenaida auriculata"
                },
                {
                  "speciesCode": "C_picui",
                  "label": "Torcacita común",
                  "caption": "Columbina picui"
                }
              ]
            }
          },
          {
            "title": "Juntar varias pruebas",
            "body": "Para estudiar parentescos se comparan partes del cuerpo, fósiles y ADN. El ADN contiene información que pasa entre generaciones. Cada prueba aporta una pieza, como en un rompecabezas. Cuantas más piezas se pueden contrastar, mejor podemos revisar nuestra explicación."
          },
          {
            "title": "Cambiar de idea con buenas razones",
            "body": "Si nuevas pruebas muestran otro parentesco, se puede revisar una rama del árbol. Eso es aprender, no hacer trampa. También puede cambiar el nombre aceptado de una especie. En Arapy su ficha conserva la identidad, para que puedas seguir encontrándola en tus favoritos."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "No: el parecido es una pista, pero no prueba por sí solo un parentesco cercano. Hay que compararlo con otras pruebas, como ADN y fósiles."
          }
        ],
        "questions": [
          {
            "id": "tax-evidence",
            "objectiveId": "tax-evidence",
            "version": 1,
            "type": "classify",
            "prompt": "Clasificá cada elemento.",
            "options": [
              "ADN",
              "Color parecido",
              "Fósiles",
              "Nombre popular"
            ],
            "correct": [],
            "explanation": "ADN y fósiles son evidencia directa de una evaluación sistemática; color y nombre popular por sí solos no bastan.",
            "categories": [
              "Evidencia útil",
              "No alcanza solo"
            ],
            "classification": {
              "ADN": "Evidencia útil",
              "Fósiles": "Evidencia útil",
              "Color parecido": "No alcanza solo",
              "Nombre popular": "No alcanza solo"
            }
          },
          {
            "id": "evidencia-comprension",
            "objectiveId": "evidencia-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué hacemos si nuevas pruebas contradicen una clasificación?",
            "options": [
              "Ignoramos las pruebas",
              "Revisamos la explicación",
              "Cambiamos al animal"
            ],
            "correct": [
              "Revisamos la explicación"
            ],
            "explanation": "Revisamos la explicación. No: el parecido es una pista, pero no prueba por sí solo un parentesco cercano. Hay que compararlo con otras pruebas, como ADN y fósiles."
          }
        ],
        "sourceCodes": [
          "GBIF-TAX"
        ],
        "contentVersion": 2
      }
    ],
    "illustration": {
      "title": "Un árbol con distintas ramas",
      "layout": "tree",
      "items": [
        { "label": "Vida" },
        { "label": "Plantas" },
        { "label": "Animales" },
        { "label": "Hongos" },
        { "label": "Aves" },
        { "label": "Mamíferos" }
      ]
    }
  },
  {
    "id": "redes-de-vida",
    "shortTitle": "Ecología",
    "title": "Redes de vida",
    "icon": "network",
    "color": "#477052",
    "description": "Roles ecológicos, interacciones y simbiosis en nuestros ambientes.",
    "modules": [
      {
        "id": "rol-no-etiqueta",
        "title": "Un rol depende del lugar",
        "hook": "¿Una especie cumple siempre una sola función?",
        "blocks": [
          {
            "title": "Mirá qué hace, además de cómo se llama",
            "body": "La ecología estudia las relaciones entre los seres vivos y su ambiente. Para conocer el rol de una especie preguntamos qué come, dónde vive y cómo se relaciona con otras. Su rol no es una tarea asignada: es el conjunto de efectos que tiene al vivir.",
            "illustration": {
              "title": "Un ave, distintas relaciones",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "T_rufivent",
                  "label": "Zorzal común",
                  "caption": "Turdus rufiventris"
                }
              ]
            }
          },
          {
            "title": "Varias relaciones al mismo tiempo",
            "body": "El zorzal común come frutos e insectos. Al alimentarse se conecta con las plantas y con los animales pequeños de su entorno. También necesita lugares donde descansar y refugiarse. Una sola etiqueta, como “come frutos”, deja afuera parte de su vida."
          },
          {
            "title": "El ambiente cambia la historia",
            "body": "Si hay menos frutos en una estación, cambian las oportunidades de alimentarse. La edad y el lugar también importan. Imaginá una red de hilos: al mover uno, otros pueden moverse. Por eso estudiamos varias relaciones juntas y no solamente una pareja de especies.",
            "illustration": {
              "title": "Preguntas para descubrir un rol",
              "layout": "sequence",
              "items": [
                {
                  "label": "¿Qué recursos usa?"
                },
                {
                  "label": "¿Con quién se relaciona?"
                },
                {
                  "label": "¿Qué cambia en el ambiente?"
                }
              ]
            }
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "No: una especie puede cumplir varios roles a la vez. Sus relaciones cambian con el lugar, la estación y su etapa de vida."
          }
        ],
        "questions": [
          {
            "id": "eco-role",
            "objectiveId": "eco-role",
            "version": 1,
            "type": "multi",
            "prompt": "¿Qué puede hacer variar el rol de una especie?",
            "options": [
              "La estación",
              "Su etapa de vida",
              "El ambiente",
              "Su nombre científico"
            ],
            "correct": [
              "La estación",
              "Su etapa de vida",
              "El ambiente"
            ],
            "explanation": "El rol surge de interacciones concretas; el nombre no determina la función."
          },
          {
            "id": "rol-no-etiqueta-comprension",
            "objectiveId": "rol-no-etiqueta-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué nos ayuda a conocer el rol del zorzal?",
            "options": [
              "Observar su alimento y sus relaciones",
              "Contar las letras de su nombre científico",
              "Mirar solamente su nombre"
            ],
            "correct": [
              "Observar su alimento y sus relaciones"
            ],
            "explanation": "Observar su alimento y sus relaciones. No: una especie puede cumplir varios roles a la vez. Sus relaciones cambian con el lugar, la estación y su etapa de vida."
          }
        ],
        "sourceCodes": [
          "OPENSTAX-ECO",
          "AZPIROZ-2003"
        ],
        "contentVersion": 2
      },
      {
        "id": "simbiosis",
        "title": "Vivir en asociación",
        "hook": "¿Toda simbiosis beneficia a las dos especies?",
        "blocks": [
          {
            "title": "Vivir muy cerca",
            "body": "Algunas especies mantienen una relación estrecha durante mucho tiempo. A esa asociación la llamamos simbiosis. No quiere decir que sean amigas ni que siempre se ayuden: describe cómo viven relacionadas. Para entenderla, miramos qué le pasa a cada participante."
          },
          {
            "title": "Tres balances posibles",
            "body": "En el mutualismo, las dos especies obtienen un beneficio. En el comensalismo, una se beneficia y en la otra no se observa un efecto importante. En el parasitismo, una obtiene recursos de la otra y la perjudica. Son palabras para resumir lo que observamos.",
            "illustration": {
              "title": "¿Qué le pasa a cada participante?",
              "layout": "compare",
              "items": [
                {
                  "label": "Mutualismo",
                  "caption": "Beneficio / beneficio"
                },
                {
                  "label": "Comensalismo",
                  "caption": "Beneficio / sin efecto importante"
                },
                {
                  "label": "Parasitismo",
                  "caption": "Beneficio / perjuicio"
                }
              ]
            }
          },
          {
            "title": "Un ejemplo para investigar",
            "body": "Pensá en un ave que usa las ramas de un árbol como refugio. El ave obtiene un lugar donde estar. Para llamarlo comensalismo también tendríamos que comprobar que el árbol no recibe un beneficio ni un perjuicio importante. Estar juntos en una foto no alcanza para saberlo."
          },
          {
            "title": "La respuesta está en la relación",
            "body": "El resultado puede variar cuando cambian los recursos o las condiciones del ambiente. Por eso estas palabras no describen intenciones, sino efectos. Primero observamos a los dos participantes; después elegimos la palabra que explica la relación."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "No toda simbiosis beneficia a las dos especies. En el parasitismo una se beneficia y la otra se perjudica; en el mutualismo ambas se benefician."
          }
        ],
        "questions": [
          {
            "id": "eco-symbiosis",
            "objectiveId": "eco-symbiosis",
            "version": 1,
            "type": "classify",
            "prompt": "Relacioná cada resultado con su tipo.",
            "options": [
              "Ambas se benefician",
              "Una se beneficia; la otra casi no cambia",
              "Una se beneficia y la otra se perjudica"
            ],
            "correct": [],
            "explanation": "Mutualismo es +/+; comensalismo +/0; parasitismo +/−.",
            "categories": [
              "Mutualismo",
              "Comensalismo",
              "Parasitismo"
            ],
            "classification": {
              "Ambas se benefician": "Mutualismo",
              "Una se beneficia; la otra casi no cambia": "Comensalismo",
              "Una se beneficia y la otra se perjudica": "Parasitismo"
            }
          },
          {
            "id": "simbiosis-comprension",
            "objectiveId": "simbiosis-comprension",
            "version": 1,
            "type": "single",
            "prompt": "Si una especie obtiene alimento y perjudica a la otra, ¿qué relación es?",
            "options": [
              "Comensalismo",
              "Mutualismo",
              "Parasitismo"
            ],
            "correct": [
              "Parasitismo"
            ],
            "explanation": "Parasitismo. No toda simbiosis beneficia a las dos especies. En el parasitismo una se beneficia y la otra se perjudica; en el mutualismo ambas se benefician."
          }
        ],
        "sourceCodes": [
          "OPENSTAX-ECO"
        ],
        "contentVersion": 2
      },
      {
        "id": "polinizacion-dispersion",
        "title": "Mover polen y semillas",
        "hook": "¿Qué obtiene el animal y qué obtiene la planta?",
        "blocks": [
          {
            "title": "Primero, la flor",
            "body": "El picaflor bronceado se alimenta de néctar y también de pequeños insectos. El néctar es un líquido azucarado de las flores. Cuando un animal visita flores y lleva polen de una a otra, puede ayudar a la planta a formar semillas. Ese transporte se llama polinización.",
            "illustration": {
              "title": "Un visitante de flores",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "H_chrysura",
                  "label": "Picaflor bronceado",
                  "caption": "Hylocharis chrysura"
                }
              ]
            }
          },
          {
            "title": "Después, la semilla",
            "body": "Dispersar semillas es otro viaje. Tras formarse un fruto, un animal puede comerlo y llevar sus semillas a otro lugar. El zorzal común come frutos: para saber si una visita dispersó semillas, hay que comprobar que las semillas llegaron a otro sitio y todavía pueden germinar.",
            "illustration": {
              "title": "Un ave que come frutos",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "T_rufivent",
                  "label": "Zorzal común",
                  "caption": "Turdus rufiventris"
                }
              ]
            }
          },
          {
            "title": "Dos viajes diferentes",
            "body": "En la polinización viaja el polen; en la dispersión viajan las semillas. El animal puede obtener alimento y la planta una oportunidad de reproducirse o crecer en otro lugar. Pero no toda visita logra ese resultado: importa qué se transporta y dónde termina.",
            "illustration": {
              "title": "No confundas los dos viajes",
              "layout": "sequence",
              "items": [
                {
                  "label": "Polen entre flores: polinización"
                },
                {
                  "label": "Semillas hacia otro sitio: dispersión"
                }
              ]
            }
          },
          {
            "title": "Cuidar también los caminos",
            "body": "Para mantener estas relaciones hacen falta flores, plantas que den frutos y lugares donde los animales puedan vivir. Podés observar una visita sin arrancar la flor ni tocar al animal. Contar qué viste es el comienzo; explicar qué ocurrió requiere más pistas."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "El animal puede obtener alimento. La planta puede recibir polen o llevar sus semillas a otro sitio. Polen y semillas hacen viajes distintos."
          }
        ],
        "questions": [
          {
            "id": "eco-pollination",
            "objectiveId": "eco-pollination",
            "version": 1,
            "type": "single",
            "prompt": "¿Cuál observación demuestra mejor dispersión de semillas?",
            "options": [
              "Un ave posa en una rama",
              "Una semilla viable aparece en sus heces lejos de la planta",
              "Un insecto visita una flor"
            ],
            "correct": [
              "Una semilla viable aparece en sus heces lejos de la planta"
            ],
            "explanation": "La evidencia conecta transporte, distancia y viabilidad; una visita sola no demuestra el resultado."
          },
          {
            "id": "polinizacion-dispersion-comprension",
            "objectiveId": "polinizacion-dispersion-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué se mueve en la polinización?",
            "options": [
              "Una semilla ya formada",
              "El polen",
              "El árbol entero"
            ],
            "correct": [
              "El polen"
            ],
            "explanation": "El polen. El animal puede obtener alimento. La planta puede recibir polen o llevar sus semillas a otro sitio. Polen y semillas hacen viajes distintos."
          }
        ],
        "sourceCodes": [
          "OPENSTAX-ECO",
          "AZPIROZ-2003"
        ],
        "contentVersion": 2
      },
      {
        "id": "competencia-depredacion",
        "title": "Conflicto también organiza",
        "hook": "Si un depredador consume una presa, ¿la relación es “mala” para el ecosistema?",
        "blocks": [
          {
            "title": "Alimentarse conecta vidas",
            "body": "Un depredador obtiene alimento al consumir otro animal, llamado presa. Para la presa eso es un perjuicio, pero la depredación también es parte de las redes naturales: la energía del alimento pasa de un ser vivo a otro. No convierte al depredador en un villano."
          },
          {
            "title": "Cuando un recurso no alcanza",
            "body": "Hay competencia si dos organismos necesitan un recurso limitado. Imaginá dos torcazas buscando las mismas semillas en un lugar donde quedan pocas. También puede haber competencia entre especies distintas. Si sobra alimento, compartir un sitio no demuestra por sí solo competencia.",
            "illustration": {
              "title": "Pensá en un recurso limitado",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "Z_auricula",
                  "label": "Torcaza",
                  "caption": "Un ejemplo: pocas semillas para varias aves"
                }
              ]
            }
          },
          {
            "title": "Mirar más que una escena",
            "body": "Una foto o una observación aislada no muestran toda la red. Para explicar un cambio preguntamos quién participa, en qué ambiente y durante cuánto tiempo. La misma relación puede tener consecuencias diferentes si cambia la cantidad de organismos o de alimento."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "Que una presa sea consumida no vuelve “mala” a toda la relación. La depredación es un proceso natural; para entender sus efectos miramos la red y el contexto."
          }
        ],
        "questions": [
          {
            "id": "eco-interactions",
            "objectiveId": "eco-interactions",
            "version": 1,
            "type": "multi",
            "prompt": "¿Qué preguntas hacen falta para evaluar una interacción?",
            "options": [
              "Quiénes participan",
              "En qué ambiente",
              "Durante qué período",
              "Si nos resulta simpática"
            ],
            "correct": [
              "Quiénes participan",
              "En qué ambiente",
              "Durante qué período"
            ],
            "explanation": "La evaluación ecológica necesita contexto y escala, no simpatía humana."
          },
          {
            "id": "competencia-depredacion-comprension",
            "objectiveId": "competencia-depredacion-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Cuándo hay competencia por alimento?",
            "options": [
              "Cuando varios organismos necesitan un alimento que no alcanza",
              "Sólo cuando los animales son grandes",
              "Siempre que dos animales están cerca"
            ],
            "correct": [
              "Cuando varios organismos necesitan un alimento que no alcanza"
            ],
            "explanation": "Cuando varios organismos necesitan un alimento que no alcanza. Que una presa sea consumida no vuelve “mala” a toda la relación. La depredación es un proceso natural; para entender sus efectos miramos la red y el contexto."
          }
        ],
        "sourceCodes": [
          "OPENSTAX-ECO"
        ],
        "contentVersion": 2
      }
    ],
    "illustration": {
      "title": "Distintas maneras de alimentarse",
      "layout": "compare",
      "items": [
        {
          "speciesCode": "H_chrysura",
          "label": "Picaflor bronceado",
          "caption": "Néctar e insectos"
        },
        {
          "speciesCode": "T_rufivent",
          "label": "Zorzal común",
          "caption": "Frutos e insectos"
        }
      ]
    }
  },
  {
    "id": "historias-del-territorio",
    "shortTitle": "Historias",
    "title": "Historias del territorio",
    "icon": "bird",
    "color": "#9A5B00",
    "description": "Cinco especies para entender conservación, cultura y convivencia.",
    "modules": [
      {
        "id": "cardenal-amarillo",
        "title": "Cardenal amarillo",
        "hook": "¿Cómo vuelve una especie a un sitio donde desapareció?",
        "blocks": [
          {
            "title": "Conocé al protagonista",
            "body": "El cardenal amarillo se llama Gubernatrix cristata. Vive en paisajes donde se alternan espacios abiertos, árboles y arbustos. Allí encuentra alimento y sitios para anidar. Su canto y su aspecto llamaron la atención de personas que lo capturaron para venderlo como ave de jaula.",
            "illustration": {
              "title": "Una vida que necesita su ambiente",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "G_cristata",
                  "label": "Cardenal amarillo",
                  "caption": "Gubernatrix cristata"
                }
              ]
            }
          },
          {
            "title": "Qué pasó con sus poblaciones",
            "body": "La captura ilegal quitó aves de la naturaleza y contribuyó a que desaparecieran de algunos sitios. También importa conservar ambientes adecuados. Cuando una población se reduce, encontrar pareja y mantener nuevas generaciones puede volverse más difícil. No alcanza con que nos guste su canto: necesita seguir viviendo libre."
          },
          {
            "title": "Una vuelta documentada en 2024",
            "body": "El 25 y el 26 de noviembre de 2024 se liberaron en Uruguay 14 cardenales amarillos recuperados del tráfico ilegal. Antes recibieron cuidados veterinarios durante cinco meses. Los equipos revisaron su salud y su origen genético, para evitar enfermedades y elegir una población compatible."
          },
          {
            "title": "Elegir un lugar y seguir mirando",
            "body": "La liberación se hizo en sitios con ambiente adecuado y protección frente a capturas. Las aves llevaron anillos para poder seguirlas. Desde ese momento empezó otra etapa: observar si sobreviven, se adaptan y se reproducen. La noticia de una liberación no demuestra por sí sola que una población ya se recuperó.",
            "illustration": {
              "title": "Volver requiere varias etapas",
              "layout": "sequence",
              "items": [
                {
                  "label": "Preparación y salud"
                },
                {
                  "label": "Sitio adecuado y liberación"
                },
                {
                  "label": "Seguimiento"
                }
              ]
            }
          },
          {
            "title": "Lo que podemos aprender",
            "body": "Una reintroducción busca que una especie vuelva a vivir en un lugar del que desapareció. Cuidar el ambiente y evitar nuevas capturas son partes del mismo trabajo. Si observás un ave sensible, compartí el registro por vías responsables con ayuda de una persona adulta; evitá publicar la ubicación exacta de su nido."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "Una especie puede volver mediante una reintroducción preparada por especialistas: cuidados, elección del sitio, liberación y seguimiento. Soltar aves sin preparación no alcanza."
          }
        ],
        "questions": [
          {
            "id": "story-yellow",
            "objectiveId": "story-yellow",
            "version": 1,
            "type": "order",
            "prompt": "Ordená una reintroducción responsable.",
            "options": [
              "Seguimiento",
              "Evaluación y preparación",
              "Liberación"
            ],
            "correct": [
              "Evaluación y preparación",
              "Liberación",
              "Seguimiento"
            ],
            "explanation": "La liberación es sólo una etapa entre la preparación y el monitoreo posterior."
          },
          {
            "id": "cardenal-amarillo-comprension",
            "objectiveId": "cardenal-amarillo-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué falta comprobar después de liberar las aves?",
            "options": [
              "Nada: liberar garantiza la recuperación",
              "Si la foto de la liberación salió linda",
              "Si sobreviven y logran establecerse"
            ],
            "correct": [
              "Si sobreviven y logran establecerse"
            ],
            "explanation": "Si sobreviven y logran establecerse. Una especie puede volver mediante una reintroducción preparada por especialistas: cuidados, elección del sitio, liberación y seguimiento. Soltar aves sin preparación no alcanza."
          },
          {
            "id": "cardenal-amarillo-aplicacion",
            "objectiveId": "cardenal-amarillo-aplicacion",
            "version": 1,
            "type": "single",
            "prompt": "¿Por qué evitamos publicar la ubicación exacta de un nido?",
            "options": [
              "Porque las aves no tienen ubicación",
              "Para no facilitar nuevas capturas",
              "Porque todos los datos son secretos"
            ],
            "correct": [
              "Para no facilitar nuevas capturas"
            ],
            "explanation": "Para no facilitar nuevas capturas. Una especie puede volver mediante una reintroducción preparada por especialistas: cuidados, elección del sitio, liberación y seguimiento. Soltar aves sin preparación no alcanza."
          }
        ],
        "sourceCodes": [
          "UY-CARD-AM"
        ],
        "contentVersion": 2
      },
      {
        "id": "cardenal-copete-rojo",
        "title": "Cardenal de copete rojo",
        "hook": "¿Cómo puede un ave conocida seguir necesitando protección frente a la captura?",
        "blocks": [
          {
            "title": "Un copete fácil de reconocer",
            "body": "El cardenal de copete rojo tiene un nombre científico propio: Paroaria coronata. Su copete ayuda a reconocerlo. La guía de aves de Uruguay de 2003 lo describe como residente durante todo el año, asociado a pastizales con árboles y montes. Ese retrato histórico no es un conteo de aves de hoy.",
            "illustration": {
              "title": "Conocé a Paroaria coronata",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "P_coronata",
                  "label": "Cardenal de copete rojo",
                  "caption": "Paroaria coronata"
                }
              ]
            }
          },
          {
            "title": "La historia de las jaulas",
            "body": "Su aspecto y su canto lo hicieron conocido, pero también lo convirtieron en un ave buscada para tener en jaula. Capturar un animal silvestre lo separa de su ambiente y de otras aves. Una especie puede ser familiar para las personas y aun así sufrir presión de captura."
          },
          {
            "title": "Un problema que sigue documentado",
            "body": "En abril de 2024 el Ministerio de Ambiente informó una incautación de aves silvestres en Lavalleja. Entre las especies recuperadas había cardenales de copete rojo. Ese caso muestra que el tráfico ilegal seguía ocurriendo; no nos dice cuántos cardenales quedan en todo Uruguay."
          },
          {
            "title": "Cómo leer su situación",
            "body": "La Lista Roja de las Aves del Uruguay de 2012 lo evaluó como Preocupación Menor a escala nacional. Es una evaluación con fecha, no una promesa de seguridad para siempre. Además, figura como especie prioritaria para la conservación en Uruguay. La prioridad ayuda a decidir acciones y no equivale a estar En Peligro.",
            "illustration": {
              "title": "Dos preguntas sobre la misma especie",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "P_coronata",
                  "label": "Cardenal de copete rojo",
                  "caption": "Lista Roja nacional, 2012: Preocupación Menor"
                },
                {
                  "label": "Prioritaria en Uruguay",
                  "caption": "Una decisión sobre dónde enfocar acciones"
                }
              ]
            }
          },
          {
            "title": "Una forma de disfrutarlo",
            "body": "Podemos conocerlo mirando sus movimientos y escuchándolo libre, sin acercarnos al nido ni capturarlo. Si ves una venta de aves silvestres, contáselo a una persona adulta para que consulte los canales oficiales. Conocer una especie también puede ayudarnos a reconocer los problemas que enfrenta."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "Ser un ave conocida no la protege de la captura. El tráfico ilegal está documentado, y prioridad de conservación y riesgo de extinción responden preguntas distintas."
          }
        ],
        "questions": [
          {
            "id": "story-red",
            "objectiveId": "story-red",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué afirmación es correcta?",
            "options": [
              "“Prioritaria” siempre significa “En Peligro”",
              "Prioridad y amenaza son evaluaciones distintas",
              "Ser común impide toda protección"
            ],
            "correct": [
              "Prioridad y amenaza son evaluaciones distintas"
            ],
            "explanation": "Una lista de prioridad puede sumar criterios culturales, ecológicos o de gestión distintos del riesgo de extinción."
          },
          {
            "id": "cardenal-copete-rojo-comprension",
            "objectiveId": "cardenal-copete-rojo-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué muestra el caso de Lavalleja de 2024?",
            "options": [
              "Que la captura y el comercio ilegal seguían ocurriendo",
              "Que estaba permitido venderlos",
              "Que todos los cardenales desaparecieron"
            ],
            "correct": [
              "Que la captura y el comercio ilegal seguían ocurriendo"
            ],
            "explanation": "Que la captura y el comercio ilegal seguían ocurriendo. Ser un ave conocida no la protege de la captura. El tráfico ilegal está documentado, y prioridad de conservación y riesgo de extinción responden preguntas distintas."
          },
          {
            "id": "cardenal-copete-rojo-aplicacion",
            "objectiveId": "cardenal-copete-rojo-aplicacion",
            "version": 1,
            "type": "single",
            "prompt": "¿Cómo hay que leer “Preocupación Menor” en esta historia?",
            "options": [
              "Como permiso para capturarlas",
              "Como un conteo de aves de hoy",
              "Como una evaluación nacional de 2012"
            ],
            "correct": [
              "Como una evaluación nacional de 2012"
            ],
            "explanation": "Como una evaluación nacional de 2012. Ser un ave conocida no la protege de la captura. El tráfico ilegal está documentado, y prioridad de conservación y riesgo de extinción responden preguntas distintas."
          }
        ],
        "sourceCodes": [
          "UY-CARD-ROJO",
          "UY-PRIOR",
          "AZPIROZ-2003",
          "UY-TRAFICO-2024",
          "UY-AVES-RL"
        ],
        "contentVersion": 2
      },
      {
        "id": "cotorra",
        "title": "Cotorra",
        "hook": "¿Cómo se convive con una especie nativa que puede causar daño productivo?",
        "blocks": [
          {
            "title": "Una vecina nativa",
            "body": "La cotorra, Myiopsitta monachus, es parte de la fauna nativa de Uruguay: no llegó al país por una introducción humana. Vive en grupos y construye nidos de ramas que pueden tener varias cámaras. Conocer su manera de vivir ayuda a entender por qué algunas colonias se concentran en ciertos sitios.",
            "illustration": {
              "title": "Un ave que vive en grupo",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "M_monachus",
                  "label": "Cotorra",
                  "caption": "Myiopsitta monachus"
                }
              ]
            }
          },
          {
            "title": "El paisaje también cambió",
            "body": "INIA describe cómo, desde mediados del siglo XX, los cambios agrícolas y la disponibilidad de alimento favorecieron aumentos de algunas poblaciones de aves. Los montes plantados también ofrecieron sitios para nidos. Las cotorras respondieron a esos cambios; no apareció una especie nueva."
          },
          {
            "title": "Cuando compartir genera un problema",
            "body": "En algunos sitios las cotorras consumen parte de un cultivo y generan pérdidas. El problema no es igual en todas partes. Para entenderlo hay que medir qué cultivo fue afectado, en qué momento y cuánto daño hubo. Ver muchas aves juntas no responde por sí solo esas preguntas."
          },
          {
            "title": "Investigar otras respuestas",
            "body": "Un proyecto de INIA iniciado en 2025 estudia métodos para reducir la reproducción como complemento a la protección de cultivos. Primero se prueban formulaciones y efectos; después se evalúan otras etapas. Es una investigación, no una solución comprobada para cualquier lugar ni una receta para hacer en casa.",
            "illustration": {
              "title": "Antes de decidir un manejo",
              "layout": "sequence",
              "items": [
                {
                  "label": "Medir el daño"
                },
                {
                  "label": "Evaluar alternativas y efectos"
                },
                {
                  "label": "Comprobar el resultado"
                }
              ]
            }
          },
          {
            "title": "Convivir con información",
            "body": "Cuidar a la fauna y escuchar a quienes producen alimentos pueden formar parte de la misma conversación. Las decisiones deben considerar el daño real, el bienestar animal y otras especies que podrían verse afectadas. Podés observar las colonias a distancia y aprender cómo usan el paisaje."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "Para convivir se mide el daño concreto y se evalúan respuestas y sus efectos. Ser nativa no impide causar daño, y causar daño en un sitio no describe a toda la especie."
          }
        ],
        "questions": [
          {
            "id": "story-parakeet",
            "objectiveId": "story-parakeet",
            "version": 1,
            "type": "multi",
            "prompt": "¿Qué debe medir un plan de manejo?",
            "options": [
              "Daño real",
              "Escala y lugar",
              "Efectos del método",
              "Una opinión aislada"
            ],
            "correct": [
              "Daño real",
              "Escala y lugar",
              "Efectos del método"
            ],
            "explanation": "El manejo se apoya en evidencia del problema y de las consecuencias de intervenir."
          },
          {
            "id": "cotorra-comprension",
            "objectiveId": "cotorra-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Ver muchas cotorras prueba cuánto daño tuvo un cultivo?",
            "options": [
              "Sí: todas dañan todos los cultivos",
              "No: hay que medir el daño",
              "Sí: basta una foto"
            ],
            "correct": [
              "No: hay que medir el daño"
            ],
            "explanation": "No: hay que medir el daño. Para convivir se mide el daño concreto y se evalúan respuestas y sus efectos. Ser nativa no impide causar daño, y causar daño en un sitio no describe a toda la especie."
          },
          {
            "id": "cotorra-aplicacion",
            "objectiveId": "cotorra-aplicacion",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué significa que INIA esté investigando un método?",
            "options": [
              "Que su eficacia y sus efectos deben evaluarse",
              "Que cualquiera debe aplicarlo por su cuenta",
              "Que ya sirve en cualquier situación"
            ],
            "correct": [
              "Que su eficacia y sus efectos deben evaluarse"
            ],
            "explanation": "Que su eficacia y sus efectos deben evaluarse. Para convivir se mide el daño concreto y se evalúan respuestas y sus efectos. Ser nativa no impide causar daño, y causar daño en un sitio no describe a toda la especie."
          }
        ],
        "sourceCodes": [
          "INIA-COTORRA"
        ],
        "contentVersion": 2
      },
      {
        "id": "torcaza",
        "title": "Torcaza: no torcacita",
        "hook": "¿Qué paloma protagoniza los estudios uruguayos sobre daño agrícola?",
        "blocks": [
          {
            "title": "Dos palomas, dos nombres",
            "body": "La torcaza es Zenaida auriculata. La torcacita común es Columbina picui. Sus nombres se parecen, pero son especies diferentes. Mirá ambas fotos y compará la forma del cuerpo y las marcas. Aprender cuál es cuál evita atribuir a una especie lo que se estudió en otra.",
            "illustration": {
              "title": "Torcaza y torcacita: compará sus fotos",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "Z_auricula",
                  "label": "Torcaza",
                  "caption": "Zenaida auriculata"
                },
                {
                  "speciesCode": "C_picui",
                  "label": "Torcacita común",
                  "caption": "Columbina picui"
                }
              ]
            }
          },
          {
            "title": "La protagonista de los estudios",
            "body": "La documentación del MGAP sobre daño agrícola trata de la torcaza. Describe cómo la expansión de cultivos y la combinación de alimento y lugares de descanso favorecieron su aumento. En ciertas concentraciones puede comer semillas de cultivos y provocar pérdidas."
          },
          {
            "title": "Una bandada no cuenta todo",
            "body": "Una bandada grande en un campo muestra una concentración en ese lugar y momento. No dice que haya la misma cantidad en cada rincón del país. Para evaluar el problema, los equipos comparan zonas del cultivo y momentos de crecimiento, en vez de sacar conclusiones a partir de una sola visita."
          },
          {
            "title": "Reducir el daño comprobado",
            "body": "El manejo puede combinar prevención, protección del cultivo y seguimiento. Después hay que volver a medir: ¿se redujeron las pérdidas?, ¿qué otros efectos hubo? Elegir una medida requiere información y las autorizaciones que correspondan. El objetivo es resolver un problema concreto."
          },
          {
            "title": "El nombre correcto cambia la pregunta",
            "body": "Cuando leas una noticia sobre palomas, buscá el nombre de la especie. Luego preguntá dónde ocurrió y qué se midió. Así podés distinguir una historia sobre la torcaza de una sobre la torcacita, y un daño observado de una opinión general."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "La paloma de los estudios citados sobre daño agrícola es la torcaza, Zenaida auriculata. La torcacita común es otra especie."
          }
        ],
        "questions": [
          {
            "id": "story-dove",
            "objectiveId": "story-dove",
            "version": 1,
            "type": "single",
            "prompt": "¿Cuál es la especie asociada al daño agrícola documentado por MGAP?",
            "options": [
              "Torcacita común (Columbina picui)",
              "Torcaza (Zenaida auriculata)"
            ],
            "correct": [
              "Torcaza (Zenaida auriculata)"
            ],
            "explanation": "Son especies distintas. La documentación citada trata sobre Zenaida auriculata."
          },
          {
            "id": "torcaza-comprension",
            "objectiveId": "torcaza-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué demuestra una bandada grande en un campo?",
            "options": [
              "Que todas las palomas son torcazas",
              "La cantidad de aves en todo el país",
              "Una concentración en ese lugar y momento"
            ],
            "correct": [
              "Una concentración en ese lugar y momento"
            ],
            "explanation": "Una concentración en ese lugar y momento. La paloma de los estudios citados sobre daño agrícola es la torcaza, Zenaida auriculata. La torcacita común es otra especie."
          },
          {
            "id": "torcaza-aplicacion",
            "objectiveId": "torcaza-aplicacion",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué conviene hacer después de aplicar una medida de manejo?",
            "options": [
              "Dejar de observar",
              "Volver a medir el daño y otros efectos",
              "Cambiarle el nombre a la especie"
            ],
            "correct": [
              "Volver a medir el daño y otros efectos"
            ],
            "explanation": "Volver a medir el daño y otros efectos. La paloma de los estudios citados sobre daño agrícola es la torcaza, Zenaida auriculata. La torcacita común es otra especie."
          }
        ],
        "sourceCodes": [
          "MGAP-TORCAZA"
        ],
        "contentVersion": 2
      },
      {
        "id": "venado-de-campo",
        "title": "Venado de campo",
        "hook": "¿Por qué una ley de protección no alcanza para recuperar al venado de campo?",
        "blocks": [
          {
            "title": "Una vida entre pastos",
            "body": "El venado de campo, Ozotoceros bezoarticus, es un mamífero nativo ligado a paisajes abiertos. Necesita lugares donde alimentarse, moverse y criar. Mirá la foto: no estamos viendo una estatua ni un símbolo, sino un animal cuya vida depende de un ambiente real.",
            "illustration": {
              "title": "El pastizal es parte de su historia",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "O_bezoarti",
                  "label": "Venado de campo",
                  "caption": "Ozotoceros bezoarticus"
                }
              ]
            }
          },
          {
            "title": "De campos extensos a grupos separados",
            "body": "La caza y los cambios en el uso del suelo contribuyeron a reducir sus poblaciones en Uruguay. La Intendencia de Maldonado describió en 2022 dos poblaciones silvestres principales, en Rocha y Salto. Esa información tiene fecha: no permite inventar un conteo actualizado ni dar por recuperada a la especie."
          },
          {
            "title": "Una protección desde 1985",
            "body": "El Decreto 12/985 declaró Monumento Natural al venado de campo. Esa figura reconoce un valor especial y establece protección. Pero una ley no produce pasto ni conecta lugares separados: para que una población se mantenga también hacen falta condiciones adecuadas para vivir."
          },
          {
            "title": "Trabajo sobre el paisaje y las poblaciones",
            "body": "La conservación incluye cuidar pastizales, evitar capturas y seguir cómo cambian las poblaciones. También requiere acuerdos con quienes viven y trabajan en esos campos. Los programas de cría y los estudios pueden aportar herramientas, pero deben acompañar el cuidado de las poblaciones silvestres.",
            "illustration": {
              "title": "Tres partes del cuidado",
              "layout": "sequence",
              "items": [
                {
                  "label": "Protección legal"
                },
                {
                  "label": "Ambiente donde vivir"
                },
                {
                  "label": "Seguimiento de poblaciones"
                }
              ]
            }
          },
          {
            "title": "Mirar sin invadir",
            "body": "Si tenés la oportunidad de observarlo, hacelo a distancia y con autorización para entrar al lugar. No lo persigas para una foto ni intentes alimentarlo. Conservar su historia significa que futuras generaciones puedan encontrar venados viviendo en el paisaje, además de leer sobre ellos."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "La ley protege al venado, pero su recuperación también necesita pastizales adecuados, cuidado de las poblaciones y seguimiento. La protección legal es una parte del trabajo."
          }
        ],
        "questions": [
          {
            "id": "story-deer",
            "objectiveId": "story-deer",
            "version": 1,
            "type": "multi",
            "prompt": "¿Qué necesita la conservación del venado además de protección legal?",
            "options": [
              "Hábitat adecuado",
              "Conectividad",
              "Seguimiento",
              "Sólo una estatua"
            ],
            "correct": [
              "Hábitat adecuado",
              "Conectividad",
              "Seguimiento"
            ],
            "explanation": "Una declaración es una herramienta; la conservación ocurre sobre poblaciones y paisajes."
          },
          {
            "id": "venado-de-campo-comprension",
            "objectiveId": "venado-de-campo-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué necesita el venado además de una ley?",
            "options": [
              "Un ambiente adecuado para vivir y criar",
              "Que dejemos de observar sus poblaciones",
              "Sólo una placa con su nombre"
            ],
            "correct": [
              "Un ambiente adecuado para vivir y criar"
            ],
            "explanation": "Un ambiente adecuado para vivir y criar. La ley protege al venado, pero su recuperación también necesita pastizales adecuados, cuidado de las poblaciones y seguimiento. La protección legal es una parte del trabajo."
          },
          {
            "id": "venado-de-campo-aplicacion",
            "objectiveId": "venado-de-campo-aplicacion",
            "version": 1,
            "type": "single",
            "prompt": "¿Por qué decimos el año de una descripción de sus poblaciones?",
            "options": [
              "Porque las poblaciones nunca cambian",
              "Porque el año cambia la especie",
              "Para no tratar un dato histórico como un conteo actual"
            ],
            "correct": [
              "Para no tratar un dato histórico como un conteo actual"
            ],
            "explanation": "Para no tratar un dato histórico como un conteo actual. La ley protege al venado, pero su recuperación también necesita pastizales adecuados, cuidado de las poblaciones y seguimiento. La protección legal es una parte del trabajo."
          }
        ],
        "sourceCodes": [
          "UY-VENADO",
          "UY-VENADO-POB"
        ],
        "contentVersion": 2
      }
    ],
    "illustration": {
      "title": "Vidas e historias de Uruguay",
      "layout": "compare",
      "items": [
        {
          "speciesCode": "G_cristata",
          "label": "Cardenal amarillo",
          "caption": "Gubernatrix cristata"
        },
        {
          "speciesCode": "M_monachus",
          "label": "Cotorra",
          "caption": "Myiopsitta monachus"
        },
        {
          "speciesCode": "O_bezoarti",
          "label": "Venado de campo",
          "caption": "Ozotoceros bezoarticus"
        }
      ]
    }
  },
  {
    "id": "caza-y-convivencia",
    "shortTitle": "Caza",
    "title": "Fauna, caza y convivencia",
    "icon": "balance",
    "color": "#7A4B36",
    "description": "Historia, reglas vigentes y decisiones públicas basadas en evidencia.",
    "modules": [
      {
        "id": "regla-general",
        "title": "La regla general",
        "hook": "¿En Uruguay se puede cazar cualquier especie que no figure como amenazada?",
        "blocks": [
          {
            "title": "La fauna tiene protección",
            "body": "En Uruguay, la protección de la fauna es el punto de partida. La Ley 9.481 y otras normas establecen el marco; las excepciones requieren reglas específicas. No se puede decidir que una especie está habilitada para caza sólo porque no aparece como amenazada."
          },
          {
            "title": "Dos preguntas diferentes",
            "body": "Una evaluación de conservación pregunta por el riesgo de desaparición. Una norma pregunta qué está permitido y bajo qué condiciones. El cardenal de copete rojo nos ayuda a recordarlo: una categoría de riesgo no funciona como permiso de captura.",
            "illustration": {
              "title": "Conocer una especie no da permiso para capturarla",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "P_coronata",
                  "label": "Cardenal de copete rojo",
                  "caption": "Paroaria coronata"
                }
              ]
            }
          },
          {
            "title": "Leer la regla completa",
            "body": "Para entender una autorización hacen falta especie, lugar, fecha y condiciones. Las normas pueden cambiar. Este recorrido ayuda a comprender cómo se toman decisiones; ante una situación concreta, una persona adulta debe consultar la información vigente del Ministerio de Ambiente."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "No. Que una especie no esté amenazada no la habilita automáticamente para caza. Conservación y autorización legal son preguntas diferentes."
          }
        ],
        "questions": [
          {
            "id": "hunt-default",
            "objectiveId": "hunt-default",
            "version": 1,
            "type": "single",
            "prompt": "Si una especie no está amenazada, ¿queda automáticamente habilitada para caza?",
            "options": [
              "Sí",
              "No"
            ],
            "correct": [
              "No"
            ],
            "explanation": "Estado de conservación y habilitación legal son sistemas distintos."
          },
          {
            "id": "regla-general-comprension",
            "objectiveId": "regla-general-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Dónde buscamos las condiciones vigentes de una autorización?",
            "options": [
              "En una foto de la especie",
              "En la información oficial y la norma aplicable",
              "En una opinión sin fecha"
            ],
            "correct": [
              "En la información oficial y la norma aplicable"
            ],
            "explanation": "En la información oficial y la norma aplicable. No. Que una especie no esté amenazada no la habilita automáticamente para caza. Conservación y autorización legal son preguntas diferentes."
          }
        ],
        "sourceCodes": [
          "LEY-9481",
          "UY-CAZA"
        ],
        "contentVersion": 2
      },
      {
        "id": "categorias-permisos",
        "title": "Libre, deportiva y control",
        "hook": "¿“Caza libre” significa sin ninguna regla?",
        "blocks": [
          {
            "title": "Una palabra que puede confundir",
            "body": "La información oficial distingue categorías de caza. La deportiva tiene permisos y condiciones, como temporadas y especies habilitadas. “Libre caza” es una categoría administrativa: no significa que cualquier acción, en cualquier lugar, esté permitida."
          },
          {
            "title": "Un ejemplo con fecha",
            "body": "En la información del Ministerio de Ambiente consultada el 11 de octubre de 2026, la cotorra figura entre las especies de libre caza. Aun en esa categoría se mantienen restricciones generales y el respeto a la propiedad ajena. La fecha de consulta importa porque las reglas pueden cambiar.",
            "illustration": {
              "title": "La categoría conserva reglas generales",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "M_monachus",
                  "label": "Cotorra",
                  "caption": "Myiopsitta monachus"
                }
              ]
            }
          },
          {
            "title": "Controlar un daño es otra pregunta",
            "body": "Una intervención para reducir daño necesita un objetivo y una evaluación de sus efectos. No es lo mismo que una actividad recreativa. Antes de decidir se pregunta qué problema existe, qué alternativas hay y qué autorizaciones corresponden.",
            "illustration": {
              "title": "Leé una regla con contexto",
              "layout": "sequence",
              "items": [
                {
                  "label": "Especie y categoría"
                },
                {
                  "label": "Lugar y fecha"
                },
                {
                  "label": "Condiciones aplicables"
                }
              ]
            }
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "“Libre” no significa sin reglas. Es una categoría que conserva restricciones generales; no permite ignorar el lugar, la seguridad o la autorización para entrar a un predio."
          }
        ],
        "questions": [
          {
            "id": "hunt-types",
            "objectiveId": "hunt-types",
            "version": 1,
            "type": "classify",
            "prompt": "Separá cada caso.",
            "options": [
              "Temporada y permiso recreativo",
              "Intervención por daño comprobado",
              "Categoría oficial sin temporada ni cupo"
            ],
            "correct": [],
            "explanation": "Deportiva, control y libre son marcos distintos y cada uno conserva obligaciones generales.",
            "categories": [
              "Deportiva",
              "Control",
              "Libre"
            ],
            "classification": {
              "Temporada y permiso recreativo": "Deportiva",
              "Intervención por daño comprobado": "Control",
              "Categoría oficial sin temporada ni cupo": "Libre"
            }
          },
          {
            "id": "categorias-permisos-comprension",
            "objectiveId": "categorias-permisos-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Una categoría de libre caza permite entrar a cualquier campo?",
            "options": [
              "No: se necesita autorización para entrar",
              "Sólo si el ave es pequeña",
              "Sí: la categoría elimina toda regla"
            ],
            "correct": [
              "No: se necesita autorización para entrar"
            ],
            "explanation": "No: se necesita autorización para entrar. “Libre” no significa sin reglas. Es una categoría que conserva restricciones generales; no permite ignorar el lugar, la seguridad o la autorización para entrar a un predio."
          }
        ],
        "sourceCodes": [
          "UY-CAZA"
        ],
        "contentVersion": 2
      },
      {
        "id": "evidencia-y-cambios",
        "title": "Reglas que cambian con evidencia",
        "hook": "¿Por qué una temporada válida hoy puede suspenderse mañana?",
        "blocks": [
          {
            "title": "Contar a lo largo del tiempo",
            "body": "Ver muchos animales un día no demuestra que una población esté bien. Hay que comparar años, observar reproducción y estudiar los ambientes. Los estudios poblacionales ayudan a decidir qué actividades se pueden sostener y cuándo conviene cambiar una regla."
          },
          {
            "title": "Un ejemplo que tiene fecha",
            "body": "El Decreto 200/026 dispuso suspender desde 2027 la caza deportiva de tres especies de patos: maicero, picazo y cara blanca. La decisión tomó en cuenta estudios que no permitían asegurar que la actividad fuera sostenible. Es un cambio previsto por una norma, no una deducción a partir de una foto.",
            "illustration": {
              "title": "Las tres especies del decreto",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "A_georgica",
                  "label": "Pato maicero",
                  "caption": "Anas georgica"
                },
                {
                  "speciesCode": "N_peposaca",
                  "label": "Pato picazo",
                  "caption": "Netta peposaca"
                },
                {
                  "speciesCode": "D_viduata",
                  "label": "Pato cara blanca",
                  "caption": "Dendrocygna viduata"
                }
              ]
            }
          },
          {
            "title": "La información nueva cambia decisiones",
            "body": "Si aparecen riesgos o faltan datos suficientes para asegurar una actividad, las autoridades pueden ajustar o suspender permisos. Por eso una regla vieja no sirve como permiso actual. Para leer una noticia buscá qué cambió, desde cuándo y a qué especies se refiere.",
            "illustration": {
              "title": "De los datos a una regla",
              "layout": "sequence",
              "items": [
                {
                  "label": "Estudiar poblaciones"
                },
                {
                  "label": "Evaluar riesgos"
                },
                {
                  "label": "Actualizar decisiones"
                }
              ]
            }
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "Una temporada puede suspenderse cuando los estudios muestran riesgos o no permiten asegurar que la actividad sea sostenible. La evidencia y las normas tienen fecha."
          }
        ],
        "questions": [
          {
            "id": "hunt-evidence",
            "objectiveId": "hunt-evidence",
            "version": 1,
            "type": "multi",
            "prompt": "¿Qué vuelve responsable una ficha normativa?",
            "options": [
              "Fecha de vigencia",
              "Enlace oficial",
              "Distinguir categoría y especie",
              "Copiar una regla vieja sin fecha"
            ],
            "correct": [
              "Fecha de vigencia",
              "Enlace oficial",
              "Distinguir categoría y especie"
            ],
            "explanation": "La trazabilidad evita tratar una regla histórica como permiso actual."
          },
          {
            "id": "evidencia-y-cambios-comprension",
            "objectiveId": "evidencia-y-cambios-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Desde cuándo se dispuso la suspensión del ejemplo?",
            "options": [
              "Sólo durante 2012",
              "Desde siempre",
              "Desde 2027"
            ],
            "correct": [
              "Desde 2027"
            ],
            "explanation": "Desde 2027. Una temporada puede suspenderse cuando los estudios muestran riesgos o no permiten asegurar que la actividad sea sostenible. La evidencia y las normas tienen fecha."
          }
        ],
        "sourceCodes": [
          "LEY-9481",
          "DEC-200-026",
          "UY-CAZA"
        ],
        "contentVersion": 2
      },
      {
        "id": "impacto-y-fiscalizacion",
        "title": "Lo permitido no agota la pregunta",
        "hook": "¿Cumplir la norma garantiza que una acción sea ecológicamente neutra?",
        "blocks": [
          {
            "title": "Cumplir una regla y mirar sus efectos",
            "body": "Una acción permitida también puede tener efectos en el ambiente. Importan la cantidad de animales, el lugar y el momento, además de otras especies que podrían verse afectadas. Por eso la legalidad y el impacto se estudian por separado."
          },
          {
            "title": "Un dato que hay que leer bien",
            "body": "El Informe del estado del ambiente 2024 registra un promedio de 115 procedimientos anuales por caza ilegal entre 2012 y 2021. Un procedimiento es una actuación de control: no es lo mismo que un animal, una especie o una condena. El dato describe un período pasado."
          },
          {
            "title": "La protección también se hace cumplir",
            "body": "En 2024 hubo una incautación de aves en Lavalleja que incluyó al cardenal de copete rojo. Estos casos muestran por qué hay controles además de leyes. Una noticia sobre un procedimiento no permite calcular toda la población de una especie.",
            "illustration": {
              "title": "Una especie presente en un caso documentado",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "P_coronata",
                  "label": "Cardenal de copete rojo",
                  "caption": "Paroaria coronata"
                }
              ]
            }
          },
          {
            "title": "Tu seguridad es lo primero",
            "body": "Si ves algo que te preocupa, contáselo a una persona adulta. No te acerques a personas armadas ni intentes intervenir. Una persona adulta puede consultar los canales oficiales. Aprender a interpretar los datos también ayuda a no exagerar ni minimizar un problema."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "No. Cumplir una norma no garantiza ausencia de efectos ecológicos. También hay que evaluar qué cambia en el ambiente y en las poblaciones."
          }
        ],
        "questions": [
          {
            "id": "hunt-impact",
            "objectiveId": "hunt-impact",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué significa “115 procedimientos” en el informe?",
            "options": [
              "115 especies extinguidas",
              "Un promedio anual de actuaciones, no de animales",
              "115 permisos"
            ],
            "correct": [
              "Un promedio anual de actuaciones, no de animales"
            ],
            "explanation": "Un procedimiento es una actuación de control. El dato cuenta actuaciones por año en 2012–2021, no animales ni permisos."
          },
          {
            "id": "impacto-y-fiscalizacion-comprension",
            "objectiveId": "impacto-y-fiscalizacion-comprension",
            "version": 1,
            "type": "single",
            "prompt": "Si ves una situación peligrosa, ¿qué conviene hacer?",
            "options": [
              "Acercarte para discutir",
              "Alejarte y avisarle a una persona adulta",
              "Perseguir a las personas"
            ],
            "correct": [
              "Alejarte y avisarle a una persona adulta"
            ],
            "explanation": "Alejarte y avisarle a una persona adulta. No. Cumplir una norma no garantiza ausencia de efectos ecológicos. También hay que evaluar qué cambia en el ambiente y en las poblaciones."
          }
        ],
        "sourceCodes": [
          "OAN-2024",
          "UY-TRAFICO-2024"
        ],
        "contentVersion": 2
      }
    ],
    "illustration": {
      "title": "Conocer para cuidar y convivir",
      "layout": "compare",
      "items": [
        {
          "speciesCode": "M_monachus",
          "label": "Cotorra",
          "caption": "Myiopsitta monachus"
        },
        {
          "speciesCode": "Z_auricula",
          "label": "Torcaza",
          "caption": "Zenaida auriculata"
        },
        {
          "speciesCode": "P_coronata",
          "label": "Cardenal de copete rojo",
          "caption": "Paroaria coronata"
        }
      ]
    }
  },
  {
    "id": "conservacion",
    "shortTitle": "Conservación",
    "title": "¿Cómo sabemos que una especie está amenazada?",
    "icon": "shield",
    "color": "#9B3F45",
    "description": "Criterios, datos e instituciones detrás de una categoría de riesgo.",
    "modules": [
      {
        "id": "riesgo-no-conteo",
        "title": "Riesgo no es sólo contar",
        "hook": "¿Una especie con miles de individuos puede estar amenazada?",
        "blocks": [
          {
            "title": "Una población es más que una foto",
            "body": "Imaginá una especie con muchos individuos hoy, pero con cada vez menos lugares donde vivir. Si sus poblaciones bajan muy rápido, puede enfrentar riesgo de extinción. Extinguirse significa que no queda ningún individuo de la especie; desaparecer de un país no es necesariamente desaparecer de todo el mundo."
          },
          {
            "title": "Qué miran los equipos",
            "body": "La UICN reúne criterios para evaluar el riesgo. Se estudia si la población disminuye, si ocupa un área pequeña, si quedan pocos individuos y si siguen bajando. También se pueden usar modelos: cálculos que exploran qué podría pasar con la población.",
            "illustration": {
              "title": "Pistas del riesgo",
              "layout": "sequence",
              "items": [
                {
                  "label": "¿Está disminuyendo?"
                },
                {
                  "label": "¿Tiene dónde vivir?"
                },
                {
                  "label": "¿Cuántos individuos quedan?"
                }
              ]
            }
          },
          {
            "title": "Una especie que nos hace pensar",
            "body": "El cardenal amarillo sufrió capturas y desapareció de algunos ambientes originales. Su historia muestra por qué importa investigar las presiones y la distribución, además de contar aves. Ver un ejemplar no borra el problema de toda la población.",
            "illustration": {
              "title": "Encontrar un ave no cuenta toda la historia",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "G_cristata",
                  "label": "Cardenal amarillo",
                  "caption": "Gubernatrix cristata"
                }
              ]
            }
          },
          {
            "title": "Comparar con las mismas reglas",
            "body": "Los criterios tienen límites definidos para poder comparar evaluaciones. Hay que documentar los datos y lo que no se sabe. Pocas fotografías pueden significar que faltan observaciones: no demuestran por sí solas que una especie esté amenazada."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "Sí. Una especie con muchos individuos puede estar amenazada si disminuye rápidamente o enfrenta otros riesgos. Contar hoy es sólo una parte de la evaluación."
          }
        ],
        "questions": [
          {
            "id": "cons-criteria",
            "objectiveId": "cons-criteria",
            "version": 1,
            "type": "multi",
            "prompt": "¿Qué puede elevar el riesgo?",
            "options": [
              "Declive rápido",
              "Distribución muy restringida",
              "Población muy pequeña",
              "Ser poco fotografiada"
            ],
            "correct": [
              "Declive rápido",
              "Distribución muy restringida",
              "Población muy pequeña"
            ],
            "explanation": "Pocas fotos pueden indicar falta de datos, pero no demuestran por sí solas riesgo de extinción."
          },
          {
            "id": "riesgo-no-conteo-comprension",
            "objectiveId": "riesgo-no-conteo-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Ver un ejemplar significa que toda su población está segura?",
            "options": [
              "No: hace falta estudiar la población",
              "Sí, si está en una foto",
              "Sí: uno alcanza"
            ],
            "correct": [
              "No: hace falta estudiar la población"
            ],
            "explanation": "No: hace falta estudiar la población. Sí. Una especie con muchos individuos puede estar amenazada si disminuye rápidamente o enfrenta otros riesgos. Contar hoy es sólo una parte de la evaluación."
          }
        ],
        "sourceCodes": [
          "IUCN-CAT",
          "UY-CARD-AM"
        ],
        "contentVersion": 2
      },
      {
        "id": "categorias",
        "title": "De Preocupación Menor a Extinta",
        "hook": "¿“Datos Insuficientes” significa que no hay riesgo?",
        "blocks": [
          {
            "title": "Palabras para resumir un riesgo",
            "body": "Preocupación Menor indica que la evaluación no encontró criterios para una categoría de mayor riesgo. Casi Amenazada significa que está cerca de esos límites. Vulnerable, En Peligro y En Peligro Crítico son las tres categorías llamadas “amenazadas”. Ninguna etiqueta es un permiso para descuidar una especie."
          },
          {
            "title": "Un camino de riesgo creciente",
            "body": "Extinta en Estado Silvestre significa que sólo quedan individuos en condiciones como el cautiverio, fuera de su ambiente natural. Extinta significa que no queda ningún individuo. No es una escalera que todas las especies deban recorrer: las poblaciones pueden mejorar o empeorar.",
            "illustration": {
              "title": "Las tres categorías amenazadas",
              "layout": "sequence",
              "items": [
                {
                  "label": "Vulnerable"
                },
                {
                  "label": "En Peligro"
                },
                {
                  "label": "En Peligro Crítico"
                }
              ]
            }
          },
          {
            "title": "Cuando todavía no sabemos",
            "body": "Datos Insuficientes significa que la información no permite estimar el riesgo. No Evaluada indica que aún no se aplicó esa evaluación. Son situaciones diferentes, y ninguna quiere decir “está segura”. Reconocer lo que falta saber ayuda a decidir qué investigar."
          },
          {
            "title": "Siempre con fecha y lugar",
            "body": "El cardenal de copete rojo fue evaluado como Preocupación Menor en la Lista Roja nacional de 2012. Esa etiqueta habla de esa evaluación. No reemplaza nuevas observaciones ni elimina la necesidad de cuidarlo.",
            "illustration": {
              "title": "Una categoría tiene contexto",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "P_coronata",
                  "label": "Cardenal de copete rojo",
                  "caption": "Lista Roja de las Aves del Uruguay, 2012"
                }
              ]
            }
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "No: Datos Insuficientes significa que falta información para estimar el riesgo. No es una garantía de seguridad."
          }
        ],
        "questions": [
          {
            "id": "cons-category",
            "objectiveId": "cons-category",
            "version": 1,
            "type": "classify",
            "prompt": "Clasificá las categorías.",
            "options": [
              "Vulnerable",
              "En Peligro",
              "Casi Amenazada",
              "Datos Insuficientes"
            ],
            "correct": [],
            "explanation": "Vulnerable y En Peligro son amenazadas; Casi Amenazada no lo es formalmente; Datos Insuficientes no permite decidir.",
            "categories": [
              "Amenazada",
              "No amenazada",
              "Sin conclusión"
            ],
            "classification": {
              "Vulnerable": "Amenazada",
              "En Peligro": "Amenazada",
              "Casi Amenazada": "No amenazada",
              "Datos Insuficientes": "Sin conclusión"
            }
          },
          {
            "id": "categorias-comprension",
            "objectiveId": "categorias-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué significa No Evaluada?",
            "options": [
              "Que no necesita cuidados",
              "Que la especie está extinta",
              "Que aún no se aplicó esa evaluación"
            ],
            "correct": [
              "Que aún no se aplicó esa evaluación"
            ],
            "explanation": "Que aún no se aplicó esa evaluación. No: Datos Insuficientes significa que falta información para estimar el riesgo. No es una garantía de seguridad."
          }
        ],
        "sourceCodes": [
          "IUCN-CAT",
          "UY-AVES-RL"
        ],
        "contentVersion": 2
      },
      {
        "id": "proceso",
        "title": "De datos a decisión",
        "hook": "¿Quién “declara” amenazada a una especie?",
        "blocks": [
          {
            "title": "Primero se reúnen las pistas",
            "body": "Para evaluar una especie, especialistas juntan registros, estudios de poblaciones y datos del ambiente. También anotan qué falta saber. Una impresión, como “yo vi muchas”, puede ser el comienzo de una pregunta, pero no alcanza para asignar una categoría."
          },
          {
            "title": "Después se revisa la explicación",
            "body": "Los equipos aplican criterios al conjunto de datos y otras personas revisan el trabajo. Finalmente, la institución responsable de la lista publica la evaluación. Así podemos consultar cómo se llegó al resultado, en vez de aceptar una etiqueta sin explicación.",
            "illustration": {
              "title": "Una evaluación paso a paso",
              "layout": "sequence",
              "items": [
                {
                  "label": "Reunir evidencia"
                },
                {
                  "label": "Aplicar criterios"
                },
                {
                  "label": "Revisar"
                },
                {
                  "label": "Publicar"
                }
              ]
            }
          },
          {
            "title": "El mapa cambia la pregunta",
            "body": "Una evaluación global considera la especie en todo el mundo. Una nacional mira lo que ocurre dentro de un país y aplica el enfoque regional correspondiente. Una especie puede tener poblaciones grandes fuera de Uruguay y pocas aquí. Son escalas distintas, no dos respuestas a la misma pregunta."
          },
          {
            "title": "Leer la etiqueta completa",
            "body": "Para entender un resultado buscamos la categoría, el sistema, el lugar y la fecha. “En Peligro — Lista Roja nacional, 2012” cuenta más que “En Peligro” sin contexto. El año indica cuándo se hizo la evaluación: no asegura que las poblaciones sigan iguales."
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "La categoría surge del trabajo de especialistas que reúnen datos, aplican criterios y revisan la evaluación. La institución responsable de la lista la publica."
          }
        ],
        "questions": [
          {
            "id": "cons-process",
            "objectiveId": "cons-process",
            "version": 1,
            "type": "order",
            "prompt": "Ordená un proceso de evaluación.",
            "options": [
              "Publicar categoría",
              "Aplicar criterios",
              "Reunir evidencia",
              "Revisión"
            ],
            "correct": [
              "Reunir evidencia",
              "Aplicar criterios",
              "Revisión",
              "Publicar categoría"
            ],
            "explanation": "La categoría surge después de documentar evidencia, aplicar criterios y revisar."
          },
          {
            "id": "proceso-comprension",
            "objectiveId": "proceso-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Por qué una evaluación global puede diferir de una nacional?",
            "options": [
              "Porque una especie cambia de nombre en la frontera",
              "Porque miran poblaciones en escalas diferentes",
              "Porque ninguna usa datos"
            ],
            "correct": [
              "Porque miran poblaciones en escalas diferentes"
            ],
            "explanation": "Porque miran poblaciones en escalas diferentes. La categoría surge del trabajo de especialistas que reúnen datos, aplican criterios y revisan la evaluación. La institución responsable de la lista la publica."
          }
        ],
        "sourceCodes": [
          "IUCN-ASSESS",
          "UY-AVES-RL"
        ],
        "contentVersion": 2
      },
      {
        "id": "amenaza-prioridad-ley",
        "title": "Tres etiquetas, tres preguntas",
        "hook": "¿Amenazada, prioritaria y protegida quieren decir lo mismo?",
        "blocks": [
          {
            "title": "Riesgo: ¿puede desaparecer?",
            "body": "Una categoría de amenaza resume un riesgo de extinción según una evaluación. Necesita un sistema, un área y una fecha. Responde qué tan comprometida está la especie según esos datos, no qué actividad humana está permitida."
          },
          {
            "title": "Prioridad: ¿dónde ponemos esfuerzo?",
            "body": "Una lista de prioridad ayuda a orientar acciones de conservación. Puede considerar el riesgo, pero también otras razones para actuar. El cardenal de copete rojo figura como prioritario en Uruguay: eso no permite deducir que su categoría sea En Peligro.",
            "illustration": {
              "title": "Prioridad no es otra forma de decir amenaza",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "P_coronata",
                  "label": "Cardenal de copete rojo",
                  "caption": "Paroaria coronata"
                }
              ]
            }
          },
          {
            "title": "Ley: ¿qué se protege y cómo?",
            "body": "Una norma establece obligaciones y prohibiciones. El venado de campo tiene la protección de Monumento Natural desde 1985. Esa figura legal responde a una decisión de protección, y no reemplaza los estudios de sus poblaciones.",
            "illustration": {
              "title": "Una figura de protección legal",
              "layout": "compare",
              "items": [
                {
                  "speciesCode": "O_bezoarti",
                  "label": "Venado de campo",
                  "caption": "Ozotoceros bezoarticus"
                }
              ]
            }
          },
          {
            "title": "Tres preguntas que se complementan",
            "body": "Pensá en tres carteles diferentes: riesgo, prioridad y protección legal. Podemos leerlos juntos, pero cada uno aporta una información distinta. Arapy los separa para que puedas saber qué cuenta cada etiqueta.",
            "illustration": {
              "title": "Leé cada cartel con su pregunta",
              "layout": "compare",
              "items": [
                {
                  "label": "Amenaza",
                  "caption": "¿Qué riesgo de extinción hay?"
                },
                {
                  "label": "Prioridad",
                  "caption": "¿Dónde enfocar acciones?"
                },
                {
                  "label": "Protección legal",
                  "caption": "¿Qué exige la norma?"
                }
              ]
            }
          },
          {
            "title": "Volvamos a la pregunta inicial",
            "body": "No son sinónimos. Amenaza habla de riesgo, prioridad orienta acciones y protección legal establece obligaciones o prohibiciones."
          }
        ],
        "questions": [
          {
            "id": "cons-labels",
            "objectiveId": "cons-labels",
            "version": 1,
            "type": "classify",
            "prompt": "¿Qué pregunta responde cada etiqueta?",
            "options": [
              "Riesgo de extinción",
              "Dónde enfocar acciones",
              "Qué permite o prohíbe la norma"
            ],
            "correct": [],
            "explanation": "Amenaza, prioridad y protección legal son capas relacionadas pero distintas.",
            "categories": [
              "Amenaza",
              "Prioridad",
              "Protección legal"
            ],
            "classification": {
              "Riesgo de extinción": "Amenaza",
              "Dónde enfocar acciones": "Prioridad",
              "Qué permite o prohíbe la norma": "Protección legal"
            }
          },
          {
            "id": "amenaza-prioridad-ley-comprension",
            "objectiveId": "amenaza-prioridad-ley-comprension",
            "version": 1,
            "type": "single",
            "prompt": "¿Qué etiqueta responde qué exige una norma?",
            "options": [
              "Protección legal",
              "Amenaza",
              "Prioridad"
            ],
            "correct": [
              "Protección legal"
            ],
            "explanation": "Protección legal. No son sinónimos. Amenaza habla de riesgo, prioridad orienta acciones y protección legal establece obligaciones o prohibiciones."
          }
        ],
        "sourceCodes": [
          "IUCN-CAT",
          "UY-PRIOR",
          "LEY-9481",
          "UY-VENADO"
        ],
        "contentVersion": 2
      }
    ],
    "illustration": {
      "title": "El riesgo, la prioridad y la protección",
      "layout": "compare",
      "items": [
        {
          "speciesCode": "G_cristata",
          "label": "Cardenal amarillo",
          "caption": "Gubernatrix cristata"
        },
        {
          "speciesCode": "P_coronata",
          "label": "Cardenal de copete rojo",
          "caption": "Paroaria coronata"
        },
        {
          "speciesCode": "O_bezoarti",
          "label": "Venado de campo",
          "caption": "Ozotoceros bezoarticus"
        }
      ]
    }
  }
];

export const learningPathById = (id: string) => LEARNING_PATHS.find((path) => path.id === id);
export const learningModuleById = (pathId: string, moduleId: string) => learningPathById(pathId)?.modules.find((module) => module.id === moduleId);
export const learningSourceByCode = (code: string) => LEARNING_SOURCES.find((source) => source.code === code);
