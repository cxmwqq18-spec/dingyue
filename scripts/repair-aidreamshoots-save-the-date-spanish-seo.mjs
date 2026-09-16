#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const siteId = "site_mydreamshoots_xby";
const weddingInvitationSourceSlug = "/ai-video-generation/wedding-invitation";
const themeSlugs = [
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/halloween",
  "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day"
];
const allSlugs = [...themeSlugs, weddingInvitationSourceSlug];
const publicWeddingInvitationPath = "/ai-save-the-date/wedding-invitation";
const confirmation = "aidreamshoots-save-the-date-spanish-seo-repair";
const backupDirectory = path.resolve(".tmp/aidreamshoots-save-the-date-seo-repair/backups");

const profiles = {
  "/ai-save-the-date/valentines-day": {
    topic: "San Valentín",
    title: "San Valentín: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos de San Valentín con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "San Valentín,fotos con IA,vídeos con IA,celebraciones,AIdreamshoots",
    h1: "Crea fotos y vídeos de San Valentín con IA",
    intro: "Convierte tus fotos en una historia de San Valentín, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "San Valentín con IA",
    primaryCta: "Crear contenido de San Valentín",
    secondaryCta: "Explorar estilos de San Valentín"
  },
  "/ai-save-the-date/engagement": {
    topic: "compromiso",
    title: "Compromiso: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos de compromiso con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "compromiso,guardar la fecha,fotos con IA,vídeos con IA,AIdreamshoots",
    h1: "Crea fotos y vídeos de compromiso con IA",
    intro: "Convierte tus fotos en una historia de compromiso, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "Guardar la fecha con IA",
    primaryCta: "Crear fotos o vídeos de compromiso",
    secondaryCta: "Explorar Guardar la fecha con IA"
  },
  "/ai-save-the-date/proposal": {
    topic: "propuesta",
    title: "Propuesta: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos para una propuesta con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "propuesta romántica,fotos con IA,vídeos con IA,guardar la fecha,AIdreamshoots",
    h1: "Crea fotos y vídeos para una propuesta con IA",
    intro: "Convierte tus fotos en una historia de propuesta, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "Guardar la fecha con IA",
    primaryCta: "Crear mi propuesta",
    secondaryCta: "Ver paquetes"
  },
  "/ai-save-the-date/save-the-date": {
    topic: "guardar la fecha",
    title: "Guardar la fecha: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos para guardar la fecha con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "guardar la fecha,fotos con IA,vídeos con IA,compromiso,AIdreamshoots",
    h1: "Crea fotos y vídeos para guardar la fecha con IA",
    intro: "Convierte tus fotos en una historia para guardar la fecha, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "Guardar la fecha con IA",
    primaryCta: "Crear mi guardar la fecha",
    secondaryCta: "Ver paquetes"
  },
  "/ai-save-the-date/wedding-ceremony": {
    topic: "una ceremonia de boda",
    title: "Ceremonia de boda: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos de una ceremonia de boda con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "ceremonia de boda,fotos con IA,vídeos con IA,recuerdos de boda,AIdreamshoots",
    h1: "Crea fotos y vídeos de una ceremonia de boda con IA",
    intro: "Convierte tus fotos en una historia de ceremonia de boda, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "Ceremonia de boda con IA",
    primaryCta: "Crear recuerdos de la ceremonia",
    secondaryCta: "Ver paquetes"
  },
  "/ai-save-the-date/christmas": {
    topic: "Navidad",
    title: "Navidad: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos de Navidad con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "Navidad,fotos con IA,vídeos con IA,retratos navideños,AIdreamshoots",
    h1: "Crea fotos y vídeos de Navidad con IA",
    intro: "Convierte tus fotos en una historia de Navidad, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "Navidad con IA",
    primaryCta: "Crear contenido de Navidad",
    secondaryCta: "Ver paquetes"
  },
  "/ai-save-the-date/halloween": {
    topic: "Halloween",
    title: "Halloween: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos de Halloween con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "Halloween,fotos con IA,vídeos con IA,retratos de disfraces,AIdreamshoots",
    h1: "Crea fotos y vídeos de Halloween con IA",
    intro: "Convierte tus fotos en una historia de Halloween, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "Halloween con IA",
    primaryCta: "Crear contenido de Halloween",
    secondaryCta: "Ver paquetes"
  },
  "/ai-save-the-date/thanksgiving": {
    topic: "Acción de Gracias",
    title: "Acción de Gracias: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos de Acción de Gracias con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "Acción de Gracias,fotos con IA,vídeos con IA,retratos familiares,AIdreamshoots",
    h1: "Crea fotos y vídeos de Acción de Gracias con IA",
    intro: "Convierte tus fotos en una historia de Acción de Gracias, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "Acción de Gracias con IA",
    primaryCta: "Crear contenido de Acción de Gracias",
    secondaryCta: "Ver paquetes"
  },
  "/ai-save-the-date/new-year": {
    topic: "Año Nuevo",
    title: "Año Nuevo: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos de Año Nuevo con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "Año Nuevo,fotos con IA,vídeos con IA,celebraciones,AIdreamshoots",
    h1: "Crea fotos y vídeos de Año Nuevo con IA",
    intro: "Convierte tus fotos en una historia de Año Nuevo, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "Año Nuevo con IA",
    primaryCta: "Crear contenido de Año Nuevo",
    secondaryCta: "Ver paquetes"
  },
  "/ai-save-the-date/mothers-day": {
    topic: "Día de la Madre",
    title: "Día de la Madre: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos del Día de la Madre con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "Día de la Madre,fotos con IA,vídeos con IA,retratos familiares,AIdreamshoots",
    h1: "Crea fotos y vídeos del Día de la Madre con IA",
    intro: "Convierte tus fotos en una historia del Día de la Madre, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "Día de la Madre con IA",
    primaryCta: "Crear contenido del Día de la Madre",
    secondaryCta: "Ver paquetes"
  },
  "/ai-save-the-date/fathers-day": {
    topic: "Día del Padre",
    title: "Día del Padre: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos del Día del Padre con IA, revisa los créditos y conserva el resultado en un espacio privado.",
    keywords: "Día del Padre,fotos con IA,vídeos con IA,retratos familiares,AIdreamshoots",
    h1: "Crea fotos y vídeos del Día del Padre con IA",
    intro: "Convierte tus fotos en una historia del Día del Padre, revisa cada detalle y guarda el resultado en privado.",
    eyebrow: "Día del Padre con IA",
    primaryCta: "Crear contenido del Día del Padre",
    secondaryCta: "Ver paquetes"
  }
};

// These values were produced by the previous theme-content translation pass.
// Keep the replacements exact so image URLs, provider originals, and other
// non-copy data cannot be changed accidentally.
const copyReplacements = {
  "unño": "año",
  "díun": "día",
  "galeríun": "galería",
  "unñade": "Añade",
  "Cuando se descuentan los créditos?": "¿Cuándo se descuentan los créditos?",
  "Qué selfies funcionan mejor?": "¿Qué selfies funcionan mejor?",
  "Puedo probar estilos distintos?": "¿Puedo probar estilos distintos?",
  "Donde veo mis álbumes?": "¿Dónde veo mis álbumes?",
  "segun": "según",
  "Si.": "Sí.",
  "Revisa los rostros desde escena para escena.": "Revisa los rostros de una escena a otra.",
  "Revisar la detalles antes compartir": "Revisar los detalles antes de compartir",
  "Define la propuesta historia y la central momento.": "Define la historia de la propuesta y el momento central.",
  "Elegir claro pareja fotos o clips con útil encuadre variety.": "Elige fotos o clips nítidos de la pareja y combina varios encuadres.",
  "Revisar rostros, manos, anillo shape, iluminación, y escena continuity.": "Revisa rostros, manos, la forma del anillo, la iluminación y la continuidad de la escena.",
  "anillo revelación": "Revelación del anillo",
  "propuesta historia desde relación fotos": "Historia de la propuesta a partir de fotos de la relación",
  "Setup": "Preparación",
  "abre con la ubicación, contexto, y pareja detalles antes la propuesta momento.": "Empieza con la ubicación, el contexto y los detalles de la pareja antes del momento de la propuesta.",
  "reacción": "Reacción posterior",
  "reacción o cierre escena": "Reacción o escena de cierre",
  "cuadrado feed version": "Versión cuadrada para publicaciones",
  "selecciona autorizado imágenes": "Selecciona imágenes autorizadas",
  "Elegir uno historia estructura": "Elige una estructura para la historia",
  "Generar corto escenas": "Genera escenas breves",
  "Revisar destino recortes": "Revisa el destino y los recortes",
  "Consent — usa solo imágenes autorizado para la intended publicar contexto.": "Consentimiento: usa solo imágenes autorizadas para el contexto en el que se publicarán.",
  "Destino boda": "Destino de boda",
  "Guardar la fecha con IA propuesta": "Guardar la fecha para una propuesta",
  "desde autorizado fotos": "A partir de fotos autorizadas",
  "relación historia": "Historia de la relación",
  "Guardar la fecha con IA guardar la fecha": "Historia para guardar la fecha",
  "movimiento transition": "Transición con movimiento",
  "propuesta memory": "Recuerdos de la propuesta",
  "Milestone retrato": "Retrato de un momento importante",
  "Alternate principal / escena inspiration": "Alternativa principal para una escena de inspiración",
  "Revisar la ceremonia, no Just uno Pretty fotograma": "Revisa toda la ceremonia, no solo un fotograma atractivo",
  "Crear un church o indoor ceremonia recap": "Crea un resumen de la ceremonia en una iglesia o espacio interior",
  "crear un destino o outdoor ceremonia historia": "Crea una historia de ceremonia en un destino o espacio exterior",
  "Guardar la fecha con IA boda ceremonia": "Guardar la fecha de la ceremonia de boda",
  "claro rostros en un útil size;": "rostros claros y suficientemente grandes",
  "screenshots o imágenes compressed repeatedly;": "capturas de pantalla o imágenes comprimidas varias veces",
  "fotogramas dónde manos, bouquet, veil, o rostros hijo obscured;": "fotogramas en los que las manos, el ramo, el velo o los rostros queden ocultos",
  "heavily filtered retratos ese cambio facial estructura;": "retratos con filtros intensos que alteren los rasgos faciales",
  "boda ceremonia vs Nearby boda páginas": "Ceremonia de boda frente a otras páginas de boda",
  "boda ceremonia: vows, processional, anillo exchange, officiant, primero beso, familia/guest reactions, ceremonia recap.": "Ceremonia de boda: votos, procesión, intercambio de anillos, oficiante, primer beso, reacciones de la familia y resumen de la ceremonia.",
  "primero beso": "Primer beso",
  "Recessional": "Salida de la ceremonia",
  "Recessional — movimiento y la transition desde ceremonia para celebración.": "Salida de la ceremonia: movimiento y transición hacia la celebración.",
  "Vows con officiant": "Votos con el oficiante",
  "Church o indoor atmósfera": "Atmósfera de iglesia o espacio interior",
  "Bride o pareja processional": "Procesión de la novia o la pareja",
  "Bride o pareja processional — anticipation y familia contexto antes vows.": "Procesión de la novia o la pareja: anticipación y contexto familiar antes de los votos.",
  "Guest reacción": "Reacción de los invitados",
  "la processional adds anticipation y familia contexto antes vows y anillos.": "La procesión aporta anticipación y contexto familiar antes de los votos y los anillos.",
  "Crear lo Responsibly": "Crear de forma responsable",
  "abre vídeo espacio": "Abrir el espacio de vídeo",
  "qué es un IA boda ceremonia foto vídeo": "¿Qué es un generador de fotos y vídeos de ceremonia de boda con IA?",
  "qué es un IA propuesta vídeo?": "¿Qué es un generador de vídeos de propuesta con IA?",
  "Crear IA navidad fotos y vídeos para festivos tarjetas, familia recuerdos, festive retratos, invierno escenas, mascota fotos, redes publicaciones, y de temporada greetings.": "Crea con IA fotos y vídeos de Navidad para tarjetas, recuerdos familiares, retratos festivos, escenas de invierno, fotos de mascotas y publicaciones de temporada.",
  "navidad foto vs navidad vídeo": "Foto de Navidad frente a vídeo de Navidad",
  "qué debe I revisa antes compartir IA navidad contenido?": "¿Qué debes revisar antes de compartir contenido navideño creado con IA?",
  "qué para revisa antes compartir IA navidad contenido": "Qué revisar antes de compartir contenido navideño creado con IA",
  "Elegir la navidad dirección": "Elige la dirección visual de Navidad",
  "selecciona fotos fuente o clips": "Selecciona fotos o clips de origen",
  "crear la de temporada aspecto": "Crea el aspecto de temporada",
  "Revisar personas y objects": "Revisa las personas y los objetos",
  "familia navidad retratos": "Retratos familiares de Navidad",
  "Snowy invierno Landscapes": "Paisajes nevados de invierno",
  "usa Santa-inspired elementos visuales cuándo la página o greeting necesita un clásico navidad character dirección.": "Usa elementos inspirados en Papá Noel cuando la página o la tarjeta necesite una estética navideña clásica.",
  "Santa y Character escenas": "Escenas de Papá Noel y personajes navideños",
  "Cozy Indoor retratos": "Retratos acogedores en interiores",
  "navidad tarjetas y regalo elementos visuales": "Tarjetas navideñas y detalles de regalos",
  "familia apertura regalos beside un navidad tree": "Familia abriendo regalos junto al árbol de Navidad",
  "Snowy cabin en dusk": "Cabaña nevada al anochecer",
  "Santa retrato con lantern y tree luces": "Retrato de Papá Noel con farol y luces del árbol",
  "Cozy cocoa retrato con la chimenea": "Retrato acogedor con cacao junto a la chimenea",
  "mascota en un Santa hat": "Mascota con gorro de Papá Noel",
  "Un navidad escena para pareja fotos, festivos greetings, y corto festive historia vídeos.": "Una escena navideña para fotos de pareja, tarjetas festivas y vídeos breves con una historia de temporada.",
  "pareja en un navidad market": "Pareja en un mercado navideño",
  "familia Memory vídeo": "Vídeo de recuerdos familiares",
  "navidad Greeting vídeo": "Vídeo de felicitación navideña",
  "usa claro mascota retratos para Santa hats, regalo escenas, tree backgrounds, y playful festivos tarjetas.": "Usa retratos nítidos de mascotas para gorros de Papá Noel, escenas de regalos, fondos con árboles y tarjetas festivas.",
  "usa un clásico Santa retrato para traditional navidad character escenas y festive greeting conceptos.": "Usa un retrato clásico de Papá Noel para escenas tradicionales y felicitaciones navideñas.",
  "usa un cálido familia momento as la principal navidad principal cuándo para communicate festivos fotos, recuerdos, y festive vídeo escenas.": "Usa un momento familiar cálido como imagen principal para comunicar fotos festivas, recuerdos y escenas navideñas en vídeo.",
  "un tabletop escena para navidad greeting tarjetas, regalo elementos visuales, y festivos stationery conceptos.": "Una escena de mesa para tarjetas navideñas, detalles de regalos y elementos de papelería festiva.",
  "accion de gracias gastronómico contenido": "Contenido gastronómico de Acción de Gracias",
  "accion de gracias greeting contenido": "Contenido de felicitación de Acción de Gracias",
  "accion de gracias redes compartir": "Contenido de Acción de Gracias para compartir en redes sociales",
  "usa un claro familia, comida de amigos, gastronómico, o still-life dirección, despues revisa la resultado para believable detalles antes compartir lo en un greeting, redes post, o privado festivos album.": "Usa una dirección visual clara para la familia, la comida, la gastronomía o los bodegones; después revisa los detalles antes de compartirlos en una felicitación, una publicación o un álbum festivo privado.",
  "qué es un IA accion de gracias foto y vídeo generador": "¿Qué es un generador de fotos y vídeos de Acción de Gracias con IA?",
  "Crear accion de gracias contenido": "Crear contenido de Acción de Gracias",
  "Crear accion de gracias elementos visuales con IA": "Crear elementos visuales de Acción de Gracias con IA",
  "Crear accion de gracias fotos y vídeos": "Crear fotos y vídeos de Acción de Gracias",
  "Guardar la fecha con IA accion de gracias": "Guardar los recuerdos de Acción de Gracias",
  "Multigenerational accion de gracias cena": "Cena familiar de Acción de Gracias",
  "Harvest basket y fall décor": "Cesta de la cosecha y decoración otoñal",
  "Harvest décor still life.": "Bodegón con decoración de la cosecha.",
  "Pet-friendly festivos retrato": "Retrato festivo con mascota",
  "Pet-friendly accion de gracias retrato.": "Retrato de Acción de Gracias con mascota.",
  "Mobile-capture accion de gracias contenido escena.": "Escena de Acción de Gracias capturada con teléfono móvil.",
  "Outdoor familia estilo de vida accion de gracias escena.": "Escena familiar de Acción de Gracias al aire libre.",
  "Outdoor familia walk en otoño leaves": "Paseo familiar al aire libre entre hojas de otoño",
  "cálido accion de gracias familia cena principal imagen.": "Imagen principal de una cálida cena familiar de Acción de Gracias.",
  "familia accion de gracias cena": "Cena familiar de Acción de Gracias",
  "familia celebración greetings": "Felicitaciones de una celebración familiar",
  "fiesta recap fotos y vídeos cortos": "Resumen de la celebración en fotos y vídeos breves",
  "Festive de temporada marketing contenido": "Contenido de marketing festivo y de temporada",
  "Good para gratitude, greetings, y sentimental narración.": "Ideal para expresar gratitud, enviar felicitaciones y contar una historia emotiva.",
  "qué es un IA nuevo unño foto y vídeo Maker": "¿Qué es un generador de fotos y vídeos de Año Nuevo con IA?",
  "qué hace nuevo unño contenido funciona": "Qué hace que el contenido de Año Nuevo funcione",
  "celebrar nuevo Beginnings": "Celebrar nuevos comienzos",
  "Crear nuevo unño fotos & vídeos": "Crear fotos y vídeos de Año Nuevo",
  "familia nuevo unño celebración": "Celebración familiar de Año Nuevo",
  "Cozy nuevo unño morning": "Mañana acogedora de Año Nuevo",
  "este es útil para dynamic nuevo unño vídeo ejemplos.": "Es útil para mostrar ejemplos dinámicos de vídeos de Año Nuevo.",
  "Countdown crowd o público celebración": "Cuenta atrás y celebración multitudinaria",
  "Countdown promocional elementos visuales": "Elementos visuales promocionales de la cuenta atrás",
  "nuevo unño redes contenido multimedia greetings": "Felicitaciones multimedia de Año Nuevo para redes sociales",
  "un cheerful sparkler fiesta escena funciona well cuándo la página necesita un redes nuevo unño foto y vídeo ejemplo.": "Una escena alegre de fiesta con bengalas funciona bien cuando la página necesita un ejemplo de foto o vídeo de Año Nuevo para redes sociales.",
  "un quiet still-life escena cuándo la página discusses reflective nuevo unño greetings, ambiente, o estilo de vida contenido.": "Un bodegón tranquilo funciona cuando la página presenta felicitaciones reflexivas de Año Nuevo, ambiente o contenido de estilo de vida.",
  "qué es un IA madre's dia foto y vídeo generador": "¿Qué es un generador de fotos y vídeos del Día de la Madre con IA?",
  "qué hace madre's dia contenido funciona": "Qué hace que el contenido del Día de la Madre funcione",
  "foto y vídeo dirección": "Dirección para fotos y vídeos",
  "Guardar la fecha con IA madres dia": "Recuerdos del Día de la Madre",
  "flores, jewelry, y regalo still life": "Bodegón de flores y regalos",
  "Smartphone-captured familia momento": "Momento familiar capturado con un teléfono móvil",
  "teléfono móvil foto de la accion de gracias mesa": "Foto de una mesa de Acción de Gracias tomada con un teléfono móvil",
  "Multi-generational madre's dia toast": "Brindis familiar del Día de la Madre",
  "Pet-friendly madre's dia retrato": "Retrato del Día de la Madre con mascota",
  "primavera familia walk con tulips": "Paseo familiar de primavera entre tulipanes",
  "familia celebración momentos": "Momentos de celebración familiar",
  "mostrar bouquets, envuelto regalos, tarjetas, jewelry, y thoughtful regalo detalles para madre's dia contenido.": "Muestra ramos, regalos envueltos, tarjetas y detalles pensados para el contenido del Día de la Madre.",
  "Greeting contenido": "Contenido de felicitación",
  "madre's dia funciona naturally con familia fotos, including escenas con niños, multi-generational gatherings, importante regalos, desayuno tables, y relaxed primavera settings.": "El contenido del Día de la Madre funciona de forma natural con fotos familiares, escenas con niños, reuniones de varias generaciones, regalos importantes, mesas de desayuno y ambientes relajados de primavera.",
  "usa un pet-friendly retrato para unñade variety para la galeríun y cover casual madre's dia estilo de vida contenido.": "Usa un retrato con mascota para añadir variedad a la galería y crear una portada informal de estilo de vida para el Día de la Madre.",
  "qué es un IA padre dia foto y vídeo maker": "¿Qué es un generador de fotos y vídeos del Día del Padre con IA?",
  "galeríun": "Galería de ideas",
  "familia cena toast": "Brindis familiar durante la cena",
  "padre dia redes greetings familia foto y vídeo inspiration": "Inspiración de fotos y vídeos familiares del Día del Padre para redes sociales",
  "Greetings y inspiration": "Felicitaciones e inspiración",
  "regalos y appreciation": "Regalos y agradecimiento",
  "Outdoor memory-driven narración": "Narración de recuerdos familiares al aire libre",
  "Outdoor y familia recuerdos": "Recuerdos familiares al aire libre",
  "familia cena o barbecue celebración contenido": "Contenido de celebración familiar durante una cena o barbacoa",
  "cena y barbecue celebrations": "Celebraciones con cena y barbacoa",
  "regalo y greeting escenas": "Escenas de regalos y felicitaciones",
  "celebración dinners y backyard gatherings": "Cenas de celebración y reuniones en el jardín",
  "familia retrato": "Retrato familiar",
  "Woodworking o hands-on activity": "Carpintería o actividad manual",
  "Picnic en la park": "Picnic en el parque",
  "regalo flat lay": "Composición cenital de regalos",
  "este kind de escena emphasizes appreciation y emocional connection.": "Este tipo de escena destaca el agradecimiento y la conexión emocional.",
  "Backyard barbecue o cena toast": "Barbacoa en el jardín o brindis durante la cena",
  "un backyard gathering escena funciona well para familia celebración y redes compartir contenido.": "Una reunión en el jardín funciona bien para celebraciones familiares y contenido para compartir en redes.",
  "un casual estilo de vida escena para relaxed padre dia celebración contenido.": "Una escena informal de estilo de vida para contenido relajado del Día del Padre.",
  "un emocional reacción escena adds autenticidad para padre dia gratitude-focused narración.": "Una escena de reacción emotiva aporta autenticidad a una historia de agradecimiento del Día del Padre.",
  "Pick la setting.": "Elige el ambiente.",
  "familia retratos y multigenerational momentos": "Retratos familiares y momentos de varias generaciones",
  "festive estilo de vida still lifes": "Bodegones festivos de estilo de vida",
  "mascota disfraces y funny de temporada retratos": "Retratos divertidos de mascotas con disfraces de temporada",
  "navidad tree luces, knitwear, hot cocoa, chimenea luz, y cálido decor funciona well para íntimo estilo de vida imágenes.": "Las luces del árbol de Navidad, los tejidos, el cacao caliente, la luz de la chimenea y la decoración cálida funcionan bien para imágenes íntimas de estilo de vida.",
  "un familia activity escena para festivos memory fotos y playful navidad vídeo sequences.": "Una escena de actividad familiar para fotos de recuerdos festivos y secuencias de vídeo navideñas.",
  "un festive mascota escena para navidad tarjetas, mascota retratos, y playful festivos contenido.": "Una escena festiva con mascota para tarjetas navideñas, retratos de mascotas y contenido alegre de temporada.",
  "usa un quiet still-life escena cuándo la página discusses reflective nuevo año greetings, ambiente, o estilo de vida contenido.": "Usa un bodegón tranquilo cuando la página presente felicitaciones reflexivas de Año Nuevo, ambiente o contenido de estilo de vida.",
  "Crea halloween desde tus fotos, revisa los créditos antes de generar y guarda el resultado en una galería privada de AIdreamshoots.": "Crea contenido de Halloween desde tus fotos, revisa los créditos antes de generar y guarda el resultado en una galería privada de AIdreamshoots.",
  "Crea navidad desde tus fotos, revisa los créditos antes de generar y guarda el resultado en una galería privada de AIdreamshoots.": "Crea contenido de Navidad desde tus fotos, revisa los créditos antes de generar y guarda el resultado en una galería privada de AIdreamshoots.",
  "pareja identidad remains consistent escena para escena.": "La identidad de la pareja debe mantenerse coherente de una escena a otra.",
  "Subir un retrato, pareja foto, familia picture, o mascota imagen.": "Sube un retrato, una foto de pareja, una foto familiar o una imagen de tu mascota.",
  "un oscuro entorno con glowing pumpkins es útil para atmospheric corto vídeo, transitions, o motion-led de temporada contenido.": "Un entorno oscuro con calabazas iluminadas es útil para vídeos breves y atmosféricos, transiciones o contenido de temporada con movimiento.",
  "compromiso momento, celebración imagen, y boda fecha.": "momento del compromiso, imagen de la celebración y fecha de la boda.",
  "Halloween: fotos y vídeos con IA | AIdreamshoots": "Halloween: fotos y vídeos con IA | AIdreamshoots",
  "Ideas de halloween con IA": "Ideas de Halloween con IA",
  "Usa fotos propias o autorizadas, revisa los detalles y conserva tus resultados de halloween en tu espacio privado.": "Usa fotos propias o autorizadas, revisa los detalles y conserva tus resultados de Halloween en tu espacio privado.",
  "redes publicaciones y de temporada contenido campaigns": "Campañas de contenido para publicaciones de temporada y redes sociales",
  "disfraz fiesta retrato": "Retrato de fiesta con disfraz",
  "pareja cosplay transformación": "Transformación de pareja con disfraces",
  "mascota disfraz retrato": "Retrato de mascota con disfraz",
  "Pumpkin-face retrato": "Retrato con maquillaje de calabaza",
  "tierno baby o familia disfraz escena": "Escena tierna de bebé o familia con disfraces",
  "cinematografico pumpkin night": "Noche de calabazas con estilo cinematográfico",
  "horizontal 16:9": "Formato horizontal 16:9",
  "selecciona un focused foto conjunto": "Selecciona un conjunto de fotos nítidas y coherentes",
  "unñade nombres y fecha con un readable hierarchy": "Añade nombres y fecha con una jerarquía visual legible",
  "Candlelit cena": "Cena a la luz de las velas",
  "propuesta recap": "Resumen de la propuesta",
  "Candlelit fecha revelación": "Revelación de la fecha a la luz de las velas",
  "Explora Valentine's dia Estilos": "Explora estilos de San Valentín",
  "Elegir un San Valentín guardar la fecha historia": "Elige una historia de San Valentín para guardar la fecha",
  "Privado guest vista previa": "Vista previa privada para invitados",
  "Proofread con un segundo pair de eyes": "Revisión final con una segunda mirada",
  "revelación la suite": "Explorar la colección de invitaciones",
  "invitación suite revelación": "Revelación de la invitación",
  "Generación de vídeo con IA boda invitación": "Generación de vídeo con IA para una invitación de boda",
  "Revisar un privado draft": "Revisar un borrador privado",
  "Revisar la terminados vídeo privately antes sending lo para invitados o posting lo.": "Revisa el vídeo terminado en privado antes de enviarlo a los invitados o publicarlo.",
  "detalles debe ser checked antes compartir.": "Los detalles deben comprobarse antes de compartirlos.",
  "invitación vídeo JOBS": "Ideas de vídeo para invitaciones",
  "Generación de vídeo con IA boda invitación": "Vídeos con IA para invitaciones de boda",
  "Provide": "Incluye",
  "revisa": "Revisa"
};

const faqQuestions = [
  "¿Cuándo se descuentan los créditos?",
  "¿Qué fotos funcionan mejor?",
  "¿Puedo probar estilos distintos?",
  "¿Dónde veo mis álbumes?"
];
const faqAnswers = [
  "Los créditos se reservan cuando confirmas una generación. Si el pedido falla, el saldo se devuelve según el estado del trabajo.",
  "Sube fotos nítidas y autorizadas de las personas, el lugar y los detalles que quieras incluir en la historia.",
  "Sí. Puedes elegir distintos paquetes y estilos, y revisar el coste antes de empezar.",
  "Los resultados aparecen en tu espacio privado, junto con los favoritos, el historial de pedidos y las descargas."
];

function deepClone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function replaceCopy(value) {
  if (Array.isArray(value)) return value.map(replaceCopy);
  if (!value || typeof value !== "object") {
    if (typeof value !== "string") return value;
    if (Object.hasOwn(copyReplacements, value)) return copyReplacements[value];
    return value
      .replaceAll("unño", "año")
      .replaceAll("díun", "día")
      .replaceAll("galeríun", "galería")
      .replaceAll("unñade", "añade");
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceCopy(child)]));
}

function sectionSettings(page, suffix) {
  const entry = Object.entries(page.sections ?? {}).find(([key]) => key.endsWith(suffix));
  return entry?.[1]?.settings;
}

function repairStandardPage(input, profile, route) {
  const page = replaceCopy(deepClone(input));
  page.seo = {
    ...(page.seo ?? {}),
    index: true,
    follow: true,
    robots: { index: true, follow: true },
    title: profile.title,
    description: profile.description,
    keywords: profile.keywords,
    canonicalPath: route
  };

  const hero = sectionSettings(page, "_hero");
  if (hero) {
    hero.title = profile.h1;
    hero.intro = profile.intro;
    hero.subtitle = profile.intro;
    hero.eyebrow = profile.eyebrow;
    hero.primaryCta = profile.primaryCta;
    hero.secondaryCta = profile.secondaryCta;
    if (typeof hero.support === "string") hero.support = `Usa fotos propias o autorizadas y revisa todos los detalles de tu ${profile.topic} antes de compartirlo.`;
  }

  for (const [key, section] of Object.entries(page.sections ?? {})) {
    const settings = section?.settings;
    if (!settings || typeof settings !== "object") continue;
    if (key.endsWith("_faq")) {
      settings.title = "Preguntas frecuentes";
      for (const [index, block] of (section.blocks ?? []).entries()) {
        const blockSettings = block?.settings;
        if (!blockSettings) continue;
        const faqIndex = index % faqQuestions.length;
        if (typeof blockSettings.question === "string") blockSettings.question = faqQuestions[faqIndex];
        if (typeof blockSettings.answer === "string") blockSettings.answer = faqAnswers[faqIndex];
      }
    }
    if (key.endsWith("_definition")) settings.title = `¿Qué es un generador de fotos y vídeos de ${profile.topic} con IA?`;
    if (key.endsWith("_workflow")) settings.title = "Cómo funciona";
    if (key.endsWith("_use_cases")) settings.title = "Casos de uso";
    if (key.endsWith("_scene_ideas") || key.endsWith("_photo_ideas") || key.endsWith("_video_ideas")) {
      settings.title = `Ideas de escenas de ${profile.topic} con IA`;
    }
    if (key.endsWith("_formats")) settings.title = `Formatos para ${profile.topic}`;
    if (key.endsWith("_quality")) settings.title = `Cómo revisar la calidad del contenido de ${profile.topic}`;
    if (key.endsWith("_final_cta")) {
      settings.title = `Crea contenido de ${profile.topic} con tus fotos`;
      settings.primaryCta = profile.primaryCta;
      settings.secondaryCta = profile.secondaryCta;
    }
  }
  return page;
}

function repairWeddingInvitationPage(input) {
  const page = replaceCopy(deepClone(input));
  const seo = {
    index: true,
    follow: true,
    robots: { index: true, follow: true },
    title: "Invitación de boda: fotos y vídeos con IA | AIdreamshoots",
    description: "Crea fotos y vídeos para una invitación de boda con IA, revisa cada detalle y conserva el resultado en una galería privada.",
    keywords: "invitación de boda,fotos con IA,vídeos con IA,papelería de boda,AIdreamshoots",
    canonicalPath: publicWeddingInvitationPath,
    canonical: `https://aidreamshoots.eu${publicWeddingInvitationPath}`,
    ogImage: page.seo?.ogImage
  };
  page.seo = { ...(page.seo ?? {}), ...seo };
  const content = page.sections?.ai_video_topic_landing_1?.settings?.content;
  assert(content && typeof content === "object", "Wedding invitation topic content is missing.");
  content.seo = {
    ...(content.seo ?? {}),
    title: "Invitación de boda: fotos y vídeos con IA | AIdreamshoots",
    description: seo.description,
    keywords: seo.keywords,
    canonicalPath: publicWeddingInvitationPath,
    canonical: seo.canonical
  };
  content.hero = {
    ...content.hero,
    eyebrow: "Invitaciones de boda con IA",
    title: "Crea fotos y vídeos para una invitación de boda con IA",
    body: "Convierte tus fotos en una historia de invitación de boda, revisa cada detalle y guarda el resultado en una galería privada.",
    primaryCta: "Crear mi invitación de boda",
    secondaryCta: "Ver precios",
    imageNote: "Prepara una invitación de boda visual desde tus fotos y revisa nombres, fecha y lugar antes de compartirla."
  };
  content.steps = {
    ...content.steps,
    eyebrow: "Cómo funciona",
    title: "Crea tu invitación de boda en pocos pasos",
    cta: "Crear mi invitación de boda",
    items: [
      { title: "Sube tus fotos", body: "Elige retratos nítidos, detalles de papelería y fotos del lugar." },
      { title: "Define el estilo", body: "Indica el ambiente, los colores y el tipo de invitación que quieres crear." },
      { title: "Confirma los créditos", body: "Revisa el coste y confirma la generación cuando todo esté listo." },
      { title: "Revisa el resultado", body: "Comprueba nombres, fecha, lugar, rostros y composición antes de compartir." }
    ]
  };
  content.value = {
    ...content.value,
    eyebrow: "Ventajas",
    title: "Una invitación de boda con una dirección visual clara",
    intro: "Combina fotos de la pareja, papelería y detalles del lugar para contar la historia de tu boda con coherencia.",
    items: [
      { ...(content.value?.items?.[0] ?? {}), title: "Una historia coherente", body: "Mantén unidos los retratos, la papelería y el ambiente de la celebración." },
      { ...(content.value?.items?.[1] ?? {}), title: "Detalles legibles", body: "Añade nombres, fecha y lugar de forma clara en la versión final." },
      { ...(content.value?.items?.[2] ?? {}), title: "Revisión antes de compartir", body: "Comprueba todos los elementos importantes antes de enviar la invitación." },
      { ...(content.value?.items?.[3] ?? {}), title: "Galería privada", body: "Guarda el resultado y el historial en tu espacio privado." }
    ]
  };
  content.trust = {
    ...content.trust,
    eyebrow: "Uso responsable",
    title: "Revisa la invitación antes de compartirla",
    intro: "Usa imágenes autorizadas y comprueba personas, nombres, fecha, lugar y contexto.",
    items: [
      { ...(content.trust?.items?.[0] ?? {}), title: "Permisos claros", body: "Usa fotos propias o autorizadas de la pareja y los invitados." },
      { ...(content.trust?.items?.[1] ?? {}), title: "Detalles correctos", body: "Comprueba rostros, texto, fecha, lugar y composición." },
      { ...(content.trust?.items?.[2] ?? {}), title: "Revisión completa", body: "Mira la invitación completa antes de descargarla o compartirla." },
      { ...(content.trust?.items?.[3] ?? {}), title: "Publicación responsable", body: "Comparte la invitación solo cuando esté lista." }
    ]
  };
  content.gallery = {
    ...content.gallery,
    eyebrow: "DETALLES DE LA INVITACIÓN",
    title: "Ideas para invitaciones de boda con IA",
    intro: "Explora escenas de papelería, pareja y recepción para crear una invitación de boda coherente.",
    items: (content.gallery?.items ?? []).map((item, index) => ({
      ...item,
      title: ["Diseños para la pareja", "Papelería y sobres", "Revisión final del texto", "Invitación digital", "Presentación en la recepción", "Preparación de los sobres"][index] ?? "Detalles de la invitación",
      body: "Combina este detalle visual con tus fotos para crear una invitación de boda clara y personal."
    }))
  };
  content.guidance = {
    ...content.guidance,
    eyebrow: "Guía de estilo",
    title: "Prepara mejores imágenes para tu invitación",
    intro: "Describe el ambiente y revisa la composición para que cada elemento importante sea fácil de identificar.",
    cards: (content.guidance?.cards ?? []).map((card, index) => ({
      ...card,
      title: ["Define la escena", "Elige el encuadre", "Marca el ritmo"][index] ?? card.title,
      body: ["Indica el ambiente, la ubicación y la relación entre la pareja y la papelería.", "Combina retratos, detalles de la invitación y planos del lugar sin perder información importante.", "Ordena los planos para que la historia avance de forma natural."][index] ?? card.body
    }))
  };
  content.useCases = {
    ...content.useCases,
    eyebrow: "Ideas de invitación",
    title: "Formas de presentar tu invitación de boda",
    intro: "Elige una dirección visual según el tipo de invitación y el momento en el que quieras compartirla.",
    items: (content.useCases?.items ?? []).map((item, index) => ({
      ...item,
      title: ["Presentación de la invitación", "Papelería de boda", "Vista previa privada para invitados"][index] ?? item.title,
      body: "Crea una composición de invitación de boda a partir de tus fotos y revisa todos los detalles.",
      problem: "Usa fotos propias o autorizadas y revisa la invitación completa antes de compartirla.",
      cta: ["Explorar ideas", "Empezar", "Revisar borrador privado"][index] ?? item.cta
    }))
  };
  content.foundation = {
    ...content.foundation,
    eyebrow: "Invitaciones de boda con IA",
    title: "Crea una invitación con una dirección visual clara",
    intro: "Combina retratos, papelería y detalles del lugar para preparar una invitación coherente.",
    leftTitle: "Incluye",
    rightTitle: "Revisa",
    expertTip: "Usa fotos propias o autorizadas y comprueba nombres, fecha, lugar y legibilidad antes de compartir.",
    leftItems: ["Fotos nítidas de la pareja", "Detalles de la papelería", "Ambiente del lugar de celebración"],
    rightItems: ["Rostros y manos", "Nombres, fecha y lugar", "Composición y legibilidad"]
  };
  content.faq = {
    ...content.faq,
    eyebrow: "Preguntas frecuentes",
    title: "Preguntas frecuentes sobre invitaciones de boda",
    items: [
      { question: "¿Qué fotos debo subir?", answer: "Sube fotos nítidas y autorizadas de la pareja, la papelería o el lugar de la boda." },
      { question: "¿Cuándo se descuentan los créditos?", answer: "Los créditos se reservan cuando confirmas una generación; revisa el coste antes de empezar." },
      { question: "¿Puedo revisar el resultado antes de compartirlo?", answer: "Sí. Revisa rostros, nombres, fecha, lugar y composición antes de descargar o compartir." },
      { question: "¿Dónde se guarda la invitación?", answer: "El resultado se guarda en tu galería privada de AIdreamshoots junto con tu historial." }
    ]
  };
  content.finalCta = {
    ...content.finalCta,
    eyebrow: "Listo para crear",
    title: "Crea tu invitación de boda con tus fotos",
    body: "Prepara tus imágenes, elige el estilo y revisa todos los detalles antes de compartir la invitación.",
    cta: "Empezar ahora",
    microcopy: "Usa imágenes propias o autorizadas y revisa el resultado final."
  };
  return page;
}

function collectImageAlts(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageAlts(item, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const hasImageUrl = Object.entries(value).some(([key, child]) => ["src", "imageUrl", "url"].includes(key) && typeof child === "string" && /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(child));
  if (hasImageUrl) {
    for (const key of ["alt", "imageAlt"]) if (typeof value[key] === "string") output.push(value[key]);
  }
  Object.values(value).forEach((child) => collectImageAlts(child, output));
  return output;
}

function assertDescriptiveAlts(value, slug) {
  const alts = collectImageAlts(value);
  assert(alts.length > 0, `No image alts found for ${slug}.`);
  for (const alt of alts) {
    assert(alt.trim().length >= 30, `Image alt is too short for ${slug}: ${alt}`);
    assert(!/^(?:Ejemplo visual|Contenido de|Imagen generada|Foto generada|Vídeo generado)\b/i.test(alt.trim()), `Generic image alt found for ${slug}: ${alt}`);
  }
}

function contentFieldStrings(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => contentFieldStrings(item, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (["title", "intro", "subtitle", "support", "body", "text", "question", "answer", "label", "eyebrow", "primaryCta", "secondaryCta", "imageNote", "description", "heading", "note", "caption", "problem", "cta", "leftTitle", "rightTitle", "expertTip"].includes(key) && typeof child === "string") output.push(child);
    contentFieldStrings(child, output);
  }
  return output;
}

function diffPaths(left, right, prefix = "", output = []) {
  if (Object.is(left, right)) return output;
  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) diffPaths(left[index], right[index], `${prefix}.${index}`, output);
    return output;
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) diffPaths(left[key], right[key], prefix ? `${prefix}.${key}` : key, output);
    return output;
  }
  output.push({ path: prefix, before: left, after: right });
  return output;
}

function jsonEquivalent(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => jsonEquivalent(item, right[index]));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && jsonEquivalent(left[key], right[key]));
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  assertNonProductionWriteTarget();
  const shouldApply = String(process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1] ?? "") === confirmation;

  const prisma = new PrismaClient();
  try {
    const [themePages, livePages] = await Promise.all([
      prisma.themePage.findMany({ where: { siteId, slug: { in: allSlugs } }, select: { id: true, slug: true, draftJson: true, publishedJson: true }, orderBy: { slug: "asc" } }),
      prisma.livePage.findMany({ where: { siteId, slug: { in: allSlugs } }, select: { id: true, slug: true, contentJson: true }, orderBy: { slug: "asc" } })
    ]);
    assert.equal(themePages.length, allSlugs.length, "The target ThemePage count changed.");
    assert.equal(livePages.length, allSlugs.length, "The target LivePage count changed.");

    const themeBySlug = new Map(themePages.map((page) => [page.slug, page]));
    const liveBySlug = new Map(livePages.map((page) => [page.slug, page]));
    const repairedTheme = new Map();
    const repairedLive = new Map();
    for (const slug of allSlugs) {
      const route = slug === weddingInvitationSourceSlug ? publicWeddingInvitationPath : slug;
      const repair = (value) => slug === weddingInvitationSourceSlug
        ? repairWeddingInvitationPage(value)
        : repairStandardPage(value, profiles[slug], route);
      const theme = themeBySlug.get(slug);
      const live = liveBySlug.get(slug);
      const publishedJson = repair(theme.publishedJson);
      const draftJson = theme.draftJson ? repair(theme.draftJson) : theme.draftJson;
      const contentJson = repair(live.contentJson);
      assertDescriptiveAlts(publishedJson, slug);
      assertDescriptiveAlts(contentJson, slug);
      repairedTheme.set(slug, { ...theme, publishedJson, draftJson });
      repairedLive.set(slug, { ...live, contentJson });
    }

    const changedTheme = themePages.filter((page) => !jsonEquivalent(page.publishedJson, repairedTheme.get(page.slug).publishedJson) || !jsonEquivalent(page.draftJson, repairedTheme.get(page.slug).draftJson)).length;
    const changedLive = livePages.filter((page) => !jsonEquivalent(page.contentJson, repairedLive.get(page.slug).contentJson)).length;
    const changedThemeSlugs = themePages.filter((page) => !jsonEquivalent(page.publishedJson, repairedTheme.get(page.slug).publishedJson) || !jsonEquivalent(page.draftJson, repairedTheme.get(page.slug).draftJson)).map((page) => page.slug);
    const changedLiveSlugs = livePages.filter((page) => !jsonEquivalent(page.contentJson, repairedLive.get(page.slug).contentJson)).map((page) => page.slug);
    const residuals = [...repairedTheme.values()].flatMap((page) => contentFieldStrings(page.publishedJson)).filter((value) => /\b(?:unño|díun|galeríun|Just|Pretty|Nearby|Responsibly|Beginnings|Maker|mother's|Candlelit|focused|readable|Setup|variety|shape|continuity|Greeting|Harvest|Pet-friendly|Outdoor|Cozy|Countdown|Smartphone|Multi-generational|jewelry|still life|Woodworking|hands-on|Backyard|toast|inspiration|appreciation|barbecue|including|Proofread|pair of eyes|unñade|accion de gracias|nuevo unño|padre dia|madre's dia)\b/i.test(value));
    assert.equal(residuals.length, 0, `Residual malformed or mixed-language copy remains: ${residuals.slice(0, 5).join(" | ")}`);

    if (!shouldApply) {
      const weddingDiff = changedThemeSlugs.includes(weddingInvitationSourceSlug)
        ? diffPaths(themeBySlug.get(weddingInvitationSourceSlug).publishedJson, repairedTheme.get(weddingInvitationSourceSlug).publishedJson).slice(0, 8)
        : [];
      console.log(JSON.stringify({ ok: true, mode: "dry-run", pages: allSlugs.length, changedTheme, changedLive, changedThemeSlugs, changedLiveSlugs, weddingDiff, imageAltPolicy: "validated and preserved", paidProviderCalls: 0 }, null, 2));
      return;
    }

    fs.mkdirSync(backupDirectory, { recursive: true });
    const backupPath = path.join(backupDirectory, `seo-copy-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, themePages, livePages }, null, 2)}\n`, { mode: 0o600 });

    await prisma.$transaction(async (tx) => {
      for (const page of repairedTheme.values()) {
        await tx.themePage.update({ where: { id: page.id }, data: { draftJson: page.draftJson, publishedJson: page.publishedJson } });
      }
      for (const page of repairedLive.values()) {
        await tx.livePage.update({ where: { id: page.id }, data: { contentJson: page.contentJson } });
      }
    });

    const readback = await prisma.themePage.findMany({ where: { siteId, slug: { in: allSlugs } }, select: { slug: true, publishedJson: true }, orderBy: { slug: "asc" } });
    for (const page of readback) {
      assertDescriptiveAlts(page.publishedJson, page.slug);
      if (page.slug === weddingInvitationSourceSlug) assert.equal(page.publishedJson.seo.canonicalPath, publicWeddingInvitationPath);
    }
    console.log(JSON.stringify({ ok: true, mode: "applied", pages: allSlugs.length, changedTheme, changedLive, backupPath, imageAltPolicy: "validated and preserved", paidProviderCalls: 0 }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

export {
  copyReplacements,
  profiles,
  repairStandardPage,
  repairWeddingInvitationPage,
  assertDescriptiveAlts
};

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
