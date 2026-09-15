#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const batchId = "aidreamshoots-other-topics-20260914-v1";
const manifestPath = path.resolve(`.tmp/aidreamshoots-other-topic-regeneration/${batchId}/manifest.json`);
const publicPrefix = `/assets/sites/site_aidreamshoots/generated/regenerated/${batchId}/`;
const siteId = "site_mydreamshoots_xby";
const confirmation = "aidreamshoots-other-topic-alt-repair";
const imageKeys = new Set(["src", "poster", "imageUrl", "url"]);
const imagePattern = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;
const videoPattern = /\.(?:mp4|webm|mov)(?:[?#]|$)/i;

const topicSlugs = [
  "brand-video", "cinematic-video", "explainer-video", "fashion-video", "food-video",
  "how-to-video", "instagram-reels", "meme-video", "music-video", "pet-video",
  "product-ad-video", "product-video", "promo-video", "social-media-video", "story-video",
  "talking-head-video", "tiktok-video", "ugc-ad-video", "video-ad", "youtube-video"
];

// These descriptions are tied to the source-scene order captured in the generation manifest.
// They describe the pictured action or setting instead of repeating the page title or slot number.
const sceneAltText = {
  "brand-video": [
    "Persona fundadora contando el origen de una marca en un taller creativo iluminado con luz natural.",
    "Artesana adulta trabajando una pieza en su taller, con herramientas y materiales visibles alrededor.",
    "Pequeño equipo de colaboradores reunido en un estudio luminoso durante una conversación de trabajo.",
    "Clientes y comunidad compartiendo un momento cercano en un espacio de encuentro de la marca.",
    "Producto artesanal presentado sobre una mesa de madera con objetos que refuerzan su identidad visual.",
    "Persona adulta demostrando los valores de una marca mediante una actividad práctica y colaborativa.",
    "Persona adulta atendiendo un puesto de marca en una instalación temporal con colores llamativos.",
    "Grupo diverso participando en una experiencia cultural de marca dentro de un espacio cálido."
  ],
  "cinematic-video": [
    "Persona adulta en una escena de película con iluminación dramática y composición visual cuidada.",
    "Detective adulto avanzando por un callejón mojado durante la noche, rodeado de luces urbanas.",
    "Automóvil de lujo presentado en una carretera nocturna con reflejos y luz cinematográfica.",
    "Músico adulto actuando bajo un foco en un escenario oscuro con atmósfera de concierto.",
    "Persona adulta dentro de una cámara futurista iluminada por energía azul en un entorno de ciencia ficción.",
    "Personaje adulto en una mansión de época iluminada por velas y sombras cálidas.",
    "Fundador adulto contando la historia de su proyecto en un estudio con iluminación de cine."
  ],
  "explainer-video": [
    "Especialista adulto presentando un concepto de producto junto a un objeto sobre una mesa de estudio.",
    "Analista adulta explicando datos mediante formas visuales y tarjetas ordenadas sobre una mesa.",
    "Experta adulta explicando una idea frente a una mesa de demostración en un entorno profesional.",
    "Especialista mostrando una plataforma digital en un espacio de trabajo con pantalla sin texto legible.",
    "Manos adultas ordenando materiales para explicar un flujo de trabajo paso a paso.",
    "Analista adulta señalando relaciones entre datos representados con formas y tarjetas sin texto legible.",
    "Docente adulta compartiendo conocimientos en un aula luminosa con materiales de aprendizaje.",
    "Persona adulta explorando un concepto tecnológico con objetos luminosos en un estudio oscuro.",
    "Estratega de negocios explicando una planificación sobre una mesa con notas no legibles.",
    "Especialista guiando un recorrido de usuario con objetos ordenados en un escritorio de trabajo.",
    "Persona adulta explicando un tema junto a una pizarra sin escritura legible."
  ],
  "fashion-video": [
    "Modelo adulta presentando un conjunto de moda editorial en un estudio de iluminación suave.",
    "Modelo adulta mostrando el detalle de una prenda con textura visible en un encuadre cercano.",
    "Modelo adulta caminando por una pasarela con iluminación de desfile y fondo minimalista.",
    "Modelo adulta avanzando por una pasarela mientras presenta una colección contemporánea.",
    "Modelo adulta posando en un estudio para un lookbook de moda con estilismo cuidado.",
    "Estilista adulta ajustando una prenda sobre una modelo durante una prueba de vestuario.",
    "Diseñadora adulta tocando una muestra de tejido en una mesa de trabajo de moda.",
    "Modelo adulta mostrando un accesorio de moda en un retrato editorial de detalle.",
    "Dos modelos adultas presentando juntas una combinación de prendas en un estudio de moda.",
    "Modelo adulta recorriendo una calle urbana con un conjunto de estilo contemporáneo.",
    "Equipo adulto preparando una producción de campaña de moda en un estudio profesional."
  ],
  "food-video": [
    "Creadora adulta preparando un plato en una cocina luminosa con ingredientes frescos a la vista.",
    "Cocinera adulta colocando con cuidado un plato terminado sobre una mesa de presentación.",
    "Chef adulto trabajando una preparación caliente en la cocina, con vapor y utensilios alrededor.",
    "Manos adultas cortando y organizando ingredientes frescos sobre una tabla de cocina.",
    "Creadora adulta ajustando una cámara frente a una mesa preparada para grabar una receta.",
    "Persona adulta vertiendo una salsa sobre un plato servido en un encuadre cercano.",
    "Estilista gastronómica adulta organizando un plato atractivo para una sesión de fotografía.",
    "Ingredientes frescos distribuidos sobre una mesa vistos desde arriba, listos para cocinar.",
    "Persona adulta terminando la presentación de un plato con utensilios de cocina alrededor.",
    "Personal adulto sirviendo un plato en un restaurante de ambiente cálido.",
    "Persona adulta sirviendo una bebida en un vaso sobre una mesa de cafetería."
  ],
  "how-to-video": [
    "Persona adulta demostrando un paso práctico con las manos y materiales ordenados sobre una mesa.",
    "Instructora adulta mostrando un tutorial junto a un ordenador con la pantalla sin texto legible.",
    "Manos adultas realizando una demostración desde una vista superior con herramientas organizadas.",
    "Persona adulta preparando herramientas y materiales antes de comenzar una demostración práctica.",
    "Instructora adulta revisando materiales de seguridad antes de iniciar un proceso paso a paso.",
    "Manos adultas siguiendo una secuencia ordenada de pasos sobre una mesa de trabajo luminosa.",
    "Persona adulta realizando una acción manual en un plano cercano con herramientas y textura visibles.",
    "Persona adulta recorriendo un proceso de software en un ordenador con interfaz no legible.",
    "Instructora adulta midiendo y comprobando un resultado en una mesa de trabajo.",
    "Persona adulta mostrando el resultado antes y después de completar una tarea práctica."
  ],
  "instagram-reels": [
    "Creadora adulta preparando un Reel en un estudio casero con cámara y accesorios de grabación.",
    "Creadora adulta mostrando una transformación visual entre un estado inicial y un resultado final.",
    "Presentadora adulta enseñando una habilidad breve frente a una cámara en un espacio luminoso.",
    "Creadora adulta preparando una grabación detrás de cámaras dentro de un estudio creativo.",
    "Creadora adulta mostrando un conjunto editorial en una calle urbana para un Reel de estilo.",
    "Creadora adulta celebrando un lanzamiento en un espacio decorado con iluminación festiva.",
    "Presentadora adulta demostrando un producto sin marca frente a la cámara en un entorno cotidiano."
  ],
  "meme-video": [
    "Persona adulta reaccionando con sorpresa ante una avalancha de mensajes en un espacio de trabajo.",
    "Perro doméstico mirando a su dueña en una escena que contrasta las expectativas con la realidad.",
    "Persona adulta reaccionando con humor ante un pequeño cambio solicitado por su jefe.",
    "Persona adulta frente a una impresora que no responde, en una situación cotidiana y divertida.",
    "Persona adulta aceptando otra pequeña revisión en un escritorio de trabajo con gesto resignado.",
    "Persona adulta intentando empezar el día con café en una cocina doméstica luminosa."
  ],
  "music-video": [
    "Artista adulta preparando una propuesta visual para una canción en un estudio de producción.",
    "Vocalista adulta cantando ante un micrófono de estudio bajo luces rojas y azules.",
    "Artista adulta actuando en un escenario íntimo con iluminación de concierto y ambiente expresivo.",
    "Músico adulto explorando un motivo visual abstracto en un set de colores intensos.",
    "Banda adulta actuando en un escenario con focos y atmósfera de concierto en directo.",
    "Artista adulta grabando una interpretación con su teléfono en un espacio creativo personal.",
    "Equipo adulto ajustando una cámara y luces para grabar una actuación musical.",
    "Equipo adulto construyendo un decorado práctico para una producción de vídeo musical.",
    "Artista adulta preparándose con estilismo cuidado antes de una actuación musical.",
    "Dos músicos adultos interpretando juntos una canción en un escenario iluminado.",
    "Vocalista adulta cantando en un primer plano expresivo durante una actuación.",
    "Artista adulta presentándose ante el público en un escenario con iluminación de concierto."
  ],
  "pet-video": [
    "Persona adulta corriendo con un perro amistoso por un paisaje exterior iluminado por el sol.",
    "Persona adulta cepillando a un perro dorado en una escena doméstica cálida y tranquila.",
    "Profesional veterinaria adulta revisando a un perro acompañado por su dueña en una clínica luminosa.",
    "Persona adulta jugando con un gato atigrado en una sala de estar luminosa.",
    "Persona adulta paseando con su perro por una calle urbana arbolada.",
    "Persona adulta sirviendo comida a un perro en un espacio doméstico ordenado.",
    "Persona adulta enseñando una orden a un perro durante una sesión de entrenamiento al aire libre.",
    "Persona adulta acariciando a su perro en un momento de vínculo cercano dentro de casa.",
    "Persona adulta compartiendo una actividad al aire libre con su perro en un entorno natural.",
    "Persona adulta cuidando a una mascota durante una rutina cotidiana en casa.",
    "Persona adulta y su mascota disfrutando de un momento tranquilo juntos en el hogar."
  ],
  "product-ad-video": [
    "Presentadora adulta mostrando un producto sin marca en una escena centrada en una decisión de compra.",
    "Persona adulta usando un producto de cuidado personal en un baño luminoso y ordenado.",
    "Persona adulta presentando unas zapatillas nuevas en una escena de lanzamiento de producto.",
    "Persona adulta resolviendo una tarea de limpieza con un producto mostrado en primer plano.",
    "Persona adulta demostrando unos auriculares mientras explica su beneficio en un entorno cotidiano.",
    "Persona adulta reaccionando ante una oferta limitada en una escena de compra con iluminación comercial.",
    "Persona adulta comparando dos opciones de producto sobre una mesa antes de comprar.",
    "Persona adulta recordando una compra pendiente mientras observa un producto en casa."
  ],
  "product-video": [
    "Producto de consumo sin marca presentado en un estudio comercial con iluminación limpia y precisa.",
    "Equipo adulto preparando un flujo de producción de producto sobre una mesa de estudio.",
    "Persona adulta mostrando el tamaño de una mochila junto a otros objetos cotidianos.",
    "Primer plano de unos auriculares sin marca con atención a sus materiales y acabados.",
    "Persona adulta usando una cafetera en una cocina doméstica durante su funcionamiento habitual.",
    "Persona adulta demostrando una función de un reloj inteligente sin texto legible en la pantalla.",
    "Persona adulta abriendo una caja y mostrando el contenido de un producto sin marca.",
    "Zapatillas sin marca presentadas en un entorno de comercio electrónico con composición limpia."
  ],
  "promo-video": [
    "Persona adulta presentando un adelanto de lanzamiento con iluminación promocional y ambiente dinámico.",
    "Presentadora adulta mostrando un producto nuevo en una escena de presentación comercial.",
    "Persona adulta comunicando una oferta de tiempo limitado en un espacio de venta iluminado.",
    "Persona adulta anunciando un evento ante un escenario preparado para una conferencia.",
    "Persona adulta mostrando una novedad en un ordenador durante una escena de lanzamiento.",
    "Persona adulta preparando una campaña estacional en un espacio comercial decorado.",
    "Creadora adulta preparando una grabación promocional con cámara, luces y accesorios.",
    "Persona adulta reaccionando ante una promoción en un entorno de tienda contemporáneo.",
    "Persona adulta atendiendo una activación de marca en un puesto temporal para visitantes."
  ],
  "social-media-video": [
    "Creadora adulta preparando una pieza breve para redes sociales con cámara y luz natural.",
    "Equipo adulto preparando una campaña de lanzamiento en un estudio creativo.",
    "Creadora adulta mostrando una transformación visual de un estado inicial a un resultado final.",
    "Creadora adulta grabando contenido detrás de cámaras en un espacio de producción.",
    "Persona adulta demostrando un producto sin marca en una escena de prueba para redes sociales.",
    "Equipo adulto pensando una historia para redes sociales en una mesa de trabajo compartida.",
    "Creadora adulta anunciando un lanzamiento ante una decoración festiva y colorida."
  ],
  "story-video": [
    "Persona adulta restaurando una biblioteca antigua en una escena narrativa de luz cálida.",
    "Persona adulta cerrando una biblioteca al atardecer mientras las luces interiores comienzan a encenderse.",
    "Manos adultas organizando un plano y documentos de archivo sobre una mesa de trabajo.",
    "Persona adulta buscando un libro de contabilidad perdido en una sala de archivo silenciosa.",
    "Persona adulta abriendo un armario de llaves durante un momento decisivo de la historia.",
    "Comunidad adulta reunida en el patio de una biblioteca recién reabierta.",
    "Dos personas adultas compartiendo un recuerdo alrededor de una mesa de lectura.",
    "Biblioteca cerrada y cubierta de polvo presentada como el origen de una historia.",
    "Personas adultas transportando cajas de archivo durante un viaje de recuperación.",
    "Persona adulta reparando una ventana de biblioteca en una escena de regreso y esperanza.",
    "Encuadernador adulto trabajando en un pequeño documental dentro de su taller.",
    "Grupo de personas adultas catalogando libros y documentos en una biblioteca comunitaria.",
    "Persona adulta ante la puerta cerrada de una sala de archivo con ambiente de misterio."
  ],
  "talking-head-video": [
    "Presentadora adulta hablando a cámara en un estudio profesional con iluminación suave.",
    "Directivo adulto comunicando un mensaje de trabajo desde un despacho contemporáneo.",
    "Presentadora adulta grabando contenido social frente a una cámara en un espacio luminoso.",
    "Fundador adulto compartiendo un mensaje de empresa en un entorno de trabajo.",
    "Instructora adulta explicando una lección frente a una mesa de formación.",
    "Especialista adulta compartiendo una idea de marketing desde un estudio de presentación.",
    "Presentador adulto introduciendo un producto sin marca ante una cámara de estudio.",
    "Presentadora adulta hablando desde un despacho doméstico preparado para una videollamada.",
    "Equipo adulto preparando una cámara y un teleprompter para grabar una presentación.",
    "Presentador adulto grabando un mensaje breve para redes sociales con encuadre cercano.",
    "Presentador adulto hablando en un estudio de producción de vídeo con identidad de marca."
  ],
  "tiktok-video": [
    "Creadora adulta preparando un vídeo corto para TikTok con cámara y accesorios coloridos.",
    "Creadora adulta contando una historia breve en una calle mojada iluminada por luces nocturnas.",
    "Profesor adulto explicando una lección breve junto a una pizarra sin texto legible.",
    "Persona adulta contando una experiencia personal en un retrato cercano y expresivo.",
    "Oradora adulta compartiendo una idea desde un escenario durante un evento.",
    "Fundador adulto demostrando un producto sin marca en un vídeo corto para redes sociales.",
    "Creadora adulta presentando una oferta estacional con regalos y decoración festiva."
  ],
  "ugc-ad-video": [
    "Creadora adulta presentando un producto cosmético sin marca en un vídeo grabado en casa.",
    "Dos personas adultas conversando mientras graban una recomendación de producto auténtica.",
    "Creadora adulta abriendo una caja y compartiendo su primera impresión de un producto.",
    "Creadora adulta comentando un producto sin marca directamente a cámara en un entorno cotidiano.",
    "Creadora adulta demostrando un producto de cocina mientras prepara una receta en casa.",
    "Creadora adulta probándose una prenda y mostrando el resultado ante la cámara.",
    "Creadora adulta organizando puntos de conversación antes de grabar una recomendación.",
    "Creadora adulta grabando con el teléfono una demostración de un producto gastronómico."
  ],
  "video-ad": [
    "Creador adulto grabando un anuncio con teléfono y trípode en un espacio de trabajo.",
    "Persona adulta observando productos en una escena de compra pensada para comercio electrónico.",
    "Editora adulta organizando variantes de un anuncio en una estación de trabajo.",
    "Creadora adulta grabando una recomendación con cámara en un entorno doméstico.",
    "Especialista adulta revisando métricas de rendimiento de una campaña en un escritorio.",
    "Equipo adulto fotografiando un producto en un estudio comercial con luces controladas.",
    "Anuncio de producto preparado para aparecer en el feed de una red social.",
    "Persona adulta viendo un contenido comercial en el teléfono durante una situación cotidiana."
  ],
  "youtube-video": [
    "Presentador adulto explicando un tema ante una cámara en un estudio de YouTube.",
    "Presentador adulto grabando un vídeo de YouTube con encuadre de estudio y fondo cuidado.",
    "Creadora adulta mostrando un producto mientras ayuda a la audiencia a elegir entre opciones.",
    "Dos personas adultas conversando en una entrevista grabada para un canal de YouTube.",
    "Presentador adulto conectando un contexto inicial con una demostración y un resultado práctico.",
    "Presentadora adulta guiando un tutorial de larga duración desde un estudio luminoso.",
    "Presentador adulto preparando el siguiente episodio de una serie frente a la cámara."
  ]
};

function collectVideoRefs(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectVideoRefs(item, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (["src", "poster", "url"].includes(key) && typeof child === "string" && videoPattern.test(child)) output.push(child);
    collectVideoRefs(child, output);
  }
  return output;
}

function rewriteImageAlts(value, replacements) {
  if (Array.isArray(value)) return value.map((item) => rewriteImageAlts(item, replacements));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) output[key] = rewriteImageAlts(child, replacements);
  for (const key of imageKeys) {
    const sourceUrl = typeof value[key] === "string" ? value[key] : "";
    if (!sourceUrl || !imagePattern.test(sourceUrl)) continue;
    const replacement = replacements.get(sourceUrl);
    if (!replacement) continue;
    output[key] = replacement.publicUrl;
    if (typeof value.alt === "string") output.alt = replacement.altText;
  }
  return output;
}

function assertValidAlt(value) {
  assert(typeof value === "string", "Every generated image must have alt text.");
  assert(value.length >= 30 && value.length <= 150, `Alt text length is outside 30-150 characters: ${value}`);
  assert(!/variaci[oó]n|ejemplo visual|creado con ia|fotos propias|resultados de/i.test(value), `Alt text remains templated: ${value}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.mode, "applied", "The image batch must already be applied before alt repair.");
assert.equal(manifest.tasks.length, 180, "The applied batch must contain 180 image tasks.");
assert(sceneAltText && Object.keys(sceneAltText).length === topicSlugs.length, "Every topic needs scene alt text.");
for (const slug of topicSlugs) {
  const tasks = manifest.tasks.filter((task) => task.topicSlug === slug);
  assert.equal(tasks.length, sceneAltText[slug].length, `Scene alt count mismatch for ${slug}.`);
  tasks.forEach((task, index) => assertValidAlt(sceneAltText[slug][index]));
}

const replacements = new Map();
for (const task of manifest.tasks) {
  const altText = sceneAltText[task.topicSlug][task.slotIndex];
  replacements.set(task.sourceUrl, { publicUrl: task.publicUrl, altText });
  replacements.set(task.publicUrl, { publicUrl: task.publicUrl, altText });
}

assertDatabaseTarget({ expectedTarget: "local" });
assertNonProductionWriteTarget();
assert.equal(String(process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1] ?? ""), confirmation, `Run with --confirm=${confirmation}.`);

const prisma = new PrismaClient();
try {
  const pages = await prisma.livePage.findMany({
    where: { siteId, slug: { in: topicSlugs.map((slug) => `/ai-video-generation/${slug}`) } },
    select: { id: true, slug: true, contentJson: true },
    orderBy: { slug: "asc" }
  });
  assert.equal(pages.length, topicSlugs.length, "The target topic page count changed.");
  const beforeVideos = new Map(pages.map((page) => [page.slug, collectVideoRefs(page.contentJson)]));
  const touchedUrls = new Set();
  for (const page of pages) {
    const rewritten = rewriteImageAlts(page.contentJson, replacements);
    const serialized = JSON.stringify(rewritten);
    assert(!serialized.includes("variación"), `Templated alt text remains on ${page.slug}.`);
    await prisma.livePage.update({ where: { id: page.id }, data: { contentJson: rewritten } });
    for (const task of manifest.tasks.filter((candidate) => `/ai-video-generation/${candidate.topicSlug}` === page.slug)) touchedUrls.add(task.publicUrl);
  }

  await prisma.$transaction(async (tx) => {
    for (const task of manifest.tasks) {
      const altText = sceneAltText[task.topicSlug][task.slotIndex];
      await tx.mediaAsset.updateMany({
        where: { siteId, storageKey: task.outputRelative },
        data: { label: altText, altText }
      });
    }
  });

  const readback = await prisma.livePage.findMany({
    where: { siteId, slug: { in: topicSlugs.map((slug) => `/ai-video-generation/${slug}`) } },
    select: { slug: true, contentJson: true },
    orderBy: { slug: "asc" }
  });
  const readbackAlts = [];
  for (const page of readback) {
    const collect = (value) => {
      if (Array.isArray(value)) { value.forEach(collect); return; }
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (imageKeys.has(key) && typeof child === "string" && imagePattern.test(child) && child.startsWith(publicPrefix)) {
          assertValidAlt(value.alt);
          readbackAlts.push(value.alt);
        }
        collect(child);
      }
    };
    collect(page.contentJson);
    assert.deepEqual(collectVideoRefs(page.contentJson), beforeVideos.get(page.slug), `Video source changed: ${page.slug}`);
  }
  assert.equal(touchedUrls.size, 180);
  assert.equal(new Set(readbackAlts).size, 180, "Every generated source image must have a distinct scene alt.");
  for (const task of manifest.tasks) task.altText = sceneAltText[task.topicSlug][task.slotIndex];
  manifest.altRepair = {
    repairedAt: new Date().toISOString(),
    imageAssets: 180,
    pageImageReferences: readbackAlts.length,
    paidProviderCalls: 0,
    validation: "scene-specific Spanish alt text; no slot numbering or generic generation copy"
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, topics: pages.length, imageAssets: 180, pageImageReferences: readbackAlts.length, distinctAlts: new Set(readbackAlts).size, paidProviderCalls: 0, manifestPath }, null, 2));
} finally {
  await prisma.$disconnect();
}
