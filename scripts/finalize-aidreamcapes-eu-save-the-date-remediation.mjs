#!/usr/bin/env node

/**
 * Final, site-scoped publication migration for the 12 Aidreamcapes EU Save the
 * Date pages. This script never calls an image provider: it validates and
 * publishes the already-generated supplier assets that are present locally.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_ORIGIN = "https://aidreamcapes.eu";
const ROUTE_PREFIX = "/ai-save-the-date/";
const PUBLIC_ROOT = "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date";
const VENDOR_ROOT = `${PUBLIC_ROOT}/vendor-api-gpt-image-2-4k-v1`;
const LOCAL_PUBLIC_ROOT = path.resolve("public", PUBLIC_ROOT.slice(1));
const APPLY = process.argv.includes("--apply");

const commonManifest = JSON.parse(await fsPromises.readFile(new URL("./data/aidreamcapes-eu-save-the-date-vendor-manifest.json", import.meta.url), "utf8"));
const commonFrenchAlts = JSON.parse(await fsPromises.readFile(new URL("./data/aidreamcapes-eu-save-the-date-vendor-alt-fr.json", import.meta.url), "utf8"));
const invitationManifest = JSON.parse(await fsPromises.readFile(new URL("./data/aidreamcapes-eu-wedding-invitation-vendor-manifest.json", import.meta.url), "utf8"));

const valentineAssets = [
  ["hero-valentines-day-save-the-date-city-couple.jpg", "Couple fiancé en tenue de soirée élégante devant les lumières d'une ville au bord de l'eau."],
  ["hero-valentines-day-save-the-date-couple-candlelight.jpg", "Couple fiancé partageant un moment intime à la lumière des bougies pendant un dîner de Saint-Valentin."],
  ["hero-valentines-day-save-the-date-proposal.jpg", "Demande en mariage entourée de roses et de lumières chaudes pour une annonce de date de mariage de Saint-Valentin."],
  ["valentines-day-save-the-date-beach-couple.jpg", "Couple enlacé sur une plage au coucher du soleil pour une annonce romantique de date de mariage."],
  ["valentines-day-save-the-date-candlelight-dinner.jpg", "Couple fiancé trinquant au champagne et entouré de roses rouges lors d'un dîner aux chandelles."],
  ["valentines-day-save-the-date-celebration-hug.jpg", "Couple heureux s'enlaçant sous des lumières chaleureuses après avoir annoncé la date du mariage."],
  ["valentines-day-save-the-date-couple-planning.jpg", "Couple consultant ensemble ses préparatifs de mariage devant un ordinateur portable dans une ambiance chaleureuse de Saint-Valentin."],
  ["valentines-day-save-the-date-beach-walk.jpg", "Couple marchant main dans la main sur une plage au coucher du soleil près d'un cœur dessiné dans le sable."],
  ["valentines-day-save-the-date-heart-bokeh-couple.jpg", "Couple en tenue de soirée entouré de lumières en forme de cœur floutées pour une annonce de mariage."],
  ["valentines-day-save-the-date-invitation-envelope.jpg", "Couple tenant une enveloppe fermée scellée d'un cœur rouge pour annoncer la date du mariage."],
  ["valentines-day-save-the-date-rose-garden-couple.jpg", "Couple près d'une allée de roses éclairée par des lanternes pour une date de mariage romantique."]
];

const themeConfigs = {
  "valentines-day": {
    navLabel: "Saint-Valentin", subject: "la Saint-Valentin", keyword: "vidéo de Saint-Valentin avec IA",
    title: "Vidéo de Saint-Valentin avec IA | Aidreamcapes",
    description: "Créez une vidéo de Saint-Valentin avec IA pour annoncer une date de mariage grâce à des portraits de couple, une ambiance romantique et un message facile à vérifier.",
    keywords: "vidéo de Saint-Valentin avec IA, annonce de mariage romantique, vidéo Save the Date, création vidéo de couple, invitation de mariage romantique",
    h1: "Créer une vidéo de Saint-Valentin avec IA",
    heroIntro: "Transformez vos portraits de couple en une annonce de date de mariage aux couleurs de la Saint-Valentin. Composez une histoire courte, élégante et lisible pour votre site, vos messages ou vos réseaux sociaux.",
    support: "Vérifiez les noms, la date, le lieu, le lien de partage et les droits d'utilisation avant toute publication.",
    primary: "Créer ma vidéo de Saint-Valentin", secondary: "Voir les idées de scènes",
    chips: ["Annonce de mariage", "Portraits de couple", "Date vérifiée", "Partage mobile"],
    faq: [
      ["Qu'est-ce qu'une vidéo de Saint-Valentin avec IA ?", "C'est une courte annonce de date de mariage qui associe vos visuels de couple à une atmosphère de Saint-Valentin et à un texte final vérifié."],
      ["Quelles images choisir pour commencer ?", "Choisissez des portraits nets, des gestes naturels et quelques plans larges laissant de l'espace pour la date et les noms."],
      ["Puis-je ajouter la date du mariage ?", "Oui. Ajoutez la date et les noms dans des éléments éditables, puis relisez-les à taille réelle avant le partage."],
      ["Quel format convient aux réseaux sociaux ?", "Préparez une version verticale ou carrée selon le canal, en conservant les visages et le message dans la zone sûre."],
      ["Comment différencier l'annonce de l'invitation ?", "L'annonce demande surtout aux proches de retenir la date ; l'invitation communique ensuite le lieu, les horaires et le RSVP."],
      ["Les images générées représentent-elles un vrai événement ?", "Non. Présentez-les comme une direction créative et vérifiez que le contenu ne laisse pas croire à un reportage réel."]
    ]
  },
  engagement: {
    navLabel: "Fiançailles", subject: "les fiançailles", keyword: "vidéo de fiançailles avec IA",
    title: "Vidéo de fiançailles avec IA | Aidreamcapes",
    description: "Créez une vidéo de fiançailles avec IA à partir de portraits de couple et d'une histoire personnelle, avec une identité visuelle cohérente et un message prêt à partager.",
    keywords: "vidéo de fiançailles avec IA, annonce de fiançailles, portraits de couple, vidéo Save the Date, bague de fiançailles en vidéo",
    h1: "Créer une vidéo de fiançailles avec IA",
    heroIntro: "Donnez une forme claire à votre annonce de fiançailles à partir de portraits, de détails de bague et de souvenirs choisis. Gardez le couple au centre et réservez les informations exactes aux calques éditables.",
    support: "Utilisez uniquement des photos autorisées et contrôlez les visages, les mains, la bague et le texte final.",
    primary: "Créer ma vidéo de fiançailles", secondary: "Explorer les scènes de couple",
    chips: ["Annonce de fiançailles", "Portrait de couple", "Détail de bague", "Histoire personnelle"],
    faq: [
      ["Qu'est-ce qu'une vidéo de fiançailles avec IA ?", "C'est une histoire visuelle courte qui présente le couple, la bague et la joie des fiançailles à partir de sources approuvées."],
      ["Puis-je transformer mes portraits en vidéo ?", "Oui. Sélectionnez des images nettes et cohérentes, puis relisez chaque scène pour préserver l'identité du couple."],
      ["Quelles photos donnent le meilleur résultat ?", "Privilégiez des visages visibles, une lumière régulière, des gestes naturels et un mélange de plans rapprochés et larges."],
      ["Quelle différence avec une invitation de mariage ?", "La vidéo de fiançailles annonce une étape personnelle ; l'invitation communique les informations pratiques destinées aux invités."],
      ["Puis-je préparer un format vertical ?", "Oui. Gardez les visages, la bague et les légendes à distance des bords afin de faciliter le recadrage mobile."],
      ["Le texte peut-il être généré dans l'image ?", "Il vaut mieux ajouter la date, les noms et le message dans des calques éditables après validation de la scène."]
    ]
  },
  proposal: {
    navLabel: "Demande en mariage", subject: "la demande en mariage", keyword: "vidéo de demande en mariage avec IA",
    title: "Vidéo de demande en mariage avec IA | Aidreamcapes",
    description: "Créez une vidéo de demande en mariage avec IA qui suit la préparation, le moment de la question, la réaction et la révélation de la bague dans une histoire romantique.",
    keywords: "vidéo de demande en mariage avec IA, histoire de demande en mariage, révélation de bague, vidéo romantique de couple, proposition de mariage en vidéo",
    h1: "Créer une vidéo de demande en mariage avec IA",
    heroIntro: "Mettez en scène la préparation, la question, la réaction et la révélation de la bague dans une vidéo de demande en mariage cohérente. Vos noms et vos informations restent vérifiables dans le montage final.",
    support: "Contrôlez les mains, la bague, les visages et les détails du lieu avant de partager une scène créative.",
    primary: "Créer ma vidéo de demande", secondary: "Découvrir le déroulé",
    chips: ["Moment de la demande", "Réaction du couple", "Révélation de bague", "Histoire romantique"],
    faq: [
      ["Qu'est-ce qu'une vidéo de demande en mariage avec IA ?", "Elle raconte la préparation, la question et la réaction immédiate dans une suite de scènes pensée autour de ce moment."],
      ["Puis-je créer la vidéo à partir de photos ?", "Oui. Utilisez des portraits nets et quelques images de contexte pour installer l'histoire avant et après la demande."],
      ["Comment vérifier la scène de bague ?", "Examinez les doigts, la bague, les ongles et les reflets en haute résolution avant de retenir la scène."],
      ["Les noms doivent-ils apparaître dans l'image ?", "Ajoutez les noms et la date dans un calque éditable plutôt que de les confier au texte généré de l'image."],
      ["Une version verticale est-elle possible ?", "Oui. Préparez le cadrage avec une marge sûre autour des visages et des mains, puis contrôlez le recadrage final."],
      ["Quelle différence avec les fiançailles ?", "La demande montre la question et la réaction ; l'annonce de fiançailles partage la nouvelle une fois le moment passé."]
    ]
  },
  "save-the-date": {
    navLabel: "Annonce de date", subject: "le Save the Date", keyword: "vidéo Save the Date avec IA",
    title: "Vidéo Save the Date avec IA | Aidreamcapes",
    description: "Créez une vidéo Save the Date avec IA à partir de portraits de couple et d'une date de mariage confirmée, puis partagez une annonce claire avec vos proches.",
    keywords: "vidéo Save the Date avec IA, annonce de date de mariage, vidéo de couple, date de mariage à partager, invitation Save the Date",
    h1: "Créer une vidéo Save the Date avec IA",
    heroIntro: "Transformez vos portraits de couple et votre date de mariage confirmée en une annonce courte et mémorable. La date, les noms et le lieu restent lisibles avant le partage.",
    support: "Relisez chaque information factuelle, le cadrage, le lien et les droits d'utilisation avant publication.",
    primary: "Créer ma vidéo Save the Date", secondary: "Voir les idées d'annonce",
    chips: ["Date de mariage", "Portraits de couple", "Annonce mobile", "Texte vérifiable"],
    faq: [
      ["Qu'est-ce qu'une vidéo Save the Date avec IA ?", "C'est une annonce numérique courte qui présente le couple et la date de mariage afin que les proches puissent la réserver."],
      ["Que faut-il préparer avant de commencer ?", "Préparez une date confirmée, des noms correctement orthographiés, un lieu si nécessaire et des images de couple autorisées."],
      ["La vidéo remplace-t-elle l'invitation ?", "Non. Le Save the Date annonce la date ; l'invitation détaillera ensuite les horaires, le lieu, le RSVP et les autres informations."],
      ["Quel format choisir pour un site de mariage ?", "Le paysage 16:9 fonctionne bien dans un en-tête ou un lecteur, tandis que le vertical convient aux messages et aux stories."],
      ["Comment garder la date lisible ?", "Réservez un espace calme pour le dernier écran et placez le texte dans des éléments éditables, séparés de l'image générée."],
      ["Puis-je utiliser des photos de proches ?", "Oui, uniquement si vous disposez de l'autorisation nécessaire et si vous évitez de publier des informations personnelles inutiles."]
    ]
  },
  "wedding-invitation": {
    navLabel: "Invitation de mariage", subject: "l'invitation de mariage", keyword: "vidéo d'invitation de mariage avec IA",
    title: "Vidéo d’invitation de mariage avec l’IA | Aidreamcapes",
    description: "Créez une vidéo d’invitation de mariage avec l’IA à partir de votre papeterie approuvée : noms, date, lieu et détails lisibles avant le partage.",
    keywords: "vidéo d'invitation de mariage avec IA, invitation de mariage vidéo, révélation de papeterie, vidéo pour les invités, photos vers vidéo",
    h1: "Créer une vidéo d’invitation de mariage avec l’IA",
    heroIntro: "Transformez votre suite de papeterie approuvée en une courte vidéo d’invitation. Révélez l’enveloppe, la carte et les détails dans un ordre naturel, tout en gardant les informations importantes vérifiables.",
    support: "Relisez les noms, la date, le lieu, les horaires et le lien RSVP avant l’envoi.",
    primary: "Créer une vidéo d’invitation", secondary: "Voir les idées de scènes",
    chips: ["Papeterie approuvée", "Noms et date", "Révélation de carte", "Partage avec les invités"],
    faq: [
      ["Que faut-il importer ?", "Importez une suite d’invitation claire et approuvée ainsi que les informations exactes de l’événement."],
      ["Les noms et la date peuvent-ils être modifiés ?", "Ils doivent rester fidèles à la source approuvée. Relisez la version finale avant de la partager."],
      ["Comment garder le texte lisible ?", "Ajoutez le texte final dans une couche éditable et laissez suffisamment de temps de lecture sur le dernier écran."],
      ["Puis-je partager la vidéo avec les invités ?", "Oui, après avoir vérifié les noms, la date, le lieu, le RSVP, le cadrage et l’affichage mobile."],
      ["Quelle scène doit ouvrir la vidéo ?", "Commencez par l’enveloppe, le couple ou un détail de papier, puis révélez la carte dans l’ordre de lecture."],
      ["La vidéo peut-elle reprendre le décor de la réception ?", "Elle peut s’inspirer des couleurs et des matières, mais ne doit pas inventer un lieu, un horaire ou un prestataire réel."]
    ]
  },
  "wedding-ceremony": {
    navLabel: "Cérémonie de mariage", subject: "la cérémonie de mariage", keyword: "vidéo de cérémonie de mariage avec IA",
    title: "Vidéo de cérémonie de mariage avec IA | Aidreamcapes",
    description: "Créez une vidéo de cérémonie de mariage avec IA autour de l'entrée, des vœux, des alliances, du baiser et des réactions qui racontent votre journée.",
    keywords: "vidéo de cérémonie de mariage avec IA, cérémonie de mariage en vidéo, vœux et alliances, vidéo de souvenirs de mariage, histoire de cérémonie",
    h1: "Créer une vidéo de cérémonie de mariage avec IA",
    heroIntro: "Organisez vos images autour des moments vécus par les invités : arrivée, entrée, vœux, alliances, baiser, réactions et sortie. La séquence doit rester claire et fidèle aux sources approuvées.",
    support: "Vérifiez les visages, les mains, les alliances, les vêtements et la continuité du lieu avant de publier.",
    primary: "Créer ma vidéo de cérémonie", secondary: "Explorer le déroulé",
    chips: ["Entrée et vœux", "Échange des alliances", "Réactions des invités", "Souvenirs de mariage"],
    faq: [
      ["Qu'est-ce qu'une vidéo de cérémonie de mariage avec IA ?", "C'est une histoire visuelle centrée sur l'entrée, les vœux, les alliances, le baiser, les réactions et la sortie."],
      ["Puis-je transformer mes photos de cérémonie en vidéo ?", "Oui. Commencez par des images nettes et autorisées, puis contrôlez chaque scène pour préserver l'identité et le contexte."],
      ["Quels moments inclure ?", "Incluez un plan d'ensemble, l'entrée, les vœux, l'échange des alliances, quelques réactions, le baiser et la sortie."],
      ["Est-ce la même chose qu'une invitation ?", "Non. La cérémonie raconte l'événement ; l'invitation communique avant le mariage les informations et le RSVP."],
      ["Comment vérifier les scènes d'alliances ?", "Contrôlez les doigts, les bagues, les poignets, les contacts et la continuité entre les images adjacentes."],
      ["Puis-je ajouter des réactions de proches ?", "Oui, si ces images sont autorisées et si elles servent la compréhension de la cérémonie sans détourner le fil principal."]
    ]
  },
  christmas: {
    navLabel: "Noël", subject: "Noël", keyword: "vidéo de Noël avec IA",
    title: "Vidéo de Noël avec IA | Aidreamcapes",
    description: "Créez une vidéo de Noël avec IA à partir de portraits, de scènes familiales, de cadeaux et de lumières chaleureuses pour vos vœux de fin d'année.",
    keywords: "vidéo de Noël avec IA, photos de Noël, vidéo familiale de Noël, carte de vœux de Noël, scènes de fêtes avec IA",
    h1: "Créer une vidéo de Noël avec IA",
    heroIntro: "Composez des souvenirs de Noël chaleureux avec des portraits, des cadeaux, des lumières et des scènes familiales. Choisissez une direction cohérente pour une carte, un message ou une courte vidéo.",
    support: "Relisez les visages, les mains, les animaux, les ornements et tout texte personnalisé avant le partage.",
    primary: "Créer ma vidéo de Noël", secondary: "Voir les idées de scènes",
    chips: ["Souvenirs en famille", "Cadeaux et lumières", "Carte de vœux", "Scènes d'hiver"],
    faq: [
      ["Qu'est-ce qu'une vidéo de Noël avec IA ?", "C'est une suite d'images ou de scènes aux couleurs de Noël, conçue pour des vœux, des souvenirs ou un partage familial."],
      ["Puis-je transformer une photo ordinaire en photo de Noël ?", "Oui. Une image nette avec des visages visibles et un espace autour du sujet facilite l'ajout d'une ambiance de fêtes."],
      ["Puis-je créer une vidéo à partir de photos ?", "Oui. Reliez quelques images fortes avec des transitions ou des scènes complémentaires, puis vérifiez la continuité."],
      ["Puis-je inclure un animal ?", "Oui. Commencez par un portrait net et contrôlez les oreilles, les pattes, le pelage et les accessoires."],
      ["Le texte de vœux peut-il être généré dans l'image ?", "Ajoutez plutôt les noms et le message dans des calques éditables après validation du visuel."],
      ["Quel contenu partager sur les réseaux ?", "Préparez un recadrage vertical ou carré, gardez le sujet dans la zone sûre et contrôlez la lisibilité sur mobile."]
    ]
  },
  halloween: {
    navLabel: "Halloween", subject: "Halloween", keyword: "vidéo Halloween avec IA",
    title: "Vidéo Halloween avec IA | Aidreamcapes",
    description: "Créez une vidéo Halloween avec IA autour des costumes, des citrouilles, des amis et d'une ambiance mystérieuse pour vos contenus de saison.",
    keywords: "vidéo Halloween avec IA, photos Halloween, costumes Halloween, vidéo de fête, citrouilles et ambiance fantastique",
    h1: "Créer une vidéo Halloween avec IA",
    heroIntro: "Donnez une direction visuelle à vos costumes, citrouilles, animaux et fêtes d'Halloween. Mélangez lumière dramatique, couleurs profondes et détails amusants sans perdre le sujet principal.",
    support: "Vérifiez les visages, les mains, les accessoires, le texte et le niveau de frayeur adapté à votre public.",
    primary: "Créer ma vidéo Halloween", secondary: "Explorer les idées de scènes",
    chips: ["Costumes", "Citrouilles", "Fête entre amis", "Ambiance mystérieuse"],
    faq: [
      ["Qu'est-ce qu'une vidéo Halloween avec IA ?", "C'est un contenu visuel de saison qui met en scène costumes, décorations, amis, animaux ou ambiances fantastiques."],
      ["Quelles images choisir ?", "Choisissez des sujets nets, des costumes lisibles et un décor qui indique immédiatement Halloween."],
      ["Puis-je créer une scène sans personne ?", "Oui. Une citrouille sculptée, une table décorée ou une maison éclairée peut porter la direction visuelle."],
      ["Puis-je utiliser la vidéo pour les réseaux sociaux ?", "Oui. Adaptez le cadrage au canal, gardez les informations importantes dans la zone sûre et relisez le résultat."],
      ["Puis-je ajouter un message personnalisé ?", "Oui, mais placez le message dans un calque éditable plutôt que dans le texte généré de l'image."],
      ["Comment éviter une scène trop générique ?", "Associez un costume, un décor, une palette et une action précise afin que le thème Halloween reste identifiable."]
    ]
  },
  thanksgiving: {
    navLabel: "Action de grâce", subject: "Thanksgiving", keyword: "vidéo de Thanksgiving avec IA",
    title: "Vidéo de Thanksgiving avec IA | Aidreamcapes",
    description: "Créez une vidéo de Thanksgiving avec IA autour de la famille, du repas, de Friendsgiving et des messages de gratitude dans une ambiance automnale.",
    keywords: "vidéo de Thanksgiving avec IA, photos de Thanksgiving, repas en famille, vidéo Friendsgiving, message de gratitude",
    h1: "Créer une vidéo de Thanksgiving avec IA",
    heroIntro: "Racontez un repas, un moment de gratitude ou une rencontre Friendsgiving avec des scènes de famille, de cuisine et de décoration automnale. Gardez une émotion simple et un sujet immédiatement lisible.",
    support: "Contrôlez les visages, les mains, les plats, la table, les informations personnelles et le message final.",
    primary: "Créer ma vidéo de Thanksgiving", secondary: "Voir les scènes de saison",
    chips: ["Repas en famille", "Friendsgiving", "Décor automnal", "Message de gratitude"],
    faq: [
      ["Qu'est-ce qu'une vidéo de Thanksgiving avec IA ?", "C'est une histoire de saison qui met en valeur la famille, le repas, Friendsgiving, la décoration et la gratitude."],
      ["Quelles scènes fonctionnent le mieux ?", "Les préparatifs, la table, le partage du repas, les toasts et les moments en extérieur donnent des repères clairs."],
      ["Puis-je créer un contenu pour les réseaux sociaux ?", "Oui. Choisissez un format vertical ou carré, gardez le sujet central et vérifiez le texte avant publication."],
      ["Puis-je créer une scène sans personnes ?", "Oui. Une table dressée, des citrouilles, des bougies ou une carte de vœux peuvent suffire à évoquer Thanksgiving."],
      ["Thanksgiving convient-il à Friendsgiving ?", "Oui. La même palette chaleureuse peut accompagner un repas entre amis, un toast ou une scène de cuisine."],
      ["Comment rendre le thème identifiable ?", "Associez une table, des couleurs d'automne, un repas ou un geste de gratitude plutôt qu'une simple image de saison."]
    ]
  },
  "new-year": {
    navLabel: "Nouvel An", subject: "le Nouvel An", keyword: "vidéo du Nouvel An avec IA",
    title: "Vidéo du Nouvel An avec IA | Aidreamcapes",
    description: "Créez une vidéo du Nouvel An avec IA autour du compte à rebours, des feux d'artifice, des proches et de vos vœux pour la nouvelle année.",
    keywords: "vidéo du Nouvel An avec IA, vœux du Nouvel An, compte à rebours, feux d'artifice, vidéo de fête en famille",
    h1: "Créer une vidéo du Nouvel An avec IA",
    heroIntro: "Mettez en scène les lumières, le compte à rebours, les feux d'artifice et les vœux qui ouvrent la nouvelle année. Choisissez un rythme clair pour un message familial ou une publication de fête.",
    support: "Vérifiez les visages, les chiffres, le message, les lumières et la lisibilité du dernier écran.",
    primary: "Créer ma vidéo du Nouvel An", secondary: "Découvrir les idées de fête",
    chips: ["Compte à rebours", "Feux d'artifice", "Vœux", "Célébration"],
    faq: [
      ["Qu'est-ce qu'une vidéo du Nouvel An avec IA ?", "C'est un contenu de fête qui relie compte à rebours, lumières, proches, feux d'artifice et message de vœux."],
      ["Quelles scènes choisir pour commencer ?", "Commencez par une ambiance de soirée, ajoutez le compte à rebours et terminez par un message de nouvelle année."],
      ["Puis-je créer une vidéo à partir de photos ?", "Oui. Sélectionnez des photos nettes et reliez-les par une progression visuelle cohérente."],
      ["Comment vérifier les chiffres du compte à rebours ?", "Ajoutez les chiffres dans des éléments éditables et relisez chaque écran à taille réelle avant le partage."],
      ["Quel format convient aux stories ?", "Le format vertical est généralement adapté aux stories ; laissez une marge autour des visages et du texte."],
      ["Puis-je inclure des proches ?", "Oui, si les images sont autorisées. Conservez une composition simple afin que chaque personne reste identifiable."]
    ]
  },
  "mothers-day": {
    navLabel: "Fête des mères", subject: "la fête des mères", keyword: "vidéo pour la fête des mères avec IA",
    title: "Vidéo pour la fête des mères avec IA | Aidreamcapes",
    description: "Créez une vidéo pour la fête des mères avec IA autour des fleurs, des cadeaux, du brunch et des souvenirs de famille pour un message personnel.",
    keywords: "vidéo pour la fête des mères avec IA, photos fête des mères, cadeau personnalisé, message familial, vidéo de fleurs et de brunch",
    h1: "Créer une vidéo pour la fête des mères avec IA",
    heroIntro: "Composez un message personnel avec des fleurs, un cadeau, un brunch ou un souvenir de famille. Choisissez une atmosphère douce et gardez la personne célébrée au centre de chaque scène.",
    support: "Vérifiez les visages, les mains, les fleurs, le cadeau et le texte de vœux avant le partage.",
    primary: "Créer ma vidéo pour la fête des mères", secondary: "Explorer les idées de scènes",
    chips: ["Souvenir de famille", "Fleurs", "Cadeau", "Message personnel"],
    faq: [
      ["Qu'est-ce qu'une vidéo pour la fête des mères avec IA ?", "C'est un message visuel qui associe portraits, fleurs, cadeaux, brunch ou souvenirs à une attention personnalisée."],
      ["Quelles scènes fonctionnent le mieux ?", "Les bouquets, les cartes faites main, le petit-déjeuner, le brunch et les portraits au jardin donnent un contexte chaleureux."],
      ["Puis-je créer un contenu pour les réseaux sociaux ?", "Oui. Adaptez le format au canal et gardez le message final dans un calque éditable."],
      ["Faut-il montrer des enfants ?", "Non. Un cadeau, des fleurs, une table ou un portrait de la personne célébrée peuvent raconter le message."],
      ["Puis-je créer une carte de vœux ?", "Oui. Utilisez une image principale puis ajoutez le texte de vœux dans une mise en page séparée et vérifiable."],
      ["Comment éviter une image générique ?", "Choisissez un geste, une couleur, un objet ou un souvenir réellement associé à la personne célébrée."]
    ]
  },
  "fathers-day": {
    navLabel: "Fête des pères", subject: "la fête des pères", keyword: "vidéo pour la fête des pères avec IA",
    title: "Vidéo pour la fête des pères avec IA | Aidreamcapes",
    description: "Créez une vidéo pour la fête des pères avec IA autour des souvenirs en famille, des cadeaux, des activités en plein air et d'un message de gratitude.",
    keywords: "vidéo pour la fête des pères avec IA, photos fête des pères, cadeau pour papa, souvenir familial, message de gratitude",
    h1: "Créer une vidéo pour la fête des pères avec IA",
    heroIntro: "Rassemblez des souvenirs en famille, un cadeau, une activité en plein air ou un moment complice dans une vidéo chaleureuse pour la fête des pères. Faites correspondre chaque scène à la personnalité célébrée.",
    support: "Contrôlez les visages, les mains, les objets, les animaux et le message de gratitude avant publication.",
    primary: "Créer ma vidéo pour la fête des pères", secondary: "Voir les idées de scènes",
    chips: ["Souvenirs en famille", "Cadeau", "Plein air", "Message de gratitude"],
    faq: [
      ["Qu'est-ce qu'une vidéo pour la fête des pères avec IA ?", "C'est un message visuel qui relie portraits, cadeaux, activités et souvenirs à une attention personnelle pour la fête des pères."],
      ["Quelles scènes choisir ?", "Un moment en plein air, un loisir partagé, un cadeau ou un portrait en famille peut servir de fil conducteur."],
      ["Puis-je utiliser des photos de famille ?", "Oui, si vous avez le droit de les utiliser. Choisissez des images nettes et évitez les informations personnelles inutiles."],
      ["Puis-je inclure un animal de compagnie ?", "Oui. Utilisez un portrait clair et vérifiez les pattes, les oreilles, le pelage et les accessoires."],
      ["Quel format convient au partage mobile ?", "Le vertical convient aux stories et le carré aux publications ; relisez le cadrage sur un téléphone."],
      ["Comment rendre le message personnel ?", "Ancrez la vidéo dans une activité, un objet ou un souvenir précis, puis ajoutez le texte final dans un calque éditable."]
    ]
  }
};

const topicOrder = ["valentines-day", "engagement", "proposal", "save-the-date", "wedding-invitation", "wedding-ceremony", "christmas", "halloween", "thanksgiving", "new-year", "mothers-day", "fathers-day"];

const topicGrammar = {
  "la Saint-Valentin": { de: "de la Saint-Valentin", autour: "autour de la Saint-Valentin" },
  "les fiançailles": { de: "des fiançailles", autour: "autour des fiançailles" },
  "la demande en mariage": { de: "de la demande en mariage", autour: "autour de la demande en mariage" },
  "le Save the Date": { de: "du Save the Date", autour: "autour du Save the Date" },
  "l'invitation de mariage": { de: "de l'invitation de mariage", autour: "autour de l'invitation de mariage" },
  "la cérémonie de mariage": { de: "de la cérémonie de mariage", autour: "autour de la cérémonie de mariage" },
  Noël: { de: "de Noël", autour: "autour de Noël" },
  Halloween: { de: "d'Halloween", autour: "autour d'Halloween" },
  Thanksgiving: { de: "de Thanksgiving", autour: "autour de Thanksgiving" },
  "le Nouvel An": { de: "du Nouvel An", autour: "autour du Nouvel An" },
  "la fête des mères": { de: "de la fête des mères", autour: "autour de la fête des mères" },
  "la fête des pères": { de: "de la fête des pères", autour: "autour de la fête des pères" }
};
function topicDe(config) { return topicGrammar[config.subject]?.de ?? `de ${config.subject}`; }
function topicAround(config) { return topicGrammar[config.subject]?.autour ?? `autour de ${config.subject}`; }
function topicVideo(config) { return config.keyword.replace(/ avec IA$/, ""); }
function capitalize(value) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : value; }

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function pagePath(slug) { return ROUTE_PREFIX + slug; }
function outputFilename(filename) { return filename.replace(/\.(?:webp|jpe?g)$/i, ".jpg"); }
function filenameFromUrl(value) { return typeof value === "string" ? value.split("?")[0].split("#")[0].split("/").at(-1) || "" : ""; }
function pageAssets(slug) {
  const definition = slug === "valentines-day"
    ? { slug, assets: valentineAssets }
    : slug === "wedding-invitation"
      ? invitationManifest
      : commonManifest.find((item) => item.slug === slug);
  assert(definition, `missing_asset_definition:${slug}`);
  return definition.assets.map(([originalFilename, sourceAlt], index) => {
    const filename = outputFilename(originalFilename);
    const folder = slug === "valentines-day" ? `${PUBLIC_ROOT}/valentines-day-4k-vendor-v1` : `${VENDOR_ROOT}/${slug}`;
    const src = `${folder}/${filename}`;
    const alt = slug === "valentines-day" ? sourceAlt : (commonFrenchAlts[slug]?.[index] ?? sourceAlt);
    return {
      pageSlug: slug, filename, originalFilename, src,
      storageKey: src.slice(1), alt, caption: alt,
      width: 3840, height: 2160, format: "JPEG",
      loading: index === 0 ? "eager" : "lazy", fetchPriority: index === 0 ? "high" : "auto",
      role: index === 0 ? "hero" : "supporting",
      source: "AI-generated 4K editorial photograph via supplier API (buming-image / gpt-image-2)"
    };
  });
}

const allAssets = topicOrder.flatMap((slug) => pageAssets(slug));
assert.equal(allAssets.length, 131, "expected 131 supplier assets");
assert.equal(topicOrder.length, 12, "expected 12 topics");
const assetsByPage = new Map(topicOrder.map((slug) => [slug, allAssets.filter((asset) => asset.pageSlug === slug)]));

function sectionTitle(config, id, type) {
  if (id.includes("hero")) return config.h1;
  if (id.includes("faq") || type === "faq") return `Questions fréquentes sur ${config.subject}`;
  if (id.includes("definition")) return `Comprendre une vidéo sur ${config.subject}`;
  if (id.includes("final") || type === "editorial_cta") return `Donner une forme claire à ${config.subject}`;
  if (id.includes("workflow") || type === "editorial_steps") return `Créer une ${topicVideo(config)} en quelques étapes`;
  if (id.includes("format")) return `Choisir le bon format pour ${config.subject}`;
  if (id.includes("quality") || id.includes("accuracy")) return `Vérifier la qualité ${topicDe(config)}`;
  if (id.includes("boundary")) return `Garder le bon objectif pour ${config.subject}`;
  if (id.includes("source") || id.includes("responsibility")) return `Utiliser des sources fiables pour ${config.subject}`;
  if (id.includes("detail")) return `Organiser les détails ${topicDe(config)}`;
  if (id.includes("scene") || id.includes("idea") || id.includes("use_case") || id.includes("story") || id.includes("gallery")) return `Idées de scènes pour ${config.subject}`;
  return `Conseils visuels pour ${config.subject}`;
}

function sectionIntro(config, id) {
  if (id.includes("hero")) return config.heroIntro;
  if (id.includes("final")) return `Préparez vos sources, composez une séquence courte et relisez le résultat avant de partager ${config.subject}.`;
  if (id.includes("definition")) return `Une bonne création ${topicAround(config)} associe une direction visuelle reconnaissable, des sources autorisées et un message final vérifiable.`;
  if (id.includes("workflow")) return `Avancez étape par étape afin de garder les personnes, les objets et les informations importantes cohérents dans cette création.`;
  if (id.includes("quality") || id.includes("accuracy")) return `Contrôlez le résultat à taille réelle et corrigez les détails qui pourraient nuire à la compréhension ${topicDe(config)}.`;
  if (id.includes("format")) return `Choisissez le cadrage selon le canal de partage, puis vérifiez la lisibilité du sujet et du message sur chaque écran.`;
  return `Associez un sujet clair, une ambiance cohérente et un texte éditable pour créer un contenu pertinent pour ${config.subject}.`;
}

const blockTitles = {
  editorial_steps: ["Choisir les sources", "Définir le message", "Composer les scènes", "Régler le rythme", "Ajouter le texte", "Relire avant l'envoi", "Préparer le partage", "Conserver une version validée"],
  editorial_story_flow: ["Installer le contexte", "Créer la progression", "Mettre en avant le moment", "Ajouter l'émotion", "Terminer par le message"],
  editorial_quality: ["Visages et expressions", "Mains et détails", "Cohérence des objets", "Lisibilité du message", "Droits d'utilisation", "Contexte fidèle", "Cadrage final"],
  editorial_formats: ["Format paysage", "Format vertical", "Format carré", "Version mobile", "Dernier écran"],
  editorial_boundaries: ["Objectif principal", "Informations à vérifier", "Direction visuelle", "Limites à respecter"],
  editorial_detail_list: ["Personnes", "Date", "Lieu", "Ambiance", "Partage", "Dernière vérification"],
  editorial_scene_grid: ["Portrait d'ouverture", "Moment principal", "Détail thématique", "Scène complice", "Plan d'ambiance", "Message final", "Souvenir choisi", "Version mobile"],
  editorial_story_grid: ["Une ouverture personnelle", "Un détail qui raconte", "Un moment partagé", "Une transition douce", "Une conclusion lisible", "Une variante de partage"],
  editorial_ideas: ["Palette et lumière", "Portrait central", "Détail symbolique", "Scène de groupe", "Conclusion sobre", "Message personnalisé"]
};

const supplementalFaq = [
  ["Comment préparer une version mobile ?", "Conservez les visages et le message dans une zone sûre, puis vérifiez le recadrage sur un téléphone avant le partage."],
  ["Comment vérifier les droits d'utilisation ?", "Utilisez uniquement des photos, des personnes et des éléments pour lesquels vous disposez de l'autorisation nécessaire."],
  ["Quelle durée choisir pour la vidéo ?", "Préférez une séquence courte avec un rythme lisible et laissez suffisamment de temps pour comprendre le dernier écran."],
  ["Puis-je modifier le message après la création ?", "Oui. Gardez les noms, la date et le message dans des éléments éditables afin de pouvoir les relire et les ajuster."],
  ["Comment choisir la miniature ?", "Choisissez une image nette qui annonce immédiatement le thème et qui reste lisible dans les petits formats."]
];
function faqPair(config, index) {
  if (config.faq[index]) return config.faq[index];
  const extra = supplementalFaq[index - config.faq.length] ?? supplementalFaq.at(-1);
  return [extra[0], `${extra[1]} Cette règle s'applique aussi à ${config.subject}.`];
}

function blockTitle(config, section, index) {
  const list = blockTitles[section.type] ?? blockTitles.editorial_scene_grid;
  const base = list[index % list.length];
  return `${capitalize(base)} pour ${config.subject}`;
}

function blockText(config, id, index) {
  if (id.includes("workflow")) {
    return [
      `Sélectionnez des images nettes et autorisées qui présentent clairement ${config.subject}.`,
      `Définissez les noms, la date, le lieu et le message à conserver dans des éléments éditables.`,
      `Ordonnez les plans du contexte vers le moment principal afin que l'histoire soit facile à suivre.`,
      `Harmonisez la lumière, les couleurs et les mouvements sans surcharger la scène de détails.`,
      `Ajoutez le texte final après validation des visuels et laissez un temps de lecture suffisant.`,
      `Relisez les visages, les mains, les objets, le cadrage et chaque information avant l'envoi.`,
      `Préparez le format adapté au site, au message ou au réseau social choisi.`,
      `Conservez une copie validée de la version réellement partagée.`
    ][index % 8];
  }
  if (id.includes("quality") || id.includes("accuracy")) {
    return [
      `Les visages et les expressions doivent rester naturels d'une scène à l'autre.`,
      `Examinez les doigts, les mains, les bijoux, les accessoires et les contacts avec les objets.`,
      `Vérifiez que les couleurs, les matières et les éléments importants restent cohérents.`,
      `Ajoutez la date, les noms et le message dans des calques éditables et relisez-les.`,
      `Utilisez uniquement des images et des personnes pour lesquelles vous avez l'autorisation.`,
      `Ne présentez pas une création illustrative comme la preuve d'un événement réel.`,
      `Contrôlez la version finale sur mobile avant de la publier.`
    ][index % 7];
  }
  if (id.includes("boundary")) return `Cette direction doit servir ${config.subject} sans remplacer les informations qui appartiennent à une autre étape du parcours.`;
  if (id.includes("format")) return `Adaptez le cadrage ${topicDe(config)} au canal choisi, en gardant le sujet et le message dans une zone sûre.`;
  if (id.includes("scene") || id.includes("idea") || id.includes("use_case") || id.includes("story") || id.includes("gallery")) {
    return [
      `Commencez par une image qui évoque clairement ${config.subject}.`,
      `Ajoutez une action simple qui donne du mouvement et du sens à la séquence.`,
      `Utilisez un détail visuel pour renforcer l'ambiance sans détourner l'attention.`,
      `Gardez une composition aérée afin que les personnes restent faciles à reconnaître.`,
      `Réservez un arrière-plan calme pour le message et les informations importantes.`,
      `Terminez par une image stable qui facilite la lecture et le partage.`
    ][index % 6];
  }
  if (id.includes("definition") || id.includes("source") || id.includes("responsibility")) return `Une direction réussie pour ${config.subject} repose sur des sources nettes, une intention lisible et une dernière vérification humaine.`;
  return `Construisez chaque choix visuel ${topicAround(config)}, puis vérifiez que le résultat correspond à votre intention avant de le partager.`;
}

function copyBlockSetting(settings, key, config, section, index) {
  if (key === "question" || key === "answer") return undefined;
  if (key === "title") return blockTitle(config, section, index);
  if (key === "text") return blockText(config, section.id ?? "", index);
  if (key === "label") return ["Qui", "Date", "Lieu", "Ambiance", "Partage", "Vérification"][index % 6];
  if (key === "items" && Array.isArray(settings[key])) return settings[key].map((_, itemIndex) => blockText(config, section.id ?? "", index + itemIndex));
  return undefined;
}

function localizePageJson(input, slug) {
  const config = themeConfigs[slug];
  const next = clone(input ?? {});
  const sections = next.sections && typeof next.sections === "object" ? next.sections : {};
  for (const [id, section] of Object.entries(sections)) {
    if (!section || typeof section !== "object") continue;
    const settings = section.settings && typeof section.settings === "object" ? section.settings : {};
    if (typeof settings.title === "string") settings.title = sectionTitle(config, id, section.type);
    if (typeof settings.intro === "string" || ["editorial_hero", "editorial_rich_text", "editorial_cta"].includes(section.type)) settings.intro = sectionIntro(config, id);
    if (typeof settings.support === "string") settings.support = config.support;
    if (typeof settings.eyebrow === "string") settings.eyebrow = `${config.keyword}`;
    if (typeof settings.h1 === "string") settings.h1 = config.h1;
    if (typeof settings.primaryCta === "string") settings.primaryCta = config.primary;
    if (typeof settings.secondaryCta === "string") settings.secondaryCta = config.secondary;
    if (Array.isArray(settings.intentChips)) settings.intentChips = config.chips;
    for (const [key, value] of Object.entries(settings)) {
      if (key === "alt" || key === "imageAlt" || key.startsWith("image") || key === "videoUrl" || key === "themeTone" || key === "sectionVariant" || key === "anchor" || key === "layout" || key === "primaryHref" || key === "secondaryHref" || key === "number") continue;
      if (typeof value === "string" && ["title", "intro", "support", "eyebrow", "h1", "primaryCta", "secondaryCta"].includes(key)) continue;
      if (key === "items" && Array.isArray(value)) settings[key] = value.map((_, index) => blockText(config, id, index));
    }
    section.settings = settings;
    if (Array.isArray(section.blocks)) {
      const faq = section.type === "faq" || id.includes("faq");
      section.blocks = section.blocks.map((block, index) => {
        const blockNext = clone(block);
        const blockSettings = blockNext.settings && typeof blockNext.settings === "object" ? blockNext.settings : {};
        if (faq) {
          const pair = faqPair(config, index);
          if ("question" in blockSettings) blockSettings.question = pair[0];
          if ("answer" in blockSettings) blockSettings.answer = pair[1];
        }
        for (const key of Object.keys(blockSettings)) {
          if (key === "alt" || key === "imageAlt" || key.startsWith("image") || key === "videoUrl" || key === "number" || key === "id") continue;
          const replacement = faq ? undefined : copyBlockSetting(blockSettings, key, config, { ...section, id }, index);
          if (replacement !== undefined) blockSettings[key] = replacement;
        }
        blockNext.settings = blockSettings;
        return blockNext;
      });
    }
  }
  next.relatedLinks = [
    { label: "Comment ça marche", href: "/workflow" },
    { label: "Découvrir les thèmes Save the Date", href: "/best-save-the-date" },
    { label: "Créer maintenant", href: "/app/create" }
  ];
  return next;
}

function resolveAsset(pageSlug, value, state) {
  const assets = assetsByPage.get(pageSlug);
  const filename = filenameFromUrl(value?.imageUrl) || filenameFromUrl(value?.imageOriginalUrl);
  const direct = assets.find((asset) => asset.filename === filename);
  if (direct) return direct;
  const alt = String(value?.imageAlt ?? value?.alt ?? "").trim();
  const byAlt = assets.find((asset) => asset.alt === alt);
  if (byAlt) return byAlt;
  const sourceKey = `${filename}|${alt}`;
  if (state.sourceMap.has(sourceKey)) return state.sourceMap.get(sourceKey);
  const fallback = assets[state.fallbackIndex % assets.length];
  state.fallbackIndex += 1;
  state.sourceMap.set(sourceKey, fallback);
  return fallback;
}

function patchImageObjects(value, pageSlug, state) {
  if (Array.isArray(value)) return value.map((item) => patchImageObjects(item, pageSlug, state));
  if (!value || typeof value !== "object") return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, patchImageObjects(item, pageSlug, state)]));
  if (typeof next.imageUrl !== "string" && typeof next.imageOriginalUrl !== "string") return next;
  const asset = resolveAsset(pageSlug, next, state);
  return {
    ...next,
    imageUrl: asset.src, imageOriginalUrl: asset.src, imageAlt: asset.alt, alt: asset.alt,
    imageWidth: asset.width, imageHeight: asset.height, imageLoading: asset.loading, imageFetchPriority: asset.fetchPriority
  };
}

function patchPageJson(input, slug) {
  const config = themeConfigs[slug];
  const assets = assetsByPage.get(slug);
  const localized = localizePageJson(input, slug);
  const next = patchImageObjects(localized, slug, { sourceMap: new Map(), fallbackIndex: 0 });
  next.mediaManifest = assets.map((asset) => ({
    filename: asset.filename, src: asset.src, alt: asset.alt, alt_text: asset.alt, caption: asset.caption,
    role: asset.role, width: asset.width, height: asset.height, format: asset.format,
    loading: asset.loading, fetchPriority: asset.fetchPriority, fetchpriority: asset.fetchPriority, source: asset.source
  }));
  next.seo = {
    ...(next.seo && typeof next.seo === "object" ? next.seo : {}),
    title: config.title, description: config.description, keywords: config.keywords,
    canonicalPath: pagePath(slug), canonical: `${SITE_ORIGIN}${pagePath(slug)}`,
    index: true, follow: true, robots: { index: true, follow: true, maxImagePreview: "large" },
    ogImage: assets[0].src, twitterImage: assets[0].src,
    ogImageAlt: assets[0].alt, twitterImageAlt: assets[0].alt
  };
  return next;
}

function patchNavigation(input) {
  const next = clone(input ?? {});
  const navigation = next.saveTheDateNavigation;
  assert(navigation && Array.isArray(navigation.groups), "save_the_date_navigation_missing");
  const found = new Set();
  for (const group of navigation.groups) {
    if (!Array.isArray(group.items)) continue;
    for (const item of group.items) {
      const slug = topicOrder.find((candidate) => item.href === pagePath(candidate));
      if (!slug) continue;
      const config = themeConfigs[slug];
      const hero = assetsByPage.get(slug)[0];
      Object.assign(item, { label: config.navLabel, description: config.description, imageUrl: hero.src, imageAlt: hero.alt, status: "published" });
      found.add(slug);
    }
  }
  assert.equal(found.size, 12, `navigation_topic_count:${found.size}`);
  assert.equal(navigation.groups.length, 2, "navigation_group_count");
  assert.equal(navigation.groups.reduce((count, group) => count + (group.items?.filter((item) => topicOrder.some((slug) => item.href === pagePath(slug))).length ?? 0), 0), 12, "navigation_item_count");
  return next;
}

async function validateAssets() {
  const hashes = new Map();
  for (const asset of allAssets) {
    const filePath = path.join(LOCAL_PUBLIC_ROOT, asset.src.slice(PUBLIC_ROOT.length + 1));
    assert(fs.existsSync(filePath), `missing_supplier_asset:${filePath}`);
    const buffer = await fsPromises.readFile(filePath);
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.width, 3840, `bad_width:${asset.src}`);
    assert.equal(metadata.height, 2160, `bad_height:${asset.src}`);
    assert.equal(metadata.format, "jpeg", `bad_format:${asset.src}`);
    await sharp(buffer).jpeg().toBuffer();
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    assert(!hashes.has(hash), `duplicate_supplier_binary:${hashes.get(hash)}:${asset.src}`);
    hashes.set(hash, asset.src);
  }
  return { count: allAssets.length, dimensions: "3840x2160", exactDuplicates: 0 };
}

function nonEmptyObject(value) { return Boolean(value && typeof value === "object" && Object.keys(value).length); }
function hasLegacy(value) { return JSON.stringify(value ?? {}).includes("eu-regenerated"); }
function stableHash(value) { return crypto.createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex"); }

assertDatabaseTarget({ expectedTarget: "local" });
const assetAudit = await validateAssets();
const prisma = new PrismaClient();
try {
  const targetSlugs = topicOrder.map(pagePath);
  const [themePages, livePages, settings, weddingInvitationTheme] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: targetSlugs } }, select: { id: true, slug: true, title: true, draftJson: true, publishedJson: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: targetSlugs } }, select: { id: true, slug: true, title: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { id: true, draftJson: true, publishedJson: true } }),
    prisma.videoTheme.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "wedding-invitation" } }, select: { id: true, imageUrl: true, galleryImages: true } })
  ]);
  assert.equal(themePages.length, 12, `theme_page_count:${themePages.length}`);
  assert.equal(livePages.length, 12, `live_page_count:${livePages.length}`);
  assert(settings, "theme_settings_missing");
  const themeBySlug = new Map(themePages.map((row) => [row.slug, row]));
  const liveBySlug = new Map(livePages.map((row) => [row.slug, row]));
  const results = [];
  for (const slug of topicOrder) {
    const row = themeBySlug.get(pagePath(slug));
    const live = liveBySlug.get(pagePath(slug));
    assert(row && live, `page_pair_missing:${slug}`);
    const draftJson = patchPageJson(row.draftJson, slug);
    const publishedJson = patchPageJson(nonEmptyObject(row.publishedJson) ? row.publishedJson : row.draftJson, slug);
    const liveJson = patchPageJson(live.contentJson, slug);
    results.push({ slug, row, live, draftJson, publishedJson, liveJson, assets: assetsByPage.get(slug) });
  }
  const nextDraftSettings = patchNavigation(settings.draftJson);
  const nextPublishedSettings = patchNavigation(nonEmptyObject(settings.publishedJson) ? settings.publishedJson : settings.draftJson);
  const oldReferencesBefore = results.reduce((count, result) => count + Number(hasLegacy(result.row.draftJson) || hasLegacy(result.row.publishedJson) || hasLegacy(result.live.contentJson)), 0);

  if (APPLY) {
    await prisma.$transaction(async (tx) => {
      for (const asset of allAssets) {
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId: SITE_ID, storageKey: asset.storageKey } },
          create: { id: `media_${SITE_ID}_save_date_final_${asset.pageSlug}_${asset.filename.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`, siteId: SITE_ID, label: asset.filename, storageKey: asset.storageKey, mimeType: "image/jpeg", usageType: "theme", sourceType: `save-the-date-${asset.pageSlug}-vendor-api-buming-image-gpt-image-2-4k-v1`, previewUrl: asset.src, originUrl: asset.src, altText: asset.alt, notes: asset.caption },
          update: { label: asset.filename, mimeType: "image/jpeg", sourceType: `save-the-date-${asset.pageSlug}-vendor-api-buming-image-gpt-image-2-4k-v1`, previewUrl: asset.src, originUrl: asset.src, altText: asset.alt, notes: asset.caption }
        });
      }
      for (const result of results) {
        await tx.themePage.update({ where: { id: result.row.id }, data: { title: themeConfigs[result.slug].h1, draftJson: result.draftJson, publishedJson: result.publishedJson } });
        await tx.livePage.update({ where: { id: result.live.id }, data: { title: themeConfigs[result.slug].h1, contentJson: result.publishedJson } });
      }
      await tx.themeSettings.update({ where: { id: settings.id }, data: { draftJson: nextDraftSettings, publishedJson: nextPublishedSettings } });
      if (weddingInvitationTheme) {
        const invitationAssets = assetsByPage.get("wedding-invitation");
        await tx.videoTheme.update({ where: { id: weddingInvitationTheme.id }, data: { imageUrl: invitationAssets[0].src, galleryImages: invitationAssets.slice(1).map((asset) => asset.src), status: "active" } });
      }
    }, { maxWait: 20_000, timeout: 120_000 });
  }

  const [readThemePages, readLivePages, readSettings, readVideoTheme] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: targetSlugs } }, select: { slug: true, title: true, draftJson: true, publishedJson: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: targetSlugs } }, select: { slug: true, title: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { publishedJson: true } }),
    prisma.videoTheme.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "wedding-invitation" } }, select: { imageUrl: true, galleryImages: true } })
  ]);
  const readbackPages = APPLY ? readThemePages : results.map((result) => ({ slug: pagePath(result.slug), title: themeConfigs[result.slug].h1, draftJson: result.draftJson, publishedJson: result.publishedJson }));
  const readbackLive = APPLY ? readLivePages : results.map((result) => ({ slug: pagePath(result.slug), title: themeConfigs[result.slug].h1, contentJson: result.publishedJson }));
  for (const row of readbackPages) {
    const slug = row.slug.slice(ROUTE_PREFIX.length);
    const config = themeConfigs[slug];
    assert(config, `unexpected_readback_page:${row.slug}`);
    assert.equal(row.title, config.h1);
    for (const json of [row.draftJson, row.publishedJson]) {
      assert.equal(json.seo?.canonical, `${SITE_ORIGIN}${pagePath(slug)}`);
      assert.equal(json.seo?.canonicalPath, pagePath(slug));
      assert.equal(json.seo?.title, config.title);
      assert.equal(json.seo?.description, config.description);
      assert.equal(json.seo?.robots?.maxImagePreview, "large");
      assert.equal(json.mediaManifest?.length, assetsByPage.get(slug).length);
      assert(!hasLegacy(json), `legacy_image_reference_after_migration:${slug}`);
      assert(json.mediaManifest.every((item) => item.src.startsWith(VENDOR_ROOT) || item.src.includes("valentines-day-4k-vendor-v1")), `non_supplier_manifest:${slug}`);
      assert.equal(new Set(json.mediaManifest.map((item) => item.src)).size, json.mediaManifest.length, `duplicate_manifest:${slug}`);
      assert(json.mediaManifest.every((item) => item.alt?.trim()), `empty_alt:${slug}`);
    }
  }
  for (const row of readbackLive) {
    const slug = row.slug.slice(ROUTE_PREFIX.length);
    assert.equal(stableHash(row.contentJson), stableHash(readbackPages.find((page) => page.slug === row.slug)?.publishedJson), `live_publication_mismatch:${slug}`);
    assert(!hasLegacy(row.contentJson), `legacy_live_image_reference:${slug}`);
  }
  if (APPLY) {
    const nav = readSettings?.publishedJson?.saveTheDateNavigation;
    assert.equal(nav?.groups?.length, 2);
    assert.equal(nav.groups.reduce((count, group) => count + (group.items?.filter((item) => topicOrder.some((slug) => item.href === pagePath(slug))).length ?? 0), 0), 12);
    if (readVideoTheme) {
      const invitationAssets = assetsByPage.get("wedding-invitation");
      assert.equal(readVideoTheme.imageUrl, invitationAssets[0].src);
      assert.deepEqual(readVideoTheme.galleryImages, invitationAssets.slice(1).map((asset) => asset.src));
    }
  }
  console.log(JSON.stringify({ ok: true, mode: APPLY ? "applied-local" : "dry-run", siteId: SITE_ID, pages: 12, totalAssets: allAssets.length, assetAudit, oldReferencesBefore, providerCalls: 0, provider: "buming-image / gpt-image-2 (existing local assets only)", pageManifestCounts: Object.fromEntries(topicOrder.map((slug) => [slug, assetsByPage.get(slug).length])), publication: APPLY ? "ThemePage + LivePage + ThemeSettings + Wedding Invitation VideoTheme updated" : "no database writes" }, null, 2));
} finally {
  await prisma.$disconnect();
}
