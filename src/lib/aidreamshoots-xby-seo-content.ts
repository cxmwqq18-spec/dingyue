import { aidreamshootsFunctionalAlt } from "./aidreamshoots-functional-alt";

export type AidreamshootsXbyThemeContent = {
  label: string;
  title: string;
  description: string;
  keywords: string;
  h2: string;
  h3: string[];
  intro: string;
  details: string[];
  useCases: string[];
  workflow: string[];
  internalLinks: Array<{ label: string; href: string }>;
  ctaLabel: string;
  ctaHref: string;
  faqItems: Array<[string, string]>;
  altSubject: string;
};

const brand = "AIdreamshoots";

const sceneLabels = [
  "paseo urbano tranquilo",
  "brisa costera",
  "picnic botánico",
  "restaurante retro",
  "librería luminosa",
  "andén de tren",
  "estudio de cerámica",
  "azotea lluviosa",
  "cola del cine",
  "cabaña de montaña",
  "feria nocturna",
  "galería de esculturas",
  "carta envuelta entre las manos"
] as const;

function faqItems(label: string, answer: string): Array<[string, string]> {
  const topic = label.toLowerCase();
  return [
    [`¿Qué puedes crear con ${label}?`, answer],
    [`¿Qué fotos funcionan mejor para preparar ${label}?`, `Usa fotos nítidas, bien iluminadas y propias o autorizadas para ${topic}. Conviene mostrar el sujeto principal desde varios ángulos y evitar capturas pequeñas, filtros intensos y personas sin consentimiento.`],
    [`¿Cuántas imágenes incluye el paquete ${label}?`, `El paquete de ${topic} muestra la cantidad de imágenes y el coste en créditos antes de empezar. Revisa ambos datos junto con sus ejemplos visuales para confirmar que encajan con tu objetivo.`],
    [`¿Cómo reviso una galería de ${label} antes de descargar?`, `Las imágenes terminadas de ${topic} aparecen en tu galería privada para revisar encuadres, detalles y coherencia visual antes de descargar o compartir tus favoritas.`],
    [`¿Qué ocurre si falla una generación de ${label}?`, `Si una solicitud de ${topic} se interrumpe antes de entregar los resultados, el estado del trabajo determina la liberación o devolución de los créditos reservados. Conserva la referencia si necesitas soporte.`]
  ];
}

function content(input: Omit<AidreamshootsXbyThemeContent, "title" | "description" | "keywords" | "ctaHref" | "faqItems"> & { seoTerm: string; faqAnswer: string }): AidreamshootsXbyThemeContent {
  const titleTerm = input.label === "Contenido para creadores adultos"
    ? "Fotos para creadores adultos"
    : input.label === "Día de la Conciencia de la Soltería"
      ? "Fotos de soltería"
      : input.label;
  const titleCandidate = `${titleTerm} con IA para fotos | ${brand}`;
  const title = titleCandidate.length <= 60 ? titleCandidate : `${titleTerm} con IA | ${brand}`;
  const longDescription = `Crea ${input.seoTerm} con IA a partir de fotos propias: explora escenas, revisa créditos y guarda una galería privada lista para descargar en ${brand}.`;
  const description = longDescription.length <= 160
    ? longDescription
    : `Crea ${input.seoTerm} con IA a partir de fotos propias: compara escenas, revisa créditos y guarda tus resultados en ${brand}.`;
  return {
    ...input,
    title,
    description,
    keywords: `${input.seoTerm} con IA, fotos ${input.label.toLowerCase()}, paquete de fotos IA, ${brand}`,
    ctaHref: "/app/create",
    faqItems: faqItems(input.label, input.faqAnswer)
  };
}

const themes: Record<string, AidreamshootsXbyThemeContent> = {
  avatar: content({
    label: "Avatar profesional",
    seoTerm: "avatares profesionales",
    h2: "Avatares profesionales con identidad visual",
    h3: ["Retrato de perfil", "Escenarios con personalidad", "Entrega lista para usar"],
    intro: "Este paquete convierte tus fotos autorizadas en avatares profesionales con más variedad que un retrato de estudio único. Combina encuadres de perfil, ambientes urbanos, interiores creativos y escenas de viaje para que puedas elegir una imagen que encaje con tu presencia digital. Las muestras mantienen el rostro como punto de atención, pero cambian la energía, la luz y el contexto para evitar una galería repetitiva.",
    details: ["Elige fotos nítidas donde el rostro se vea con naturalidad y sin filtros que oculten sus rasgos.", "Compara una dirección sobria para perfiles profesionales con otra más expresiva para redes y proyectos creativos.", "Revisa cada avatar en tu galería privada antes de descargar la versión que mejor representa tu identidad."],
    useCases: ["Perfiles profesionales", "Redes sociales", "Presentaciones de creador", "Fotos de autor"],
    workflow: ["Sube varias fotos autorizadas.", "Compara los ejemplos del avatar.", "Confirma créditos y cantidad de resultados.", "Revisa y descarga tus favoritos."],
    internalLinks: [{ label: "Retratos profesionales", href: "/collections/headshot" }, { label: "Retratos para redes", href: "/collections/social-cards" }, { label: "Cyberpunk", href: "/collections/cyberpunk" }],
    ctaLabel: "Crear avatares profesionales",
    altSubject: "avatar profesional de una persona adulta",
    faqAnswer: "Crea avatares profesionales con diferentes encuadres, entornos y niveles de expresión para perfiles, redes sociales y presentaciones de creador."
  }),
  bikini: content({
    label: "Bikini editorial",
    seoTerm: "fotos editoriales de bikini",
    h2: "Fotos de bikini con estilo editorial",
    h3: ["Moda de resort", "Escenas costeras", "Composición elegante"],
    intro: "Bikini editorial propone imágenes de moda para resort, playa y piscina con una dirección visual adulta, cuidada y no explícita. Las escenas alternan costa, arquitectura, textiles, sombra y luz abierta para que la galería tenga cambios reales de ambiente. El foco está en el estilismo, la postura y la composición, de modo que puedas elegir resultados aptos para moodboards, perfiles de marca personal o recuerdos de viaje.",
    details: ["Usa fotos de referencia donde la persona adulta aparezca con claridad y autorice el uso de su imagen.", "Combina colores, accesorios y fondos de resort sin añadir logotipos o marcas que no estén presentes en la foto fuente.", "Revisa cobertura, postura y encuadre antes de descargar imágenes para un uso público."],
    useCases: ["Moodboards de beachwear", "Perfiles de resort", "Contenido de viaje", "Editorial de moda"],
    workflow: ["Selecciona fotos propias de la persona adulta.", "Define una atmósfera de playa o resort.", "Comprueba créditos y cantidad de imágenes.", "Elige las composiciones más elegantes."],
    internalLinks: [{ label: "Boudoir editorial", href: "/collections/boudoir" }, { label: "Estilo de vida premium", href: "/collections/rich-lifestyle" }, { label: "Viajes y destinos", href: "/collections/estilo-y-fantasia" }],
    ctaLabel: "Crear fotos editoriales de bikini",
    altSubject: "foto editorial de bikini con una persona adulta",
    faqAnswer: "Crea fotografías editoriales de bikini para resort, playa y piscina, con composiciones adultas, elegantes y centradas en el estilismo."
  }),
  "magic-eraser": content({
    label: "Borrador mágico",
    seoTerm: "fotos con borrador mágico",
    h2: "Borrador mágico para limpiar tus fotos",
    h3: ["Distracciones eliminadas", "Fondos reconstruidos", "Retoque natural"],
    intro: "Borrador mágico muestra cómo una fotografía puede recuperar claridad cuando desaparecen pequeños objetos, personas pasajeras o elementos que distraen. El paquete recorre plazas, interiores, mercados y escenas de viaje para demostrar variaciones de textura y luz, no una sola plantilla. Úsalo como referencia visual para evaluar si la eliminación conserva la arquitectura, el suelo, las sombras y la continuidad de la escena.",
    details: ["Sube fotos donde el elemento que deseas corregir esté bien separado del sujeto principal.", "Evita pedir la eliminación de partes importantes del cuerpo, texto esencial o detalles cuya reconstrucción no pueda comprobarse.", "Revisa bordes, reflejos y sombras en la galería antes de guardar el resultado."],
    useCases: ["Eliminar objetos pequeños", "Limpiar fondos", "Corregir fotos de viaje", "Preparar imágenes sociales"],
    workflow: ["Elige una foto con una distracción clara.", "Indica la zona que necesita limpieza.", "Revisa el resultado y sus bordes.", "Descarga solo las versiones coherentes."],
    internalLinks: [{ label: "Cambiador de fondo", href: "/collections/background-changer" }, { label: "Eliminador de fondo", href: "/collections/background-remover" }, { label: "Mejorador de fotos", href: "/collections/photo-enhancer" }],
    ctaLabel: "Probar el borrador mágico",
    altSubject: "foto retocada con borrador mágico que elimina una distracción",
    faqAnswer: "Crea variaciones de fotos con objetos pequeños o distracciones eliminados y fondos reconstruidos de forma natural."
  }),
  boudoir: content({
    label: "Boudoir editorial",
    seoTerm: "retratos boudoir editoriales",
    h2: "Retratos boudoir con luz suave",
    h3: ["Intimidad elegante", "Luz de interior", "Poses naturales"],
    intro: "Boudoir editorial está pensado para retratos adultos, elegantes y consensuados, con una estética de hotel, dormitorio y ventana de luz suave. La variedad procede de las poses, los textiles, la distancia de cámara y el ambiente, no de una repetición de la misma escena. Es una forma de explorar una sesión privada con dirección editorial sin convertir la imagen en contenido explícito ni depender de una única plantilla visual.",
    details: ["Usa únicamente fotos de personas adultas que hayan autorizado el uso y el estilo de la sesión.", "Prioriza referencias claras de rostro, cabello y silueta para que las poses mantengan una apariencia natural.", "Revisa cada imagen para confirmar cobertura, manos, rostro y ambiente antes de compartirla."],
    useCases: ["Sesiones privadas adultas", "Editorial de lencería", "Retratos de confianza", "Moodboards de moda"],
    workflow: ["Carga referencias autorizadas.", "Elige una dirección íntima y elegante.", "Confirma la cantidad y el coste.", "Revisa cobertura y naturalidad."],
    internalLinks: [{ label: "Bikini editorial", href: "/collections/bikini" }, { label: "Estilo de vida premium", href: "/collections/rich-lifestyle" }, { label: "Fotos de gala", href: "/collections/gala-photo" }],
    ctaLabel: "Crear retratos boudoir",
    altSubject: "retrato boudoir editorial de una persona adulta con luz suave",
    faqAnswer: "Crea retratos boudoir editoriales para personas adultas, con poses naturales, textiles elegantes y luz suave de interior."
  }),
  "background-changer": content({
    label: "Cambiador de fondo",
    seoTerm: "fotos con cambio de fondo",
    h2: "Cambiador de fondo para nuevas escenas",
    h3: ["Escenarios alternativos", "Luz integrada", "Sujeto protagonista"],
    intro: "Cambiador de fondo enseña cómo un mismo sujeto puede aparecer en ambientes distintos sin perder una integración fotográfica creíble. Las muestras alternan ciudad, costa, interiores y espacios creativos, con atención a la dirección de luz, la escala y la profundidad. Sirve para valorar ideas de retrato, contenido de creador y pruebas visuales cuando el fondo original no representa el contexto que necesitas.",
    details: ["Elige fotos con un contorno visible y una iluminación suficientemente clara para separar el sujeto.", "Compara fondos exteriores e interiores y revisa que la luz coincida con la nueva escena.", "Comprueba cabello, manos, bordes y sombras antes de usar la imagen en público."],
    useCases: ["Retratos para redes", "Pruebas de localización", "Contenido de creador", "Fotos de perfil"],
    workflow: ["Sube una foto fuente clara.", "Define el ambiente de destino.", "Comprueba créditos y ejemplos.", "Revisa integración y descarga."],
    internalLinks: [{ label: "Eliminador de fondo", href: "/collections/background-remover" }, { label: "Editar con instrucciones", href: "/collections/edit-by-prompt" }, { label: "Enfocar imagen", href: "/collections/unblur-image" }],
    ctaLabel: "Cambiar el fondo de una foto",
    altSubject: "retrato con fondo editorial cambiado e iluminación integrada",
    faqAnswer: "Crea retratos con fondos alternativos de ciudad, costa, interior o estudio, manteniendo al sujeto como protagonista de la composición."
  }),
  cannes: content({
    label: "Cannes",
    seoTerm: "retratos de Cannes",
    h2: "Retratos de Cannes con ambiente de festival",
    h3: ["Llegada de alfombra roja", "Luz de estreno", "Glamur cinematográfico"],
    intro: "Cannes reúne retratos de festival con entradas nocturnas, flashes, terrazas y una energía cinematográfica reconocible sin afirmar vínculos con un evento oficial. La galería mezcla retratos individuales, parejas y grupos para que el ambiente tenga amplitud y no se reduzca a la misma pose. Es útil para explorar una imagen de estreno, una portada editorial o un recuerdo de viaje con un acabado de gala.",
    details: ["Usa fotos autorizadas donde el rostro y la ropa se vean con suficiente detalle.", "Elige entre una llegada formal, un ambiente de terraza o una escena urbana con luces de festival.", "Revisa rostros, manos, reflejos y cualquier texto de fondo antes de compartir."],
    useCases: ["Retratos de estreno", "Portadas editoriales", "Viajes con glamour", "Fotos de gala"],
    workflow: ["Selecciona referencias nítidas.", "Escoge un ambiente cinematográfico.", "Revisa coste y cantidad.", "Descarga las poses más naturales."],
    internalLinks: [{ label: "Fotos de gala", href: "/collections/gala-photo" }, { label: "Noir cinematográfico", href: "/collections/mafia" }, { label: "Vida nocturna", href: "/collections/nightlife" }],
    ctaLabel: "Crear retratos de Cannes",
    altSubject: "retrato de festival con ambiente cinematográfico de Cannes",
    faqAnswer: "Crea retratos con ambiente de festival, flashes, llegadas de gala y una estética cinematográfica inspirada en Cannes."
  }),
  "color-correction": content({
    label: "Corrección de color",
    seoTerm: "fotos con corrección de color",
    h2: "Corrección de color para una imagen más equilibrada",
    h3: ["Tonos naturales", "Contraste controlado", "Acabado coherente"],
    intro: "Corrección de color presenta variaciones de una misma intención fotográfica con ajustes de temperatura, contraste, saturación y ambiente. Las escenas cambian entre interiores, exteriores y luz nocturna para que puedas valorar cómo responde cada imagen a una dirección cromática. No busca imponer un filtro único: ayuda a comparar un acabado más cálido, uno editorial o una corrección limpia antes de elegir qué versión conservar.",
    details: ["Trabaja con fotos fuente donde el sujeto y la iluminación original sean visibles.", "Compara tonos de piel, cielos, sombras y superficies neutras para detectar cambios artificiales.", "Elige el acabado que mantenga el detalle y la intención de la escena, no solo el color más intenso."],
    useCases: ["Unificar una galería", "Corregir dominantes", "Preparar redes sociales", "Pruebas editoriales"],
    workflow: ["Sube una imagen con buena exposición.", "Compara varias direcciones cromáticas.", "Revisa pieles y sombras.", "Conserva la versión más natural."],
    internalLinks: [{ label: "Mejorador de fotos", href: "/collections/photo-enhancer" }, { label: "Enfocar imagen", href: "/collections/unblur-image" }, { label: "Retoque de retrato", href: "/collections/portrait-retouch" }],
    ctaLabel: "Corregir el color de una foto",
    altSubject: "foto con corrección de color y tonos naturales equilibrados",
    faqAnswer: "Crea versiones con color más equilibrado, contraste controlado y tonos naturales para comparar distintos acabados fotográficos."
  }),
  cyberpunk: content({
    label: "Cyberpunk",
    seoTerm: "retratos cyberpunk",
    h2: "Retratos cyberpunk con neón y ciudad",
    h3: ["Neón urbano", "Atmósfera futurista", "Personaje protagonista"],
    intro: "Cyberpunk transforma retratos autorizados en escenas urbanas de neón, lluvia, metal y arquitectura futurista. Cada ejemplo cambia la paleta, la distancia y la relación entre personaje y ciudad para que la galería tenga auténtica variedad. El objetivo es crear una dirección de personaje reconocible para perfiles, portadas y proyectos creativos sin copiar marcas, personajes protegidos ni logotipos de franquicias.",
    details: ["Usa fotos donde el rostro y la silueta permitan conservar una identidad visual clara.", "Combina neón frío, reflejos húmedos y fondos industriales para comparar diferentes intensidades.", "Revisa texto, símbolos y elementos de marca que puedan aparecer accidentalmente en el fondo."],
    useCases: ["Avatares creativos", "Portadas de música", "Concept art personal", "Perfiles gaming"],
    workflow: ["Elige fotos de referencia autorizadas.", "Define una paleta futurista.", "Comprueba el coste del paquete.", "Revisa rostro, manos y fondos."],
    internalLinks: [{ label: "Noir cinematográfico", href: "/collections/mafia" }, { label: "Avatar profesional", href: "/collections/avatar" }, { label: "Vida nocturna", href: "/collections/nightlife" }],
    ctaLabel: "Crear retratos cyberpunk",
    altSubject: "retrato cyberpunk de una persona adulta bajo luces de neón",
    faqAnswer: "Crea retratos cyberpunk con neón, lluvia, arquitectura futurista y atmósferas urbanas para perfiles y proyectos creativos."
  }),
  "edit-by-prompt": content({
    label: "Edición por instrucciones",
    seoTerm: "ediciones de fotos por instrucciones",
    h2: "Edita fotos con instrucciones precisas",
    h3: ["Cambios dirigidos", "Escena transformada", "Resultado revisable"],
    intro: "Edición por instrucciones reúne ejemplos de cambios dirigidos: modificar un ambiente, añadir un accesorio sin marca, cambiar una paleta o convertir un interior en una escena editorial. La variedad demuestra que una instrucción clara puede producir resultados distintos según el contexto, en lugar de aplicar el mismo ajuste a todas las fotos. Es la opción adecuada para explorar transformaciones concretas antes de conservar una versión.",
    details: ["Describe un cambio concreto y separa el sujeto, el ambiente y los elementos que deben permanecer intactos.", "Evita pedir logotipos, personas públicas o modificaciones que cambien una identidad sin autorización.", "Revisa la imagen final comparando rostro, manos, proporciones y coherencia del entorno."],
    useCases: ["Cambios de ambiente", "Accesorios sin marca", "Pruebas de dirección artística", "Ediciones para creador"],
    workflow: ["Sube una foto autorizada.", "Escribe una instrucción específica.", "Revisa la transformación.", "Guarda la versión coherente."],
    internalLinks: [{ label: "Cambiador de fondo", href: "/collections/background-changer" }, { label: "Borrador mágico", href: "/collections/magic-eraser" }, { label: "Corrección de color", href: "/collections/color-correction" }],
    ctaLabel: "Editar una foto por instrucciones",
    altSubject: "foto editada por instrucciones con una transformación visual concreta",
    faqAnswer: "Crea ediciones dirigidas a partir de instrucciones claras, como cambios de ambiente, color, accesorios o estilo editorial."
  }),
  "background-remover": content({
    label: "Eliminador de fondo",
    seoTerm: "fotos con fondo eliminado",
    h2: "Eliminador de fondo para sujetos más claros",
    h3: ["Recorte limpio", "Sujeto aislado", "Uso flexible"],
    intro: "Eliminador de fondo está orientado a aislar personas y objetos de una escena para preparar composiciones más limpias. Las muestras recorren retratos, objetos, interiores y situaciones cotidianas, mostrando que el recorte debe respetar cabello, manos, bordes y transparencias. No se trata solo de quitar el fondo: también hay que comprobar que la imagen resultante tenga una silueta natural y pueda reutilizarse en otra pieza.",
    details: ["Elige fotos con buena separación entre el sujeto y el fondo original.", "Comprueba los bordes finos, el cabello y las sombras antes de colocar el recorte sobre un nuevo diseño.", "Usa fondos propios o autorizados cuando combines el sujeto con otra composición."],
    useCases: ["Fotos de producto", "Composiciones sociales", "Retratos recortados", "Material para diseño"],
    workflow: ["Selecciona una foto con bordes visibles.", "Aísla el sujeto principal.", "Revisa el recorte en detalle.", "Úsalo en una composición autorizada."],
    internalLinks: [{ label: "Cambiador de fondo", href: "/collections/background-changer" }, { label: "Borrador mágico", href: "/collections/magic-eraser" }, { label: "Tarjetas para redes", href: "/collections/social-cards" }],
    ctaLabel: "Eliminar el fondo de una foto",
    altSubject: "foto con fondo eliminado y sujeto aislado con bordes limpios",
    faqAnswer: "Crea imágenes con personas u objetos aislados del fondo, conservando una silueta limpia para nuevas composiciones."
  }),
  "unblur-image": content({
    label: "Enfoque de imagen",
    seoTerm: "fotos desenfocadas mejoradas",
    h2: "Enfoca imágenes suaves sin perder naturalidad",
    h3: ["Detalle recuperado", "Textura equilibrada", "Nitidez revisable"],
    intro: "Enfoque de imagen ayuda a evaluar cómo una foto suave puede recuperar definición en rostros, ropa, arquitectura y objetos. Las escenas varían para que puedas distinguir una mejora útil de un exceso de nitidez o textura artificial. El paquete resulta especialmente práctico para rescatar fotos móviles, recuerdos de viaje y retratos que necesitan una base más clara antes de pasar a otro estilo visual.",
    details: ["Comienza con una imagen desenfocada pero suficientemente grande para conservar información real.", "Observa ojos, cabello, bordes y superficies para detectar halos o detalles inventados.", "Compara la versión enfocada con la original antes de usarla en otra generación."],
    useCases: ["Fotos móviles suaves", "Recuerdos de viaje", "Retratos antiguos recientes", "Preparación para edición"],
    workflow: ["Sube una foto con falta de nitidez.", "Compara la mejora de detalle.", "Revisa halos y textura.", "Conserva la versión más realista."],
    internalLinks: [{ label: "Mejorador de fotos", href: "/collections/photo-enhancer" }, { label: "Restauración de fotos antiguas", href: "/collections/old-photo-restoration" }, { label: "Corrección de color", href: "/collections/color-correction" }],
    ctaLabel: "Enfocar una imagen",
    altSubject: "foto mejorada con enfoque y detalle natural en el sujeto",
    faqAnswer: "Crea versiones más nítidas de fotos suaves, cuidando el detalle del rostro, los bordes y las texturas sin exagerar el enfoque."
  }),
  holiday: content({
    label: "Fiestas y celebraciones",
    seoTerm: "fotos de fiestas",
    h2: "Fotos de fiestas con energía y color",
    h3: ["Reuniones espontáneas", "Decoración festiva", "Recuerdos compartibles"],
    intro: "Fiestas y celebraciones reúne escenas de reuniones, luces, mesas y momentos espontáneos para crear una galería que se sienta viva. Hay espacio para retratos individuales, parejas y grupos, con cambios de decoración y hora del día que evitan que todas las imágenes parezcan tomadas en el mismo lugar. Es una dirección versátil para cumpleaños, reuniones de amigos y celebraciones personales.",
    details: ["Usa fotos de las personas que participan y confirma que todas tienen permiso para aparecer.", "Elige una atmósfera de interior, terraza o noche iluminada según el tipo de celebración.", "Revisa manos, copas, decoración y expresiones antes de compartir el álbum."],
    useCases: ["Cumpleaños", "Reuniones con amigos", "Álbumes de celebración", "Contenido social"],
    workflow: ["Selecciona fotos claras del grupo.", "Elige la energía de la fiesta.", "Revisa cantidad y créditos.", "Descarga los recuerdos favoritos."],
    internalLinks: [{ label: "Vida nocturna", href: "/collections/nightlife" }, { label: "Halloween", href: "/collections/halloween-photo" }, { label: "Fotos de Navidad", href: "/collections/christmas-photo" }],
    ctaLabel: "Crear fotos de fiestas",
    altSubject: "foto de fiesta con adultos, luces cálidas y ambiente de celebración",
    faqAnswer: "Crea fotos de fiestas con grupos, decoración, luces y momentos espontáneos para cumpleaños, reuniones y celebraciones."
  }),
  "halloween-photo": content({
    label: "Halloween",
    seoTerm: "fotos de Halloween",
    h2: "Fotos de Halloween con disfraces y ambiente nocturno",
    h3: ["Disfraces originales", "Luces de temporada", "Escenas de grupo"],
    intro: "Halloween combina disfraces originales, calabazas, velas y luces de fiesta en escenas de grupo e imágenes individuales. La galería cambia entre interior, jardín, fiesta y retrato cercano para que el resultado tenga variedad de composición además de color naranja y violeta. Puedes usarlo para invitaciones personales, publicaciones de temporada o recuerdos de una celebración sin copiar personajes protegidos.",
    details: ["Usa fotos propias o autorizadas de adultos y menores con el permiso correspondiente.", "Prefiere disfraces originales y evita logotipos, personajes registrados o símbolos que puedan confundirse con una marca.", "Revisa la iluminación del rostro, las manos y los accesorios antes de descargar."],
    useCases: ["Fiestas de disfraces", "Invitaciones de Halloween", "Retratos de temporada", "Álbumes de grupo"],
    workflow: ["Sube fotos autorizadas.", "Elige una atmósfera de Halloween.", "Comprueba el paquete antes de crear.", "Revisa disfraces y detalles."],
    internalLinks: [{ label: "Fiestas y celebraciones", href: "/collections/holiday" }, { label: "Fotos de Navidad", href: "/collections/christmas-photo" }, { label: "Vida nocturna", href: "/collections/nightlife" }],
    ctaLabel: "Crear fotos de Halloween",
    altSubject: "foto de Halloween con disfraz, calabazas y luces nocturnas",
    faqAnswer: "Crea fotos de Halloween con disfraces originales, calabazas, velas y ambientes nocturnos para retratos o grupos."
  }),
  "photo-enhancer": content({
    label: "Mejorador de fotos",
    seoTerm: "fotos mejoradas con IA",
    h2: "Mejorador de fotos para resultados más claros",
    h3: ["Detalle equilibrado", "Luz más limpia", "Base lista para crear"],
    intro: "Mejorador de fotos sirve para preparar imágenes antes de una generación o una descarga. Sus ejemplos muestran mejoras de luz, detalle, contraste y limpieza en retratos, objetos y escenas cotidianas, sin convertir cada resultado en una imagen artificialmente pulida. La variedad ayuda a comprobar si el rostro, la textura y el ambiente conservan una apariencia realista después de la mejora.",
    details: ["Sube una imagen original con la mayor resolución disponible.", "Compara detalle facial, textura de piel, sombras y elementos pequeños para evitar un retoque excesivo.", "Usa la versión mejorada como fuente solo después de comprobar que no introduce artefactos."],
    useCases: ["Mejorar retratos", "Preparar fotos fuente", "Limpiar imágenes sociales", "Recuperar detalle"],
    workflow: ["Elige la fuente de mejor calidad.", "Genera una versión mejorada.", "Compara con el original.", "Continúa solo si el detalle es natural."],
    internalLinks: [{ label: "Enfocar imagen", href: "/collections/unblur-image" }, { label: "Corrección de color", href: "/collections/color-correction" }, { label: "Retoque de retrato", href: "/collections/portrait-retouch" }],
    ctaLabel: "Mejorar una foto",
    altSubject: "foto mejorada con luz equilibrada y detalle natural",
    faqAnswer: "Crea versiones más claras de retratos, objetos y escenas, equilibrando luz, contraste y detalle sin perder realismo."
  }),
  mafia: content({
    label: "Noir cinematográfico",
    seoTerm: "retratos noir cinematográficos",
    h2: "Retratos noir con luz dramática",
    h3: ["Sombras cinematográficas", "Ciudad nocturna", "Personaje editorial"],
    intro: "Noir cinematográfico propone retratos de personaje con sombras marcadas, calles nocturnas, interiores oscuros y una atmósfera de película. La galería se mueve entre diferentes distancias, expresiones y fuentes de luz para construir tensión sin repetir la misma pose. Es una opción para portadas, perfiles creativos y conceptos visuales originales que necesitan carácter, contraste y una narrativa más intensa.",
    details: ["Usa fotos donde el rostro conserve suficientes detalles para trabajar con sombras profundas.", "Compara una dirección de detective urbano, retrato editorial y escena de interior con luz lateral.", "Evita nombres, logotipos o referencias a personajes y franquicias protegidas."],
    useCases: ["Portadas creativas", "Retratos de personaje", "Proyectos audiovisuales", "Perfiles nocturnos"],
    workflow: ["Carga referencias autorizadas.", "Elige el nivel de contraste.", "Revisa luces, sombras y manos.", "Descarga la versión con mejor narrativa."],
    internalLinks: [{ label: "Cyberpunk", href: "/collections/cyberpunk" }, { label: "Cannes", href: "/collections/cannes" }, { label: "Vida nocturna", href: "/collections/nightlife" }],
    ctaLabel: "Crear retratos noir",
    altSubject: "retrato noir cinematográfico con sombras dramáticas y luz urbana",
    faqAnswer: "Crea retratos noir cinematográficos con sombras profundas, luz lateral y ambientes urbanos nocturnos para conceptos originales."
  }),
  "virtual-try-on": content({
    label: "Probador virtual",
    seoTerm: "pruebas virtuales de estilo",
    h2: "Probador virtual para explorar nuevos looks",
    h3: ["Prendas y accesorios", "Comparación de estilos", "Vista natural"],
    intro: "Probador virtual permite explorar prendas, accesorios y combinaciones de estilo a partir de una foto propia. Las muestras cambian entre ropa casual, moda editorial, resort y ocasiones formales para que puedas comparar siluetas y colores. El resultado es una referencia visual, no una garantía de talla o ajuste físico; conviene revisar proporciones, manos, cabello y pliegues antes de tomar una decisión.",
    details: ["Elige una foto frontal o de tres cuartos con el cuerpo y la ropa visibles.", "Describe el tipo de prenda, material y color sin pedir marcas o logotipos no autorizados.", "Compara varias propuestas y verifica que el resultado mantenga proporciones naturales."],
    useCases: ["Ideas de vestuario", "Moodboards de moda", "Looks de viaje", "Pruebas de accesorios"],
    workflow: ["Sube una foto propia.", "Define la prenda o el look.", "Compara las variaciones.", "Usa el resultado como referencia visual."],
    internalLinks: [{ label: "Estilo de vida premium", href: "/collections/rich-lifestyle" }, { label: "Bikini editorial", href: "/collections/bikini" }, { label: "Fotos de gala", href: "/collections/gala-photo" }],
    ctaLabel: "Probar un nuevo look",
    altSubject: "persona adulta probando virtualmente un nuevo look de moda",
    faqAnswer: "Crea referencias visuales de prendas, accesorios y combinaciones de estilo para comparar looks antes de elegir una dirección."
  }),
  "old-photo-restoration": content({
    label: "Restauración de fotos antiguas",
    seoTerm: "restauración de fotos antiguas",
    h2: "Restaura fotos antiguas con cuidado",
    h3: ["Daño reducido", "Detalle recuperado", "Memoria conservada"],
    intro: "Restauración de fotos antiguas ayuda a explorar mejoras en fotografías con ruido, desgaste, bajo contraste o pequeñas marcas. Las escenas muestran retratos familiares, interiores y recuerdos cotidianos para que puedas evaluar el equilibrio entre recuperar detalle y conservar el carácter de la imagen original. No inventa una historia nueva: su objetivo es ofrecer una versión más legible de una memoria que ya existe.",
    details: ["Escanea o fotografía el original con la mayor nitidez y luz uniforme posible.", "Compara piel, cabello, ropa y fondo para detectar detalles que puedan haber sido interpretados de forma incorrecta.", "Conserva el original y utiliza la versión restaurada como una copia revisada."],
    useCases: ["Álbumes familiares", "Retratos heredados", "Recuerdos impresos", "Copias digitales"],
    workflow: ["Prepara una fuente legible.", "Solicita la restauración.", "Compara con el original.", "Guarda ambas versiones."],
    internalLinks: [{ label: "Mejorador de fotos", href: "/collections/photo-enhancer" }, { label: "Enfocar imagen", href: "/collections/unblur-image" }, { label: "Retoque de retrato", href: "/collections/portrait-retouch" }],
    ctaLabel: "Restaurar una foto antigua",
    altSubject: "foto antigua restaurada con detalle recuperado y tonos suaves",
    faqAnswer: "Crea versiones más legibles de fotos antiguas con menos ruido, mejor contraste y detalle recuperado sin sustituir el original."
  }),
  "portrait-retouch": content({
    label: "Retoque de retrato",
    seoTerm: "retratos retocados con IA",
    h2: "Retoque de retrato con acabado natural",
    h3: ["Piel realista", "Rasgos preservados", "Acabado editorial"],
    intro: "Retoque de retrato reúne mejoras sutiles para piel, luz, cabello y pequeños detalles sin borrar la identidad de la persona. Las muestras alternan primeros planos, retratos ambientales y escenas sociales para que puedas juzgar el resultado en más de un encuadre. La prioridad es mantener expresión, textura y proporciones naturales, evitando el aspecto plástico que aparece cuando el retoque se aplica con la misma intensidad a todas las fotos.",
    details: ["Usa retratos con buena luz y permiso de la persona que aparece.", "Busca una corrección que mantenga textura de piel, rasgos, edad y expresión.", "Revisa ojos, dientes, cabello y manos antes de publicar el resultado."],
    useCases: ["Fotos de perfil", "Retratos de creador", "Contenido profesional", "Editorial personal"],
    workflow: ["Selecciona una foto nítida.", "Elige un acabado sutil.", "Compara antes y después.", "Descarga solo el resultado natural."],
    internalLinks: [{ label: "Retratos profesionales", href: "/collections/headshot" }, { label: "Mejorador de fotos", href: "/collections/photo-enhancer" }, { label: "Avatar profesional", href: "/collections/avatar" }],
    ctaLabel: "Retocar un retrato",
    altSubject: "retrato retocado con piel natural y rasgos preservados",
    faqAnswer: "Crea retratos con mejoras sutiles de luz, piel y detalle, manteniendo la expresión y los rasgos de la persona."
  }),
  "valentines-photo": content({
    label: "Fotos de San Valentín",
    seoTerm: "fotos de San Valentín",
    h2: "Fotos de San Valentín para recuerdos de pareja",
    h3: ["Gestos de pareja", "Detalles románticos", "Escenas cálidas"],
    intro: "Fotos de San Valentín crea recuerdos de pareja con flores, regalos, cenas, paseos y luz cálida. La variedad incluye momentos íntimos y escenas abiertas para que el álbum no quede limitado a una sola pose romántica. Puedes explorar una estética de cita en casa, paseo urbano o atardecer, siempre con personas adultas autorizadas y sin convertir el resultado en una promesa de relación o evento real.",
    details: ["Sube fotos claras de ambas personas y confirma su permiso para crear el recuerdo.", "Elige entre una cena, un ramo, un paseo o un gesto espontáneo según vuestra historia.", "Revisa rostros, manos y objetos antes de descargar la imagen final."],
    useCases: ["Regalos de pareja", "Tarjetas románticas", "Álbumes personales", "Publicaciones de temporada"],
    workflow: ["Elige fotos de la pareja.", "Selecciona una escena romántica.", "Confirma cantidad y créditos.", "Revisa y descarga tus favoritos."],
    internalLinks: [{ label: "Fotos de compromiso", href: "/collections/engagement-photo" }, { label: "Fotos de boda", href: "/collections/wedding-photo" }, { label: "Fotos de Navidad", href: "/collections/christmas-photo" }],
    ctaLabel: "Crear fotos de San Valentín",
    altSubject: "pareja adulta compartiendo un recuerdo romántico de San Valentín",
    faqAnswer: "Crea fotos de pareja con flores, regalos, cenas y escenas cálidas para recuerdos y publicaciones de San Valentín."
  }),
  "social-cards": content({
    label: "Tarjetas para redes",
    seoTerm: "imágenes para tarjetas de redes sociales",
    h2: "Tarjetas visuales para redes sociales",
    h3: ["Composición con espacio", "Mensajes visuales", "Formatos compartibles"],
    intro: "Tarjetas para redes combina retratos, productos, escenas de creador y composiciones con espacio negativo para que puedas adaptarlas a publicaciones sociales. La galería cambia el sujeto y la distribución visual: algunas imágenes dejan aire para texto, otras centran un producto o muestran una persona en contexto. Así puedes elegir una base que funcione con tu mensaje sin añadir texto ilegible ni marcas inventadas.",
    details: ["Define si necesitas una imagen con sujeto lateral, espacio superior o composición centrada.", "Usa únicamente productos, logotipos y personas con permiso para aparecer en el diseño.", "Revisa el área libre, el contraste y el recorte en el formato donde publicarás."],
    useCases: ["Posts sociales", "Portadas de creador", "Tarjetas promocionales", "Moodboards de contenido"],
    workflow: ["Elige el canal y el formato.", "Sube referencias autorizadas.", "Compara el espacio de composición.", "Descarga la base más útil."],
    internalLinks: [{ label: "Avatar profesional", href: "/collections/avatar" }, { label: "Editar con instrucciones", href: "/collections/edit-by-prompt" }, { label: "Estilo urbano", href: "/collections/urban" }],
    ctaLabel: "Crear tarjetas para redes",
    altSubject: "composición visual para tarjeta de redes sociales con espacio para diseño",
    faqAnswer: "Crea imágenes para redes con retratos, productos y espacio negativo pensado para posts, portadas y tarjetas promocionales."
  }),
  "thanksgiving-photo": content({
    label: "Fotos de Acción de Gracias",
    seoTerm: "fotos de Acción de Gracias",
    h2: "Fotos de Acción de Gracias para álbumes familiares",
    h3: ["Mesa compartida", "Retratos familiares", "Ambiente acogedor"],
    intro: "Fotos de Acción de Gracias reúne escenas familiares alrededor de una mesa, una cocina, una reunión de amigos o un paseo de otoño. La dirección cambia entre detalles de comida, retratos de grupo y momentos espontáneos para que el álbum tenga ritmo y no repita una única composición. Es una forma de crear recuerdos de temporada a partir de fotos autorizadas, manteniendo una atmósfera cálida y personal.",
    details: ["Usa fotos de todas las personas que autorizan su aparición en el álbum.", "Elige una reunión íntima, una mesa abundante o una escena exterior de otoño.", "Comprueba rostros, manos y elementos de comida antes de compartir el resultado."],
    useCases: ["Álbumes familiares", "Tarjetas de temporada", "Reuniones de amigos", "Recuerdos de otoño"],
    workflow: ["Selecciona fotos del grupo.", "Define el ambiente de Acción de Gracias.", "Revisa el coste antes de crear.", "Elige las escenas más naturales."],
    internalLinks: [{ label: "Fiestas y celebraciones", href: "/collections/holiday" }, { label: "Fotos de Navidad", href: "/collections/christmas-photo" }, { label: "Fotos de boda", href: "/collections/wedding-photo" }],
    ctaLabel: "Crear fotos de Acción de Gracias",
    altSubject: "familia o grupo de adultos compartiendo una mesa de Acción de Gracias",
    faqAnswer: "Crea fotos de Acción de Gracias con mesas compartidas, retratos familiares y ambientes acogedores de otoño."
  }),
  swimsuit: content({
    label: "Bañador",
    seoTerm: "fotos editoriales de bañador",
    h2: "Fotos de bañador para looks de verano",
    h3: ["Estilo de resort", "Luz de verano", "Poses naturales"],
    intro: "Bañador propone una dirección veraniega para explorar looks de resort, piscina y costa con personas adultas. Las muestras alternan arquitectura, agua, arena y textiles para que el resultado no parezca una secuencia de la misma sesión. El foco está en la ropa, el entorno y la composición editorial, con cobertura elegante y sin afirmar que una imagen representa un producto real o una talla concreta.",
    details: ["Sube fotos de una persona adulta con permiso para usar su imagen.", "Describe colores, cobertura y ambiente sin introducir marcas que no formen parte de la referencia.", "Revisa proporciones, manos y ajuste visual antes de publicar cualquier imagen."],
    useCases: ["Looks de verano", "Moodboards de resort", "Contenido de viaje", "Editorial de moda"],
    workflow: ["Elige una foto de referencia.", "Selecciona costa, piscina o resort.", "Compara variaciones.", "Conserva las composiciones naturales."],
    internalLinks: [{ label: "Bikini editorial", href: "/collections/bikini" }, { label: "Probador virtual", href: "/collections/virtual-try-on" }, { label: "Viajes y destinos", href: "/collections/estilo-y-fantasia" }],
    ctaLabel: "Crear fotos de bañador",
    altSubject: "persona adulta con bañador en una escena luminosa de resort",
    faqAnswer: "Crea fotos editoriales de bañador en ambientes de costa, piscina y resort, con una dirección veraniega adulta y natural."
  }),
  "wedding-photo": content({
    label: "Fotos de boda",
    seoTerm: "fotos de boda",
    h2: "Fotos de boda para recuerdos de pareja",
    h3: ["Retratos de ceremonia", "Detalles de celebración", "Momentos compartidos"],
    intro: "Fotos de boda reúne retratos de pareja, detalles florales, mesas, vestidos y escenas de celebración con una dirección romántica y editorial. El paquete alterna momentos formales y espontáneos para que puedas construir una galería con diferentes distancias y emociones. Úsalo como concepto visual o recuerdo personal, sin presentar una imagen generada como prueba de una ceremonia real ni añadir símbolos o marcas no autorizadas.",
    details: ["Carga fotos claras de la pareja y confirma el permiso de ambas personas.", "Elige una atmósfera de ceremonia, recepción, jardín o retrato íntimo.", "Revisa manos, anillos, flores, rostros y detalles del vestido antes de descargar."],
    useCases: ["Recuerdos de pareja", "Tarjetas de boda", "Moodboards de ceremonia", "Álbumes personales"],
    workflow: ["Selecciona referencias de la pareja.", "Define la atmósfera de boda.", "Revisa imágenes y créditos.", "Conserva los resultados coherentes."],
    internalLinks: [{ label: "Fotos de compromiso", href: "/collections/engagement-photo" }, { label: "Fotos de San Valentín", href: "/collections/valentines-photo" }, { label: "Fotos de gala", href: "/collections/gala-photo" }],
    ctaLabel: "Crear fotos de boda",
    altSubject: "pareja adulta en un retrato editorial de boda con detalles de celebración",
    faqAnswer: "Crea fotos de boda con retratos de pareja, flores, mesas y ambientes de ceremonia para recuerdos y moodboards."
  }),
  "street-style": content({
    label: "Estilo callejero",
    seoTerm: "fotos de estilo callejero",
    h2: "Estilo callejero con actitud urbana",
    h3: ["Moda cotidiana", "Arquitectura urbana", "Movimiento natural"],
    intro: "Estilo callejero explora moda cotidiana, arquitectura urbana, escaparates, pasos de peatones y luz natural para crear retratos con actitud. Las escenas cambian entre una caminata tranquila, una esquina con color, un interior de café y una noche de ciudad. Es una propuesta flexible para creadores y perfiles sociales que necesitan imágenes menos posadas, con ropa, gesto y entorno trabajando juntos.",
    details: ["Usa fotos donde se vean rostro, ropa y postura para conservar una silueta creíble.", "Elige una dirección de moda minimalista, deportiva o editorial sin copiar marcas visibles.", "Comprueba el fondo y los textos urbanos antes de compartir la imagen."],
    useCases: ["Moda urbana", "Perfiles de creador", "Campañas personales", "Contenido social"],
    workflow: ["Carga fotos autorizadas.", "Elige una ruta urbana.", "Compara encuadres y ropa.", "Descarga las poses más naturales."],
    internalLinks: [{ label: "Urbano", href: "/collections/urban" }, { label: "Cyberpunk", href: "/collections/cyberpunk" }, { label: "Vida nocturna", href: "/collections/nightlife" }],
    ctaLabel: "Crear fotos de estilo callejero",
    altSubject: "retrato de estilo callejero con moda urbana y arquitectura de ciudad",
    faqAnswer: "Crea fotos de estilo callejero con moda cotidiana, arquitectura urbana, movimiento natural y diferentes horas de luz."
  }),
  "engagement-photo": content({
    label: "Fotos de compromiso",
    seoTerm: "fotos de compromiso",
    h2: "Fotos de compromiso para una historia de pareja",
    h3: ["Gestos espontáneos", "Escenas de propuesta", "Recuerdos elegantes"],
    intro: "Fotos de compromiso crea una serie de pareja con paseos, flores, cenas, paisajes y gestos espontáneos. La variedad permite comparar una escena íntima con otra más abierta, desde una terraza urbana hasta un atardecer junto al agua. Está pensada para recuerdos personales, invitaciones y moodboards, siempre con personas adultas autorizadas y sin confundir una imagen generada con una fotografía documental de una propuesta real.",
    details: ["Sube fotos claras de ambas personas y confirma su permiso para crear el álbum.", "Elige una dirección de paseo, cena, propuesta o retrato de viaje.", "Revisa rostros, manos, anillos y flores antes de descargar una imagen para compartir."],
    useCases: ["Anuncios de compromiso", "Retratos de pareja", "Tarjetas personales", "Álbumes románticos"],
    workflow: ["Selecciona fotos de la pareja.", "Elige la historia visual.", "Confirma cantidad y créditos.", "Revisa y descarga tus favoritos."],
    internalLinks: [{ label: "Fotos de boda", href: "/collections/wedding-photo" }, { label: "Fotos de San Valentín", href: "/collections/valentines-photo" }, { label: "Viajes y destinos", href: "/collections/estilo-y-fantasia" }],
    ctaLabel: "Crear fotos de compromiso",
    altSubject: "pareja adulta compartiendo un retrato de compromiso en una escena romántica",
    faqAnswer: "Crea fotos de compromiso con retratos de pareja, flores, cenas y paisajes para anuncios, tarjetas y álbumes personales."
  }),
  soccer: content({
    label: "Fútbol",
    seoTerm: "fotos de fútbol",
    h2: "Fotos de fútbol para recuerdos de afición",
    h3: ["Ambiente de estadio", "Día de partido", "Retratos de aficionado"],
    intro: "Fútbol reúne retratos de afición, reuniones para ver un partido, bufandas, luces de estadio y energía de competición sin usar escudos o marcas oficiales no autorizadas. Las escenas cambian entre grupo, retrato individual y ambiente de grada para que la galería tenga un ritmo más amplio. Es útil para publicaciones personales, recuerdos de torneo y conceptos de creador relacionados con el deporte.",
    details: ["Usa fotos propias o autorizadas de las personas que aparecerán en la escena.", "Describe colores y ambiente de afición sin pedir logotipos oficiales o una relación con un club.", "Revisa camisetas, textos, manos y rostros antes de compartir."],
    useCases: ["Recuerdos de partido", "Fotos de afición", "Contenido deportivo", "Retratos de grupo"],
    workflow: ["Selecciona fotos del aficionado o grupo.", "Define la energía del partido.", "Revisa créditos y resultados.", "Elige las escenas más creíbles."],
    internalLinks: [{ label: "Fiestas y celebraciones", href: "/collections/holiday" }, { label: "Estilo callejero", href: "/collections/street-style" }, { label: "Urbano", href: "/collections/urban" }],
    ctaLabel: "Crear fotos de fútbol",
    altSubject: "aficionado adulto de fútbol en un ambiente de estadio y día de partido",
    faqAnswer: "Crea fotos de fútbol con ambiente de estadio, reuniones de afición y retratos de partido sin añadir marcas oficiales no autorizadas."
  }),
  "gala-photo": content({
    label: "Fotos de gala",
    seoTerm: "fotos de gala",
    h2: "Fotos de gala con acabado de alfombra roja",
    h3: ["Vestuario formal", "Luz de evento", "Retrato de estreno"],
    intro: "Fotos de gala transforma referencias autorizadas en retratos formales con vestidos, trajes, flashes, escaleras y espacios de recepción. La serie alterna llegadas, posados y momentos sociales para evitar una fila de retratos idénticos. Es una dirección útil para perfiles profesionales, portadas y celebraciones personales, con un acabado elegante que se puede revisar antes de decidir qué imágenes descargar.",
    details: ["Sube fotos donde la expresión, el vestuario y la postura se distingan bien.", "Elige una gala de interior, llegada nocturna o retrato editorial con fondo limpio.", "Revisa reflejos, joyería, manos y cualquier señal de marca antes de publicar."],
    useCases: ["Retratos formales", "Eventos personales", "Portadas editoriales", "Perfiles profesionales"],
    workflow: ["Selecciona fotos nítidas.", "Define la atmósfera de gala.", "Compara las variaciones.", "Descarga las más naturales."],
    internalLinks: [{ label: "Cannes", href: "/collections/cannes" }, { label: "Noir cinematográfico", href: "/collections/mafia" }, { label: "Retratos profesionales", href: "/collections/headshot" }],
    ctaLabel: "Crear fotos de gala",
    altSubject: "retrato formal de gala con vestuario elegante y luz de evento",
    faqAnswer: "Crea fotos de gala con vestuario formal, flashes, espacios de recepción y retratos de estilo alfombra roja."
  }),
  "motion-generator": content({
    label: "Generador de movimiento",
    seoTerm: "imágenes con sensación de movimiento",
    h2: "Generador de movimiento para escenas dinámicas",
    h3: ["Acción congelada", "Gestos expresivos", "Ritmo visual"],
    intro: "Generador de movimiento presenta imágenes que transmiten desplazamiento, viento, baile y acción sin depender de una pose estática. Las escenas recorren calle, costa, deporte y espacios interiores para que puedas comparar cómo cambia el movimiento con la luz y la distancia de cámara. Es una base visual para perfiles, portadas o conceptos de vídeo, siempre revisando manos, cabello y proporciones antes de usarla.",
    details: ["Usa fotos donde la postura y el rostro sean legibles, aunque el gesto sea dinámico.", "Define si quieres una caminata, giro, baile o acción deportiva sin pedir movimientos imposibles.", "Revisa extremidades, cabello y objetos en movimiento antes de descargar."],
    useCases: ["Portadas dinámicas", "Conceptos de vídeo", "Contenido deportivo", "Perfiles expresivos"],
    workflow: ["Elige una foto de referencia.", "Define el gesto o la acción.", "Revisa las variaciones.", "Conserva el movimiento creíble."],
    internalLinks: [{ label: "Editar con instrucciones", href: "/collections/edit-by-prompt" }, { label: "Estilo callejero", href: "/collections/street-style" }, { label: "Cyberpunk", href: "/collections/cyberpunk" }],
    ctaLabel: "Crear imágenes dinámicas",
    altSubject: "retrato dinámico con sensación de movimiento y gesto expresivo",
    faqAnswer: "Crea imágenes dinámicas con caminatas, viento, baile o acción para portadas, conceptos de vídeo y perfiles expresivos."
  }),
  "christmas-photo": content({
    label: "Fotos de Navidad",
    seoTerm: "fotos de Navidad",
    h2: "Fotos de Navidad para recuerdos cálidos",
    h3: ["Luces y decoración", "Retratos familiares", "Tarjetas de temporada"],
    intro: "Fotos de Navidad reúne luces, regalos, ramas, cenas y retratos de pareja o familia en una galería de temporada. Las muestras cambian entre interior acogedor, paseo urbano, mesa festiva y retrato cercano para que las tarjetas no parezcan repetidas. Puedes usar la dirección para recuerdos personales, mensajes navideños o contenidos sociales, evitando marcas y personajes protegidos que no formen parte de tus referencias.",
    details: ["Usa fotos propias o autorizadas de todas las personas que aparecerán.", "Elige una escena de árbol, mesa, paseo con luces o regalo según el mensaje que quieres transmitir.", "Revisa manos, decoración, texto y rostros antes de compartir la tarjeta."],
    useCases: ["Tarjetas navideñas", "Álbumes familiares", "Retratos de pareja", "Publicaciones de temporada"],
    workflow: ["Selecciona fotos claras.", "Define una escena de Navidad.", "Revisa cantidad y créditos.", "Elige los recuerdos más naturales."],
    internalLinks: [{ label: "Fotos de Acción de Gracias", href: "/collections/thanksgiving-photo" }, { label: "Fotos de compromiso", href: "/collections/engagement-photo" }, { label: "Halloween", href: "/collections/halloween-photo" }],
    ctaLabel: "Crear fotos de Navidad",
    altSubject: "retrato navideño con luces cálidas, decoración y ambiente festivo",
    faqAnswer: "Crea fotos de Navidad con luces, regalos, cenas y retratos familiares o de pareja para tarjetas y recuerdos de temporada."
  }),
  "black-friday": content({
    label: "Black Friday",
    seoTerm: "fotos de Black Friday",
    h2: "Black Friday para campañas y promociones visuales",
    h3: ["Escaparate promocional", "Producto en contexto", "Composición de campaña"],
    intro: "Black Friday está orientado a imágenes promocionales con energía de campaña, escaparates, bolsas, productos genéricos y composiciones con espacio para una oferta. Las escenas cambian entre una persona comprando, un bodegón editorial y un ambiente urbano para que puedas elegir el tono adecuado. No sustituye una fotografía de producto real ni añade precios, logotipos o descuentos que no hayas proporcionado.",
    details: ["Usa productos, personas y marcas solo cuando tengas permiso para mostrarlos.", "Define si necesitas una composición de producto, una escena de compra o un fondo con espacio para diseño.", "Revisa textos, etiquetas y proporciones antes de usar la imagen en una campaña."],
    useCases: ["Campañas de temporada", "Posts promocionales", "Escaparates visuales", "Moodboards comerciales"],
    workflow: ["Prepara referencias autorizadas.", "Elige el tono de la campaña.", "Revisa el espacio para copy.", "Valida producto y texto antes de publicar."],
    internalLinks: [{ label: "Tarjetas para redes", href: "/collections/social-cards" }, { label: "Cambiador de fondo", href: "/collections/background-changer" }, { label: "Estilo de vida premium", href: "/collections/rich-lifestyle" }],
    ctaLabel: "Crear imágenes de Black Friday",
    altSubject: "composición promocional de Black Friday con producto y espacio para diseño",
    faqAnswer: "Crea imágenes de campaña para Black Friday con escaparates, productos genéricos y espacio visual para una promoción autorizada."
  }),
  "hairstyle-generator": content({
    label: "Generador de peinados",
    seoTerm: "pruebas virtuales de peinados",
    h2: "Generador de peinados para comparar estilos",
    h3: ["Cortes y textura", "Color del cabello", "Vista de referencia"],
    intro: "Generador de peinados permite comparar cortes, recogidos, ondas, textura y color sobre una foto propia. La galería alterna retratos frontales, perfiles y ambientes cotidianos para que puedas valorar el estilo desde distintos ángulos. El resultado es una referencia visual: el cabello generado no confirma por sí solo el acabado de una peluquería, por lo que conviene revisar la forma del rostro y la línea del cabello antes de decidir.",
    details: ["Usa una foto con el rostro despejado y suficiente luz alrededor del cabello.", "Describe longitud, textura y color sin pedir una copia exacta de una persona pública.", "Compara frente, perfil, volumen y transición del cabello para elegir una opción realista."],
    useCases: ["Inspiración de corte", "Pruebas de color", "Moodboards de belleza", "Looks de ocasión"],
    workflow: ["Sube una foto clara.", "Elige corte, textura o color.", "Compara varias vistas.", "Usa el resultado como referencia."],
    internalLinks: [{ label: "Probador virtual", href: "/collections/virtual-try-on" }, { label: "Retoque de retrato", href: "/collections/portrait-retouch" }, { label: "Fotos de gala", href: "/collections/gala-photo" }],
    ctaLabel: "Probar un peinado",
    altSubject: "retrato de una persona adulta con un peinado generado para comparar estilos",
    faqAnswer: "Crea referencias de cortes, recogidos, ondas y colores para comparar peinados antes de elegir un look."
  }),
  "rich-lifestyle": content({
    label: "Estilo de vida premium",
    seoTerm: "fotos de estilo de vida premium",
    h2: "Estilo de vida premium con estética editorial",
    h3: ["Interiores sofisticados", "Viajes y detalles", "Marca personal"],
    intro: "Estilo de vida premium combina retratos, viajes, interiores, gastronomía y objetos de diseño para construir una imagen aspiracional pero creíble. La variedad se apoya en cambios de contexto, vestuario, luz y escala, no en repetir una mesa de lujo. Es útil para perfiles de creador, moodboards de marca personal y contenidos editoriales que necesitan una atmósfera cuidada sin afirmar que una experiencia, hotel o producto concreto sea real.",
    details: ["Usa fotos propias y define qué elementos deben conservarse como parte de tu identidad.", "Elige una mezcla de interior, viaje, mesa o retrato según el mensaje de la marca personal.", "Revisa objetos, logotipos y textos para evitar asociaciones comerciales no autorizadas."],
    useCases: ["Marca personal", "Contenido de creador", "Editorial de viaje", "Moodboards de estilo"],
    workflow: ["Selecciona referencias claras.", "Define el nivel de sofisticación.", "Compara escenas y vestuario.", "Conserva imágenes coherentes con tu marca."],
    internalLinks: [{ label: "Cannes", href: "/collections/cannes" }, { label: "Viajes y destinos", href: "/collections/estilo-y-fantasia" }, { label: "Probador virtual", href: "/collections/virtual-try-on" }],
    ctaLabel: "Crear fotos de estilo de vida premium",
    altSubject: "retrato editorial de estilo de vida premium en un entorno sofisticado",
    faqAnswer: "Crea fotos editoriales de interiores, viajes, gastronomía y marca personal con una estética cuidada y aspiracional."
  }),
  "portrait-photo": content({
    label: "Retratos de pareja",
    seoTerm: "retratos de pareja",
    h2: "Retratos de pareja con escenas variadas",
    h3: ["Conexión natural", "Escenas cotidianas", "Recuerdos compartidos"],
    intro: "Retratos de pareja crea una serie flexible de momentos compartidos: conversación, paseo, café, viaje, cena o abrazo. Las escenas cambian de distancia y ambiente para que puedas elegir entre una imagen íntima y otra más abierta, sin reducir la galería al mismo gesto. Es una propuesta general para recuerdos personales y redes, basada en fotos autorizadas de las dos personas adultas.",
    details: ["Sube fotos de ambas personas con expresiones y ángulos variados.", "Elige una escena cotidiana, urbana, costera o de interior según el recuerdo que quieras construir.", "Revisa manos, rostros y proporciones antes de compartir el resultado."],
    useCases: ["Álbumes de pareja", "Fotos de redes", "Recuerdos de viaje", "Tarjetas personales"],
    workflow: ["Selecciona fotos autorizadas.", "Elige una dinámica de pareja.", "Revisa cantidad y coste.", "Descarga las escenas coherentes."],
    internalLinks: [{ label: "Fotos de compromiso", href: "/collections/engagement-photo" }, { label: "Fotos de San Valentín", href: "/collections/valentines-photo" }, { label: "Fotos de boda", href: "/collections/wedding-photo" }],
    ctaLabel: "Crear retratos de pareja",
    altSubject: "pareja adulta compartiendo un retrato natural en una escena cotidiana",
    faqAnswer: "Crea retratos de pareja en escenas cotidianas, urbanas, costeras o de interior para recuerdos y publicaciones."
  }),
  headshot: content({
    label: "Retratos profesionales",
    seoTerm: "retratos profesionales",
    h2: "Retratos profesionales para tu perfil",
    h3: ["Presencia profesional", "Fondos versátiles", "Expresión natural"],
    intro: "Retratos profesionales combina fondos de estudio, oficinas, exteriores y ambientes creativos para que puedas elegir una imagen que represente tu trabajo. La galería cambia encuadre, vestuario y expresión sin perder claridad en el rostro. Es adecuada para perfiles laborales, páginas de creador, presentaciones y redes profesionales, siempre revisando que la imagen final conserve tus rasgos y no sugiera una empresa o cargo que no corresponda.",
    details: ["Usa fotos nítidas con el rostro visible y una expresión que encaje con tu actividad.", "Compara un fondo neutro con una escena contextual para decidir cuánto de tu entorno debe aparecer.", "Revisa manos, ropa y elementos de marca antes de usar el retrato en un perfil público."],
    useCases: ["LinkedIn y perfiles", "Páginas de creador", "Presentaciones", "Marca personal"],
    workflow: ["Carga varias fotos autorizadas.", "Elige el contexto profesional.", "Comprueba coste y cantidad.", "Descarga el retrato más representativo."],
    internalLinks: [{ label: "Avatar profesional", href: "/collections/avatar" }, { label: "Retoque de retrato", href: "/collections/portrait-retouch" }, { label: "Fotos de gala", href: "/collections/gala-photo" }],
    ctaLabel: "Crear retratos profesionales",
    altSubject: "retrato profesional de una persona adulta con fondo limpio y expresión natural",
    faqAnswer: "Crea retratos profesionales para perfiles, páginas de creador, presentaciones y marca personal con fondos versátiles."
  }),
  "only-fans": content({
    label: "Contenido para creadores adultos",
    seoTerm: "fotos para creadores adultos",
    h2: "Fotos para creadores adultos con control de estilo",
    h3: ["Identidad de creador", "Escenas privadas", "Revisión antes de compartir"],
    intro: "Contenido para creadores adultos ofrece una dirección visual para personas adultas que necesitan retratos, escenas de estilo de vida y material de perfil con una identidad consistente. La galería alterna interior, ciudad, viaje y ambiente nocturno para que el contenido no dependa de una sola pose. Está orientada a crear referencias autorizadas y revisables, respetando consentimiento, límites personales y las reglas de la plataforma donde se publicará.",
    details: ["Usa exclusivamente fotos propias o autorizadas de personas adultas.", "Define el nivel de cobertura, ambiente y tono antes de iniciar para mantener control sobre el resultado.", "Revisa cada imagen y las reglas de la plataforma antes de descargar o compartir."],
    useCases: ["Perfiles de creador adulto", "Sets de contenido", "Marca personal", "Promoción social"],
    workflow: ["Selecciona referencias autorizadas.", "Define estilo y límites.", "Revisa cantidad y créditos.", "Aprueba individualmente cada resultado."],
    internalLinks: [{ label: "Boudoir editorial", href: "/collections/boudoir" }, { label: "Estilo de vida premium", href: "/collections/rich-lifestyle" }, { label: "Vida nocturna", href: "/collections/nightlife" }],
    ctaLabel: "Crear fotos para creadores adultos",
    altSubject: "retrato editorial de una persona adulta para perfil de creador",
    faqAnswer: "Crea retratos y escenas de estilo de vida para creadores adultos, con control de cobertura, consentimiento y revisión antes de compartir."
  }),
  "singles-awareness-day": content({
    label: "Día de la Conciencia de la Soltería",
    seoTerm: "fotos del Día de la Conciencia de la Soltería",
    h2: "Fotos para celebrar la soltería con personalidad",
    h3: ["Autonomía y estilo", "Retratos de amistad", "Momentos propios"],
    intro: "Día de la Conciencia de la Soltería celebra la autonomía, las amistades y los planes propios con retratos que no dependen de una historia romántica. Las escenas alternan autocuidado, noche con amigos, viaje, café y actividades creativas para dar a la galería más personalidad. Es una dirección positiva para publicaciones, tarjetas y recuerdos personales, con una estética moderna que puede ser elegante, divertida o urbana.",
    details: ["Elige fotos propias o autorizadas de las personas que quieran aparecer.", "Combina una escena individual con otra de amistad para construir una historia más completa.", "Revisa expresiones, manos y textos de fondo antes de publicar."],
    useCases: ["Publicaciones de soltería", "Álbumes con amigas", "Tarjetas personales", "Retratos de autonomía"],
    workflow: ["Selecciona el grupo o retrato individual.", "Define el tono de celebración.", "Compara las escenas.", "Descarga las imágenes que mejor cuentan tu historia."],
    internalLinks: [{ label: "Fiestas y celebraciones", href: "/collections/holiday" }, { label: "Vida nocturna", href: "/collections/nightlife" }, { label: "Fotos de San Valentín", href: "/collections/valentines-photo" }],
    ctaLabel: "Crear fotos de soltería",
    altSubject: "retrato de una persona adulta celebrando la soltería con estilo y autonomía",
    faqAnswer: "Crea fotos para celebrar la soltería con retratos individuales, amistades, viajes y momentos personales."
  }),
  urban: content({
    label: "Urbano",
    seoTerm: "retratos urbanos",
    h2: "Retratos urbanos con escenarios de ciudad",
    h3: ["Arquitectura y ritmo", "Luz de calle", "Estilo cotidiano"],
    intro: "Urbano reúne retratos en calles, estaciones, cafeterías, azoteas y edificios para crear una galería con ritmo de ciudad. Los encuadres cambian entre plano cercano, figura completa y escena ambiental, mientras la luz pasa de mañana a noche. Es una opción flexible para perfiles, moda y contenido de creador cuando quieres que la arquitectura y el movimiento cotidiano formen parte de la imagen.",
    details: ["Usa fotos donde el sujeto y su postura sean visibles con claridad.", "Elige una dirección de ciudad limpia, industrial, creativa o nocturna según tu identidad.", "Revisa carteles, matrículas, logotipos y rostros de fondo antes de compartir."],
    useCases: ["Moda urbana", "Perfiles sociales", "Contenido de creador", "Retratos de viaje"],
    workflow: ["Sube referencias autorizadas.", "Elige un ambiente de ciudad.", "Compara luz y encuadre.", "Conserva las escenas más creíbles."],
    internalLinks: [{ label: "Estilo callejero", href: "/collections/street-style" }, { label: "Cyberpunk", href: "/collections/cyberpunk" }, { label: "Noir cinematográfico", href: "/collections/mafia" }],
    ctaLabel: "Crear retratos urbanos",
    altSubject: "retrato urbano de una persona adulta junto a arquitectura y luz de ciudad",
    faqAnswer: "Crea retratos urbanos con calles, estaciones, cafeterías, azoteas y diferentes horas de luz."
  }),
  "estilo-y-fantasia": content({
    label: "Viajes y destinos",
    seoTerm: "fotos de viajes y destinos",
    h2: "Fotos de viajes con destinos variados",
    h3: ["Paisajes y contexto", "Escapadas urbanas", "Recuerdos de ruta"],
    intro: "Viajes y destinos convierte fotos autorizadas en escenas de costa, montaña, ciudad, café, tren y escapada de fin de semana. La galería cambia el paisaje, la escala y la hora del día para que cada imagen tenga una sensación propia. Puedes usarla para recordar una ruta, imaginar un moodboard de viaje o preparar contenido de creador, siempre distinguiendo una referencia visual de una fotografía documental real.",
    details: ["Usa fotos con rostro y postura claros para integrar a la persona en el nuevo destino.", "Elige entre costa, montaña, casco urbano, tren o interior acogedor según la historia del viaje.", "Revisa arquitectura, clima, manos y elementos de texto antes de compartir."],
    useCases: ["Álbumes de viaje", "Perfiles de creador", "Moodboards de destino", "Recuerdos de escapada"],
    workflow: ["Selecciona fotos propias.", "Define el destino visual.", "Compara escenas y luz.", "Descarga los recuerdos coherentes."],
    internalLinks: [{ label: "Estilo de vida premium", href: "/collections/rich-lifestyle" }, { label: "Urbano", href: "/collections/urban" }, { label: "Fotos de compromiso", href: "/collections/engagement-photo" }],
    ctaLabel: "Crear fotos de viajes",
    altSubject: "retrato de viaje en un destino con paisaje y contexto visible",
    faqAnswer: "Crea fotos de viajes en costa, montaña, ciudad, tren y otros destinos para álbumes, moodboards y contenido de creador."
  }),
  nightlife: content({
    label: "Vida nocturna",
    seoTerm: "fotos de vida nocturna",
    h2: "Vida nocturna con luces y ambiente social",
    h3: ["Luces de ciudad", "Retratos sociales", "Atmósfera de noche"],
    intro: "Vida nocturna mezcla bares sin marca, calles iluminadas, terrazas, música y retratos sociales para crear una galería con energía nocturna. Las escenas cambian entre una persona, una pareja y un pequeño grupo, además de variar la relación entre luces de fondo y rostro. Es una dirección útil para creadores, perfiles sociales y recuerdos de una noche, con revisión cuidadosa de manos, copas, texto y expresiones.",
    details: ["Sube fotos autorizadas de las personas que quieras incluir en el ambiente.", "Elige una noche urbana, una terraza, una fiesta íntima o un retrato con luces desenfocadas.", "Comprueba que no aparezcan marcas, textos o personas de fondo que no deban compartirse."],
    useCases: ["Perfiles nocturnos", "Contenido social", "Recuerdos de fiesta", "Retratos de creador"],
    workflow: ["Selecciona referencias claras.", "Define el tono de la noche.", "Revisa cantidad y créditos.", "Aprueba cada retrato antes de compartir."],
    internalLinks: [{ label: "Fiestas y celebraciones", href: "/collections/holiday" }, { label: "Noir cinematográfico", href: "/collections/mafia" }, { label: "Urbano", href: "/collections/urban" }],
    ctaLabel: "Crear fotos de vida nocturna",
    altSubject: "retrato de vida nocturna con luces de ciudad y ambiente social",
    faqAnswer: "Crea fotos nocturnas con luces urbanas, terrazas, retratos sociales y ambientes de fiesta para perfiles y recuerdos."
  })
};

export function aidreamshootsXbyThemeContent(slug: string): AidreamshootsXbyThemeContent | undefined {
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (normalized === "travel") return themes["estilo-y-fantasia"];
  return themes[normalized];
}

export function aidreamshootsXbyThemeAlt(slug: string, index: number): string {
  const functionalAlt = aidreamshootsFunctionalAlt(slug, index);
  if (functionalAlt) return functionalAlt;
  const theme = aidreamshootsXbyThemeContent(slug);
  const scene = sceneLabels[Math.max(0, Math.min(sceneLabels.length - 1, index))];
  const label = theme?.label ?? "Tema fotográfico";
  const subject = theme?.altSubject ?? "retrato de una persona adulta";
  const suffix = ` en ${scene}.`;
  const subjectLimit = 118 - `${label}: `.length - suffix.length;
  const subjectCandidates = [subject, "retrato de una persona adulta", "persona adulta en una escena temática"];
  const selectedSubject = subjectCandidates.find((candidate) => candidate.length <= subjectLimit) ??
    subject.slice(0, Math.max(12, subjectLimit)).replace(/\s+\S*$/, "").replace(/[,.]$/, "");
  return `${label}: ${selectedSubject}${suffix}`;
}

export function aidreamshootsXbyThemeAltList(slug: string, count = 13): string[] {
  return Array.from({ length: count }, (_, index) => aidreamshootsXbyThemeAlt(slug, index));
}

export const AIDREAMSHOOTS_XBY_THEME_SLUGS = Object.freeze(Object.keys(themes));
