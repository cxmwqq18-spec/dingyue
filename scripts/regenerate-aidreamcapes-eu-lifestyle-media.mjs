#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "plan").toLowerCase();
const batchId = String(args.batch || "aidreamcapes-eu-lifestyle-diverse-20260913-v1");
const manifestPath = path.resolve(args.manifest || ".tmp/aidreamcapes-eu-image-regeneration/" + batchId + "/manifest.json");
const outputRoot = path.resolve(".tmp", "aidreamcapes-eu-image-regeneration", batchId, "outputs");
const finalRoot = path.resolve("public/assets/sites/site_aidreamcapes_eu/generated/eu-regenerated", batchId);
const finalPublicRoot = "/assets/sites/site_aidreamcapes_eu/generated/eu-regenerated/" + batchId;
const targetSiteId = "site_aidreamcapes_xby";
const providerId = "aiprov_image4_mysub2api";
const imageModel = "gpt-image-2";
const providerImageGenerationsPath = "/v1/images/generations";
const imageSize = "1024x1536";
const imageQuality = "high";
const maxCreateTimeoutMs = 300_000;
const providerApiKeyOverride = String(process.env.AIDREAMCAPES_IMAGE_API_KEY_OVERRIDE || "");
const expectedConfirmation = "aidreamcapes-eu-lifestyle-diverse-regeneration";
const minimumCrossAHashDistance = 10;
const minimumCrossDHashDistance = 12;
const minimumCrossColorHashDistance = 24;
const minimumUniqueImageHashCount = 169;

const PROMPT_OVERRIDES = {
  "swimsuit-09": {
    revision: "safe-lifestyle-v3",
    artDirection: "Une adulte porte un maillot une pièce mauve couvrant et un peignoir clair dans un espace thermal en pierre, assise de trois-quarts près d’un bassin, épaules et visage bien visibles, serviette sur les genoux, végétation douce et montagne verte au loin; photographie de bien-être au 70 mm, cadrage pudique et lumière naturelle.",
    prompt: [
      "Crée une photographie lifestyle originale pour une galerie de photos IA privée destinée au storefront français Aidreamcapes.",
      "Catégorie Lifestyle & créatif; thème : Maillots de bain.",
      "Ancre visuelle : une série balnéaire adulte, inclusive et non explicite, pensée comme un éditorial de voyage et de bien-être.",
      "Direction artistique révisée et indépendante : une adulte porte un maillot une pièce mauve couvrant et un peignoir clair dans un espace thermal en pierre, assise de trois-quarts près d’un bassin, épaules et visage bien visibles, serviette sur les genoux, végétation douce et montagne verte au loin; photographie de bien-être au 70 mm, cadrage pudique et lumière naturelle.",
      "Portrait de mode balnéaire sobre : aucun gros plan suggestif, aucune mise en scène sexuelle, vêtement et environnement entièrement visibles.",
      "Rendu photographique crédible, anatomie naturelle, visage et mains détaillés, identité fictive d’une adulte consentante.",
      "Aucun mineur, aucune nudité, aucune transparence, aucune célébrité, aucune violence, aucune arme, aucun gore.",
      "Aucun mot, texte lisible, logo, filigrane, interface, marque ou enseigne. Pas de collage, grille, écran partagé ni visage dupliqué.",
      "Format vertical 2:3, composition naturelle, sans copie d’une autre image."
    ].join("\n")
  }
};

// Every direction is intentionally authored as a separate scene, camera language and visual recipe.
// No prompt template is used to manufacture a gallery by changing only a number.
const THEME_PLANS = [
  {
    slug: "cyberpunk",
    label: "Cyberpunk",
    anchor: "un portrait créatif futuriste où la lumière néon, la ville nocturne et les matières technologiques racontent une identité rebelle",
    directions: [
      ["rain-alley", "Une adulte avance dans une ruelle humide sous une pluie fine, manteau vinyle prune, enseignes abstraites floutées et reflets magenta dans les flaques; objectif 35 mm, contre-jour latéral et atmosphère de thriller urbain.", "Portrait cyberpunk d’une adulte dans une ruelle pluvieuse, manteau prune et reflets magenta dans les flaques."],
      ["metro-cyan", "Un adulte attend sur un quai de métro futuriste aux carreaux cyan, casque audio autour du cou et sac technique orange; composition frontale au 50 mm, vapeur légère et lumière fluorescente graphique.", "Portrait cyberpunk masculin sur un quai de métro cyan, casque audio et sac technique orange."],
      ["rooftop-hologram", "Une adulte se tient sur un toit-terrasse au-dessus d’une mégalopole, veste argentée et cheveux soulevés par le vent, panneaux lumineux abstraits sans texte derrière elle; grand angle 28 mm, ciel violet et silhouette entière.", "Portrait cyberpunk féminin sur un toit au-dessus de la ville, veste argentée et ciel violet."],
      ["arcade-red", "Un adulte joue dans une salle d’arcade rétro éclairée de rouge et d’ambre, manette tenue naturellement et écrans volontairement illisibles; flash discret au 35 mm, bomber noir et énergie ludique.", "Portrait cyberpunk dans une salle d’arcade rouge et ambre, bomber noir et ambiance rétro-futuriste."],
      ["chrome-stair", "Une adulte descend un escalier métallique chromé dans un atrium sombre, combinaison noire mate et lunettes transparentes, bandes lumineuses bleues suivant les marches; objectif 70 mm, perspective diagonale et expression assurée.", "Portrait cyberpunk féminin dans un escalier chromé, combinaison noire et lignes lumineuses bleues."],
      ["desert-server", "Un adulte marche devant une ferme de serveurs isolée dans un désert rocheux au crépuscule, veste technique sable et foulard turquoise, câbles et panneaux solaires en contexte; photo éditoriale 50 mm, palette cuivre et bleu nuit.", "Portrait cyberpunk masculin dans un désert devant des serveurs, veste sable et accent turquoise."],
      ["analog-synth", "Une adulte compose devant un synthétiseur analogique dans une petite pièce tapissée de mousse acoustique, lumière rose venant d’une lampe de bureau; cadrage rapproché 85 mm, pull vert acide et texture granuleuse.", "Portrait cyberpunk féminin devant un synthétiseur analogique, lumière rose et pull vert acide."],
      ["elevated-walkway", "Un adulte traverse une passerelle vitrée entre deux tours, pluie sur les vitres et circulation lumineuse en profondeur, costume bleu pétrole avec baskets blanches; 35 mm cinématographique, lignes fuyantes et visage net.", "Portrait cyberpunk masculin sur une passerelle vitrée, costume bleu pétrole et ville lumineuse."],
      ["neon-bike", "Une adulte pose à côté d’un vélo électrique dans un parking souterrain, tube lumineux violet au plafond et mur béton texturé, veste jaune électrique et pantalon noir; flash direct contrôlé, cadrage en pied au 28 mm.", "Portrait cyberpunk féminin avec vélo électrique dans un parking violet, veste jaune et béton brut."],
      ["night-market", "Un adulte choisit un fruit dans un marché de nuit couvert, vapeur d’un stand de cuisine et guirlandes rouges en arrière-plan sans écriture lisible; photographie documentaire au 35 mm, chemise noire et accent bleu cobalt.", "Portrait cyberpunk masculin dans un marché de nuit, vapeur de cuisine et lumière rouge."],
      ["glass-elevator", "Une adulte est photographiée dans un ascenseur vitré montant entre des façades illuminées, robe structurée bleu électrique et main posée sur la rampe; objectif 50 mm, reflets multiples mais visage dégagé.", "Portrait cyberpunk féminin dans un ascenseur vitré, robe bleu électrique et façades nocturnes."],
      ["industrial-canal", "Un adulte se tient sur une passerelle au-dessus d’un canal industriel, fumée blanche et lampes sodium, long manteau gris anthracite et gants rouges; téléobjectif 85 mm, ambiance post-industrielle calme.", "Portrait cyberpunk masculin près d’un canal industriel, manteau anthracite et lumières sodium."],
      ["dawn-neon", "Une adulte quitte une rue néon à l’aube, veste de sport lilas, cafés encore fermés et ciel bleu pâle derrière elle; reportage 35 mm avec lumière naturelle mélangée aux derniers tubes roses, humeur de nouveau départ.", "Portrait cyberpunk féminin à l’aube, veste lilas et derniers néons roses dans une rue calme."]
    ]
  },
  {
    slug: "boudoir",
    label: "Boudoir",
    anchor: "un portrait intime et élégant, non explicite, construit autour des matières, de la lumière et d’une confiance adulte plutôt que d’une pose sexualisée",
    directions: [
      ["silk-window", "Une adulte en peignoir de soie ivoire est assise près d’une fenêtre avec rideaux de lin, mains posées sur les genoux et regard doux; lumière matinale diffuse, objectif 85 mm et composition aérée.", "Portrait boudoir élégant d’une adulte en soie ivoire près d’une fenêtre, lumière matinale et pose naturelle."],
      ["velvet-chair", "Une adulte vêtue d’un ensemble noir sobre est assise dans un fauteuil de velours bleu nuit, livre fermé sans texte sur l’accoudoir et lampe chaude en arrière-plan; portrait éditorial au 70 mm, attitude sereine.", "Portrait boudoir adulte dans un fauteuil de velours bleu nuit, tenue noire sobre et lumière chaude."],
      ["hotel-morning", "Dans une chambre d’hôtel lumineuse aux draps blancs, une adulte en chemise oversize bleu ciel se prépare devant un miroir non réfléchissant de façon lisible; photographie lifestyle au 50 mm, bouquet de feuillage et ambiance de matin calme.", "Portrait boudoir adulte en chemise bleu ciel dans une chambre d’hôtel lumineuse, style matinal et délicat."],
      ["amber-lamp", "Une adulte en robe longue bordeaux lit près d’une lampe ambrée, profil tourné vers la source et cheveux attachés, décor de bois sombre et rideau lourd; 85 mm, profondeur de champ courte et rendu cinématographique.", "Portrait boudoir adulte en robe bordeaux sous une lampe ambrée, lecture et décor de bois sombre."],
      ["linen-studio", "Une adulte en combinaison beige en lin pose debout dans un studio blanc texturé, bras détendus et épaules ouvertes, ombre douce projetée au sol; grand angle 50 mm, palette crème et direction minimaliste.", "Portrait boudoir adulte en combinaison de lin beige dans un studio crème minimaliste."],
      ["bathroom-marble", "Une adulte en peignoir blanc est debout dans une salle de bain en marbre clair, miroir embué et bouquet de branches séchées, visage clairement visible; lumière naturelle latérale et cadrage mi-corps au 50 mm.", "Portrait boudoir adulte en peignoir blanc dans une salle de bain en marbre, lumière naturelle et branches séchées."],
      ["terracotta-sofa", "Une adulte en pull fin terracotta et pantalon fluide se repose sur un canapé bas, coussins texturés et tapis graphique autour d’elle; photographie au 35 mm, lumière de fin d’après-midi et expression confiante.", "Portrait boudoir adulte sur canapé terracotta, matières textiles et lumière douce de fin de journée."],
      ["blue-hour-balcony", "Une adulte en robe satinée bleu marine se tient sur un balcon à l’heure bleue, mains visibles sur la rambarde et ville floue en arrière-plan; objectif 85 mm, brise légère et élégance discrète.", "Portrait boudoir adulte en robe satinée bleu marine sur un balcon à l’heure bleue."],
      ["portrait-mirror", "Une adulte en blazer crème et caraco noir ajuste un collier devant un grand miroir, son visage et son geste visibles sans effet de duplication; flash doux de magazine, murs rose poudré et cadrage vertical.", "Portrait boudoir adulte en blazer crème ajustant un collier dans un intérieur rose poudré."],
      ["reading-nook", "Une adulte en cardigan prune est assise dans un coin lecture avec méridienne, plaid texturé et fenêtre de pluie, genoux couverts et posture décontractée; style argentique 50 mm, grain fin et tonalités mauves.", "Portrait boudoir adulte dans un coin lecture pluvieux, cardigan prune et ambiance argentique."],
      ["greenhouse-dress", "Une adulte en robe fluide vert sauge se tient dans une serre de plantes tropicales, une main effleurant une feuille et regard tourné vers l’objectif; lumière filtrée, 70 mm et ambiance botanique raffinée.", "Portrait boudoir adulte en robe vert sauge dans une serre tropicale, lumière filtrée et geste délicat."],
      ["black-and-white", "Une adulte en chemise blanche structurée pose près d’un rideau noir, lumière latérale sculptant le visage et les mains, sans nudité ni transparence; portrait noir et blanc au 85 mm, expression calme.", "Portrait boudoir adulte en chemise blanche dans un portrait noir et blanc, lumière latérale sculptée."],
      ["sunlit-floor", "Une adulte en robe d’intérieur rose pâle est assise sur un tapis près d’une baie vitrée, rayons de soleil dessinant des rectangles sur le sol; 35 mm, décor épuré et joie paisible du quotidien.", "Portrait boudoir adulte en robe rose pâle dans un rayon de soleil, intérieur épuré et pose paisible."]
    ]
  },
  {
    slug: "holiday",
    label: "Fêtes et saisons",
    anchor: "une image festive chaleureuse qui évoque une saison, une attention ou un souvenir partageable, sans dépendre d’un texte de carte lisible",
    directions: [
      ["winter-window", "Une adulte en pull crème regarde par une fenêtre couverte de buée, branches de sapin et petites lumières chaudes autour d’elle, tasse fumante en main; 50 mm, ambiance de matin d’hiver et visage net.", "Photo de fêtes d’une adulte près d’une fenêtre d’hiver, pull crème, lumières chaudes et tasse fumante."],
      ["market-lanterns", "Un adulte marche dans un marché d’hiver entre lanternes et étals de pâtisseries sans enseigne lisible, manteau camel et écharpe rouge; reportage 35 mm, neige légère et mouvement naturel.", "Photo de fêtes d’un adulte dans un marché d’hiver illuminé, manteau camel et écharpe rouge."],
      ["summer-picnic", "Deux adultes préparent un pique-nique estival dans un parc, nappe à carreaux, fruits colorés et guirlande de fanions sans mots; lumière dorée, objectif 35 mm et moment spontané de saison.", "Photo de saison de deux adultes préparant un pique-nique d’été, fruits colorés et lumière dorée."],
      ["autumn-porch", "Une adulte tient une couronne de feuilles séchées sur le perron d’une maison, manteau rouille et bottes visibles, feuilles d’automne au sol; photographie éditoriale 50 mm et palette cuivre.", "Photo d’automne d’une adulte avec une couronne de feuilles séchées, manteau rouille et perron de maison."],
      ["spring-flower-table", "Un adulte dispose des fleurs de printemps sur une table en bois dans une cuisine lumineuse, vaisselle pastel et fenêtre ouverte; cadrage documentaire 35 mm, chemise bleu pâle et air de renouveau.", "Photo de printemps d’un adulte préparant une table fleurie, vaisselle pastel et cuisine lumineuse."],
      ["candle-dinner", "Deux adultes installent un dîner aux bougies dans une salle à manger intime, serviettes en lin et branches d’eucalyptus, aucun texte ni logo; objectif 50 mm, lumière ambre et complicité naturelle.", "Photo de fêtes de deux adultes préparant un dîner aux bougies, lin naturel et branches d’eucalyptus."],
      ["coastal-holiday", "Une adulte en veste jaune marche sur une plage hivernale avec un petit paquet enveloppé de papier uni, ciel clair et dunes derrière elle; grand angle 28 mm, vent visible et humeur de vacances.", "Photo de vacances d’une adulte sur une plage d’hiver, veste jaune et paquet cadeau sans motif lisible."],
      ["rooftop-fireworks", "Un adulte et une adulte observent des feux d’artifice lointains depuis une terrasse, silhouettes tournées trois-quarts et verres sans marque sur une table; 70 mm, ciel coloré et premier plan chaleureux.", "Photo de fête d’un couple adulte regardant des feux d’artifice depuis une terrasse illuminée."],
      ["birthday-cake", "Une adulte souffle des bougies sur un petit gâteau maison dans une cuisine colorée, amis flous hors foyer et décor festif sans chiffres lisibles; 35 mm, flash doux et expression joyeuse.", "Photo d’anniversaire d’une adulte soufflant des bougies sur un gâteau maison dans une cuisine colorée."],
      ["snowy-cabin", "Un adulte ouvre la porte d’une cabane enneigée, bonnet vert forêt et plaid sur les épaules, sapins et lumière intérieure derrière lui; photographie 50 mm, contraste froid-chaud et atmosphère refuge.", "Photo de fêtes d’un adulte devant une cabane enneigée, bonnet vert forêt et lumière chaleureuse."],
      ["harvest-table", "Deux adultes récoltent des courges dans un jardin de campagne puis se tournent vers l’objectif, paniers en osier et lumière de fin d’après-midi; 35 mm documentaire, couleurs terre cuite.", "Photo de saison de deux adultes récoltant des courges au jardin, paniers en osier et lumière dorée."],
      ["festive-kitchen", "Une adulte prépare des biscuits dans une cuisine de fête, farine sur le tablier et branches de houx autour, aucune recette écrite visible; objectif 50 mm, lumière de fenêtre et geste en mouvement.", "Photo de fêtes d’une adulte préparant des biscuits dans une cuisine décorée, tablier poudré et lumière naturelle."],
      ["new-year-confetti", "Un adulte lève les bras dans une pièce bleu nuit après minuit, confettis dorés en suspension et lumière de lampes indirectes, tenue noire et chemise ivoire; 35 mm, énergie élégante et visage lisible.", "Photo de Nouvel An d’un adulte sous des confettis dorés, tenue noire et intérieur bleu nuit."]
    ]
  },
  {
    slug: "cannes",
    label: "Cannes",
    anchor: "un imaginaire méditerranéen de festival, de cinéma et de Riviera, avec élégance solaire sans célébrité, logo ni référence à un événement réel",
    directions: [
      ["red-carpet-sunset", "Une adulte en robe rouge minimaliste monte un tapis rouge installé devant une façade méditerranéenne, palmiers et mer au loin; 50 mm, soleil couchant et posture de première sans logo.", "Portrait style Cannes d’une adulte en robe rouge sur un tapis rouge méditerranéen au coucher du soleil."],
      ["croisette-bike", "Un adulte en costume clair pousse un vélo ancien le long d’une promenade bordée de palmiers, mer turquoise et cabines abstraites sans texte; reportage 35 mm, soleil franc et élégance décontractée.", "Portrait style Cannes d’un adulte en costume clair sur la promenade, vélo ancien et mer turquoise."],
      ["yacht-deck", "Une adulte en tailleur blanc cassé pose sur le pont d’un voilier amarré, foulard bleu marine et horizon marin derrière elle; objectif 70 mm, lumière de midi et matières nautiques détaillées.", "Portrait Riviera d’une adulte en tailleur blanc sur un voilier, foulard marine et horizon méditerranéen."],
      ["cinema-foyer", "Un adulte en smoking noir attend dans le foyer d’un cinéma art déco, murs dorés et escalier courbe, mains visibles et aucune affiche lisible; 85 mm, éclairage ambre et calme d’avant séance.", "Portrait de gala inspiré de Cannes, adulte en smoking dans un foyer de cinéma art déco."],
      ["villa-garden", "Une adulte en robe jaune citron traverse le jardin d’une villa avec bougainvilliers, table de réception discrète et collines en arrière-plan; 35 mm, ombres nettes et palette solaire.", "Portrait Riviera d’une adulte en robe jaune dans un jardin de villa aux bougainvilliers."],
      ["harbor-blue-hour", "Un adulte en veste bleu cobalt se tient sur un quai au crépuscule, bateaux flous et lumières du port derrière lui; 85 mm, reflets bleu-violet et expression posée de portrait éditorial.", "Portrait style Cannes d’un adulte sur un port à l’heure bleue, veste cobalt et reflets violets."],
      ["terrace-flash", "Une adulte en combinaison noire est photographiée au flash sur une terrasse blanche, parasols fermés et mer lumineuse en arrière-plan; esthétique magazine 50 mm, ombres graphiques et regard direct.", "Portrait éditorial façon Cannes d’une adulte en combinaison noire sur une terrasse blanche face à la mer."],
      ["festival-stairs", "Un adulte en costume ivoire descend de larges marches de pierre bordées de plantes, lunettes dans la main et ciel bleu derrière lui; objectif 35 mm, mouvement naturel et architecture élégante.", "Portrait de festival d’un adulte en costume ivoire sur des marches de pierre, ciel bleu et végétation."],
      ["cafe-table", "Une adulte en chemise de soie corail est assise à la terrasse d’un café sans enseigne, carnet fermé et citronnade devant elle, mer en profondeur; 70 mm, lumière de fin d’après-midi et rendu cinématographique.", "Portrait Riviera d’une adulte en soie corail à une terrasse face à la mer, lumière de fin d’après-midi."],
      ["marina-night", "Un adulte en blazer vert bouteille marche près d’une marina illuminée, reflets dorés sur l’eau et architecture de yachts en arrière-plan; 50 mm, nuit douce et allure de film noir solaire.", "Portrait nocturne style Cannes d’un adulte en blazer vert près d’une marina illuminée."],
      ["film-reel-studio", "Une adulte tient une bobine de film muette dans un studio aux murs rouges, projecteur ancien hors foyer et aucun titre visible; portrait 85 mm, faisceau de poussière et élégance rétro.", "Portrait cinéma inspiré de Cannes d’une adulte avec bobine de film dans un studio rouge rétro."],
      ["seafront-morning", "Un adulte en pantalon blanc et chemise rayée marche au bord de l’eau tôt le matin, serviette sur l’épaule et promenade vide; grand angle 28 mm, lumière fraîche et naturel documentaire.", "Portrait Riviera matinal d’un adulte en chemise rayée au bord de l’eau, promenade vide et lumière fraîche."],
      ["gala-balcony", "Une adulte en robe bleu nuit se tient à la balustrade d’un hôtel, rideaux blancs et mer scintillante derrière elle, visage tourné vers la caméra; 85 mm, lumière bleue du soir et sophistication sobre.", "Portrait de gala façon Cannes d’une adulte en robe bleu nuit sur un balcon d’hôtel face à la mer."]
    ]
  },
  {
    slug: "nightlife",
    label: "Nuits urbaines",
    anchor: "une scène de sortie nocturne adulte, énergique et cinématographique, où la ville, la musique ou les rencontres donnent un contexte clair au portrait",
    directions: [
      ["jazz-club", "Une adulte en veste satinée prune est assise dans un club de jazz, saxophone flou et lampes ambrées derrière elle, aucun artiste reconnaissable; 50 mm, ambiance feutrée et regard vers l’objectif.", "Portrait de nuit d’une adulte dans un club de jazz, veste prune et lumières ambrées."],
      ["rooftop-dance", "Un adulte danse seul sur un rooftop entouré de guirlandes, skyline colorée et veste argentée en mouvement; grand angle 28 mm, lumière bleu-rose et énergie spontanée de soirée.", "Portrait nightlife d’un adulte dansant sur un rooftop, veste argentée et skyline bleu-rose."],
      ["diner-neon", "Une adulte est assise dans un diner nocturne aux banquettes turquoise, milkshake sans marque sur la table et pluie sur la vitre; 35 mm, tubes rouges et style photo de rue.", "Portrait de nuit d’une adulte dans un diner néon, banquette turquoise et pluie sur la vitre."],
      ["club-entrance", "Un adulte rejoint un petit groupe flou devant l’entrée d’un club sans enseigne lisible, manteau long jaune et lumière violette sur le visage; objectif 50 mm, instant d’arrivée et profondeur urbaine.", "Portrait nightlife d’un adulte devant un club sans enseigne, manteau jaune et lumière violette."],
      ["late-bookshop", "Une adulte parcourt une librairie ouverte tard, ampoules chaudes, manteau bleu nuit et livres volontairement sans titres lisibles; photographie documentaire au 35 mm, calme nocturne inattendu.", "Portrait de nuit d’une adulte dans une librairie tardive, manteau bleu nuit et lampes chaudes."],
      ["night-bus", "Un adulte est assis près de la fenêtre d’un bus nocturne, visage éclairé par des reflets de ville et écouteurs autour du cou; 85 mm, pluie et bokeh multicolore, humeur introspective.", "Portrait nocturne d’un adulte dans un bus sous la pluie, reflets de ville et écouteurs."],
      ["cabaret-curtain", "Une adulte en costume rouge bordeaux se tient devant un rideau de cabaret, projecteur rose et tables floues derrière elle, aucune performance identifiable; 70 mm, posture théâtrale et couleurs profondes.", "Portrait nightlife d’une adulte devant un rideau de cabaret, costume bordeaux et projecteur rose."],
      ["street-food", "Un adulte mange un plat chaud dans une rue de nuit éclairée par un stand sans texte lisible, vapeur autour du visage et veste orange; reportage 35 mm, lumière sodium et scène vivante.", "Portrait de nuit d’un adulte devant un stand de cuisine, vapeur, veste orange et lumière sodium."],
      ["gallery-opening", "Une adulte en robe noire visite une galerie contemporaine pendant un vernissage, silhouettes floues et sculpture lumineuse sans cartel lisible; objectif 50 mm, flash indirect et atmosphère culturelle.", "Portrait nightlife d’une adulte dans une galerie contemporaine, robe noire et sculpture lumineuse."],
      ["vinyl-bar", "Un adulte choisit un vinyle dans un bar musical, étagères colorées sans pochettes lisibles et lampe orange au-dessus du comptoir; 50 mm, chemise vert forêt et ambiance analogique.", "Portrait nocturne d’un adulte dans un bar à vinyles, chemise vert forêt et lumière orange."],
      ["city-crosswalk", "Une adulte traverse un passage piéton après une averse, trench transparent sur une tenue rose, phares flous et immeubles brillants; 35 mm, pose en mouvement et contraste urbain.", "Portrait nightlife d’une adulte traversant une rue mouillée, trench transparent et lumières de ville."],
      ["friends-balcony", "Deux adultes discutent sur un balcon de nuit avec verres transparents et plantes en pot, immeubles éclairés en arrière-plan; 70 mm, lumière douce de l’intérieur et moment de conversation authentique.", "Photo de nuit de deux adultes discutant sur un balcon, plantes en pot et immeubles illuminés."],
      ["dawn-afterparty", "Un adulte sort d’une salle de concert à l’aube, veste en jean, confettis au sol et ciel lavande derrière lui, aucune affiche lisible; 35 mm documentaire et fatigue heureuse de fin de soirée.", "Portrait de fin de nuit d’un adulte devant une salle de concert, veste en jean et ciel lavande."]
    ]
  },
  {
    slug: "rich-lifestyle",
    label: "Lifestyle premium",
    anchor: "un lifestyle haut de gamme crédible et discret, fondé sur l’architecture, le voyage et les matières raffinées, sans logo ni ostentation artificielle",
    directions: [
      ["villa-breakfast", "Une adulte prend un petit déjeuner sur la terrasse d’une villa en pierre, table en travertin et vue sur une vallée, robe en lin sable; 50 mm, lumière dorée et élégance quotidienne.", "Portrait lifestyle premium d’une adulte prenant le petit déjeuner sur une terrasse de villa en pierre."],
      ["private-train", "Un adulte lit un livre fermé dans un wagon de train ancien aux boiseries profondes, costume brun et lumière traversant les rideaux; 85 mm, détails raffinés et atmosphère de voyage lent.", "Portrait lifestyle premium d’un adulte dans un wagon ancien en bois, costume brun et lumière douce."],
      ["sailboat-sunset", "Une adulte se tient à la proue d’un voilier au coucher du soleil, chemise blanche et pantalon fluide, mer orange derrière elle; grand angle 28 mm, vent naturel et composition ample.", "Portrait lifestyle premium d’une adulte à la proue d’un voilier au coucher du soleil, tenue blanche et mer orange."],
      ["art-museum", "Un adulte marche dans une galerie d’art minimaliste aux murs crème, manteau camel et sculpture abstraite sans cartel lisible; objectif 70 mm, lumière de musée et composition silencieuse.", "Portrait lifestyle premium d’un adulte dans une galerie d’art minimaliste, manteau camel et sculpture abstraite."],
      ["vineyard", "Une adulte traverse un vignoble vallonné avec panier en osier vide, veste en cuir cognac et bottes, rangées de vignes sous un ciel clair; 35 mm éditorial et couleurs de fin d’été.", "Portrait lifestyle premium d’une adulte dans un vignoble vallonné, veste cognac et lumière de fin d’été."],
      ["spa-stone", "Un adulte est assis dans un spa contemporain près d’un bassin de pierre, peignoir gris clair et plantes architecturales, visage tourné vers une baie vitrée; 50 mm, calme minéral et lumière blanche.", "Portrait lifestyle premium d’un adulte dans un spa minéral, peignoir gris et bassin de pierre."],
      ["mountain-chalet", "Une adulte ouvre les volets d’un chalet moderne face aux montagnes enneigées, pull écru et pantalon noir, cheminée discrète derrière elle; 35 mm, contraste intérieur chaud et paysage vaste.", "Portrait lifestyle premium d’une adulte dans un chalet face aux montagnes, pull écru et lumière de cheminée."],
      ["rooftop-dinner", "Deux adultes dînent sur un toit-terrasse avec vaisselle en céramique et bouquet de feuillage, skyline au crépuscule, aucun alcool mis en avant; 50 mm, lumière de bougies et sophistication naturelle.", "Photo lifestyle premium de deux adultes dînant sur un rooftop, vaisselle en céramique et skyline au crépuscule."],
      ["modern-library", "Un adulte pose dans une bibliothèque privée aux étagères en noyer, fauteuil en cuir et lampe sculpturale, ouvrage fermé sans texte; 85 mm, tons chocolat et expression réfléchie.", "Portrait lifestyle premium d’un adulte dans une bibliothèque en noyer, fauteuil en cuir et lumière sculpturale."],
      ["desert-retreat", "Une adulte marche dans l’architecture d’un refuge désertique en béton clair, combinaison ivoire et ombres géométriques, cactus en arrière-plan; grand angle 28 mm, palette sable et silence visuel.", "Portrait lifestyle premium d’une adulte dans un refuge désertique, combinaison ivoire et ombres géométriques."],
      ["classic-courtyard", "Un adulte traverse la cour d’un hôtel historique, costume bleu marine, fontaine de pierre et végétation taillée autour; 70 mm, lumière du matin et élégance européenne discrète.", "Portrait lifestyle premium d’un adulte dans la cour d’un hôtel historique, costume marine et fontaine de pierre."],
      ["coastal-coupe", "Une adulte s’appuie contre une voiture ancienne sans marque visible sur une route côtière, foulard orange et mer bleue en contrebas; 50 mm, lumière claire et esprit grand voyage.", "Portrait lifestyle premium d’une adulte sur une route côtière, voiture ancienne neutre et foulard orange."],
      ["private-terrace", "Un adulte contemple une ville depuis une terrasse arborée, manteau gris perle, fauteuil tressé et vase en céramique à côté de lui; 85 mm, heure bleue et luxe calme sans ostentation.", "Portrait lifestyle premium d’un adulte sur une terrasse arborée à l’heure bleue, manteau gris perle et ville en contrebas."]
    ]
  },
  {
    slug: "bikini",
    label: "Bikini",
    anchor: "un éditorial de plage adulte, lumineux et non explicite, où le maillot s’intègre à une vraie scène de vacances, de mouvement et de paysage",
    directions: [
      ["coral-beach", "Une adulte porte un bikini corail sur une plage de sable clair, debout près d’un parasol en toile et d’un sac tressé, visage net et paysage entièrement lisible; 35 mm, soleil doux du matin.", "Photo de plage d’une adulte en bikini corail près d’un parasol, sable clair et lumière matinale."],
      ["rocky-cove", "Une adulte en bikini bleu cobalt marche sur une crique rocheuse avec une chemise blanche ouverte et un chapeau de paille, mer turquoise derrière elle; 50 mm, mouvement naturel et cadrage en pied.", "Photo de vacances d’une adulte en bikini bleu dans une crique rocheuse, chemise blanche et mer turquoise."],
      ["pool-tiles", "Une adulte en bikini vert sauge s’assoit au bord d’une piscine carrelée, serviette jaune et plantes tropicales autour, posture détendue et non sexualisée; objectif 70 mm, lumière de midi réfléchie.", "Photo lifestyle d’une adulte en bikini vert sauge au bord d’une piscine carrelée, serviette jaune et feuillage tropical."],
      ["surf-board", "Une adulte en bikini noir tient une planche de surf turquoise sur une plage venteuse, combinaison légère nouée à la taille et océan en profondeur; grand angle 28 mm, énergie sportive et ciel ouvert.", "Photo de plage d’une adulte en bikini noir avec planche de surf turquoise, océan et vent visible."],
      ["lakeside-dock", "Une adulte en bikini jaune est assise sur un ponton en bois au bord d’un lac, chemise rayée posée près d’elle et montagnes au loin; 50 mm, lumière de fin d’après-midi et ambiance paisible.", "Photo de vacances d’une adulte en bikini jaune sur un ponton de lac, montagnes et lumière dorée."],
      ["palm-shadow", "Une adulte en bikini blanc et paréo orange traverse une terrasse de plage, ombres de palmiers sur le sol et transat vide derrière elle; 35 mm éditorial, soleil graphique et visage clairement visible.", "Photo de plage d’une adulte en bikini blanc et paréo orange sous des ombres de palmiers."],
      ["boat-ladder", "Une adulte en bikini bleu marine remonte l’échelle d’un petit bateau, serviette rayée sur la rambarde et eau transparente autour; prise de vue latérale 50 mm, scène de navigation et anatomie naturelle.", "Photo de vacances d’une adulte en bikini bleu marine remontant sur un bateau, eau transparente et serviette rayée."],
      ["sunset-volleyball", "Deux adultes jouent au volley sur une plage au coucher du soleil, maillots colorés, ballon en mouvement et silhouettes assez proches pour distinguer les visages; 35 mm, énergie sportive sans pose suggestive.", "Photo de plage de deux adultes jouant au volley au coucher du soleil, maillots colorés et sable doré."],
      ["garden-shower", "Une adulte en bikini terracotta se rince sous une douche extérieure entourée de bambous, serviette nouée à la taille et visage tourné vers la lumière; 70 mm, scène de resort pudique et naturelle.", "Photo de resort d’une adulte en bikini terracotta sous une douche extérieure entourée de bambous."],
      ["striped-cabana", "Une adulte en bikini lilas se repose sous une cabane rayée bleu et blanc, lunettes posées sur une table et livre fermé sans titre; 85 mm, lumière filtrée et composition de magazine voyage.", "Photo de plage d’une adulte en bikini lilas sous une cabane rayée, lumière filtrée et ambiance de voyage."],
      ["cliff-walk", "Une adulte en bikini orange et pantalon de lin marche sur un sentier de falaise, mer profonde et herbes sèches autour; grand angle 28 mm, vent dans la chemise et contexte de randonnée côtière.", "Photo de vacances d’une adulte en bikini orange sur un sentier de falaise, pantalon de lin et mer profonde."],
      ["seashell-shore", "Une adulte en bikini vert bouteille ramasse un coquillage au bord d’une plage calme, chapeau de toile et panier naturel, pose accroupie non suggestive; 50 mm, lumière nacrée et détails du rivage.", "Photo de plage d’une adulte en bikini vert bouteille ramassant un coquillage, chapeau de toile et rivage calme."],
      ["poolside-breakfast", "Une adulte en bikini rose poudré et kimono léger prend un petit déjeuner près d’une piscine, plateau de fruits et architecture blanche autour; 35 mm, lumière du matin et scène de vacances complète.", "Photo lifestyle d’une adulte en bikini rose près d’une piscine, kimono léger et petit déjeuner fruité."]
    ]
  },
  {
    slug: "swimsuit",
    label: "Maillots de bain",
    anchor: "une série balnéaire adulte et inclusive, pensée comme un éditorial de voyage et de mouvement, avec des poses naturelles et un décor pleinement visible",
    directions: [
      ["red-one-piece", "Une adulte porte un maillot une pièce rouge sur une plage de galets, serviette rayée et cabane en bois en arrière-plan, posture debout naturelle; 50 mm, lumière marine claire et visage net.", "Photo balnéaire d’une adulte en maillot une pièce rouge sur une plage de galets, serviette rayée et cabane en bois."],
      ["green-pool", "Un adulte en maillot vert forêt s’assoit au bord d’une piscine rétro, lunettes de soleil à la main et murs crème derrière lui; 70 mm, lumière réfléchie et composition éditoriale calme.", "Photo balnéaire d’un adulte en maillot vert forêt au bord d’une piscine rétro, murs crème et lumière douce."],
      ["sailing-stripes", "Une adulte en maillot rayé bleu et blanc ajuste un gilet de sauvetage sur le pont d’un voilier, corde et mer autour; 35 mm documentaire, vent léger et activité de navigation lisible.", "Photo de voyage d’une adulte en maillot rayé préparant une sortie en voilier, mer et cordages visibles."],
      ["river-stones", "Un adulte en short de bain bleu cobalt marche dans une rivière peu profonde entre des rochers, chemise ouverte et forêt en arrière-plan; grand angle 28 mm, lumière tachetée et mouvement authentique.", "Photo de baignade d’un adulte en short bleu cobalt dans une rivière rocheuse, forêt et lumière tachetée."],
      ["desert-oasis", "Une adulte en maillot une pièce orange se tient près d’une oasis, pantalon fluide posé sur un rocher et palmiers derrière elle; 50 mm, palette sable et turquoise, posture de voyage non sexualisée.", "Photo de voyage d’une adulte en maillot orange près d’une oasis, palmiers et palette sable-turquoise."],
      ["indoor-lap", "Un adulte en maillot noir nage dans une piscine intérieure aux lignes architecturales, capturé au bord du bassin avant le plongeon; 35 mm, eau bleue, lumière zénithale et silhouette complète.", "Photo de natation d’un adulte en maillot noir dans une piscine intérieure architecturale, eau bleue et lumière zénithale."],
      ["lake-paddle", "Une adulte en maillot bleu ciel et short léger porte une pagaie vers un paddle posé sur une plage de lac, montagne brumeuse derrière elle; 35 mm, matin frais et esprit plein air.", "Photo de lac d’une adulte en maillot bleu ciel avec une pagaie, paddle et montagne brumeuse."],
      ["beach-cycling", "Un adulte en maillot jaune sous une chemise ouverte pousse un vélo le long d’une promenade maritime, panier en osier et mer en arrière-plan; 50 mm, soleil du matin et style documentaire.", "Photo balnéaire d’un adulte en maillot jaune avec vélo sur une promenade maritime, chemise ouverte et mer."],
      ["stone-bath", "Une adulte en maillot mauve se tient dans un bassin thermal en pierre, serviette sur les épaules et montagne verte au loin; 70 mm, vapeur légère, cadrage pudique et ambiance bien-être.", "Photo bien-être d’une adulte en maillot mauve dans un bassin thermal en pierre, serviette et montagne verte."],
      ["boardwalk-wind", "Un adulte en maillot bleu marine marche sur une jetée en bois avec une veste légère au vent, cabines pastel et mer grise derrière lui; 35 mm, ciel couvert et texture argentique.", "Photo balnéaire d’un adulte en maillot bleu marine sur une jetée venteuse, cabines pastel et mer grise."],
      ["coral-reef-mask", "Une adulte en maillot turquoise tient un masque de plongée près d’une crique, combinaison légère sur les épaules et eau claire autour; 50 mm, lumière solaire et préparation d’exploration.", "Photo de plongée d’une adulte en maillot turquoise près d’une crique, masque et eau claire."],
      ["pool-steps", "Un adulte en maillot bordeaux remonte des marches de piscine entourées de feuillage, serviette blanche sur la rampe et visage dirigé vers l’objectif; 85 mm, lumière d’après-midi et luxe discret.", "Photo de piscine d’un adulte en maillot bordeaux sur des marches entourées de feuillage, serviette blanche."],
      ["coastal-yoga", "Une adulte en maillot une pièce ivoire et pantalon ample pratique une posture de yoga sur une terrasse face à la mer, tapis bleu et herbes sèches; 35 mm, lumière dorée et équilibre naturel.", "Photo bien-être d’une adulte en maillot ivoire pratiquant le yoga sur une terrasse face à la mer."]
    ]
  },
  {
    slug: "travel",
    label: "Voyage",
    anchor: "un portrait de voyage éditorial et documenté qui privilégie la découverte, le mouvement et un lieu clairement identifiable sans enseigne lisible",
    directions: [
      ["lisbon-tram", "Une adulte descend d’un tram jaune ancien dans une rue pavée en pente, sac en toile et lumière matinale, façades colorées sans texte lisible; 35 mm documentaire, mouvement spontané.", "Photo de voyage d’une adulte descendant d’un tram jaune dans une rue pavée aux façades colorées."],
      ["desert-road", "Un adulte se tient près d’une route droite traversant un désert de roches rouges, veste denim et carte pliée sans texte dans la main; grand angle 28 mm, ciel immense et esprit road trip.", "Photo de voyage d’un adulte sur une route du désert rouge, veste denim et ciel immense."],
      ["kyoto-garden", "Une adulte marche dans un jardin japonais humide sous un parapluie transparent, érables et passerelle en bois autour d’elle; 50 mm, brume légère et palette vert mousse.", "Photo de voyage d’une adulte sous un parapluie dans un jardin japonais brumeux, érables et passerelle en bois."],
      ["alpine-station", "Un adulte attend sur un quai de montagne avec sac à dos rouge, chalet et sommets enneigés derrière lui, panneau volontairement illisible; 35 mm, lumière froide et portrait d’aventure.", "Photo de voyage d’un adulte dans une gare alpine, sac à dos rouge et sommets enneigés."],
      ["marrakech-courtyard", "Une adulte traverse une cour intérieure aux carreaux bleus et aux plantes en pots, tunique orange et panier tressé; 50 mm, lumière zénithale douce et textures artisanales sans motifs protégés.", "Photo de voyage d’une adulte dans une cour aux carreaux bleus, tunique orange et textures artisanales."],
      ["coastal-ferry", "Un adulte regarde la mer depuis le pont d’un ferry, bonnet gris, veste marine et île rocheuse au loin; 70 mm, embruns visibles et ambiance de traversée réelle.", "Photo de voyage d’un adulte sur le pont d’un ferry face à une île rocheuse, veste marine et embruns."],
      ["rainforest-path", "Une adulte marche sur une passerelle en bois dans une forêt tropicale, imperméable jaune et appareil photo sans marque autour du cou; 35 mm, feuillage profond et lumière filtrée.", "Photo de voyage d’une adulte en imperméable jaune sur une passerelle de forêt tropicale, lumière filtrée."],
      ["old-town-cafe", "Un adulte est assis à une petite table dans une vieille ville méditerranéenne, carnet fermé, café et façade ocre derrière lui; 85 mm, ombres de midi et photographie de rue naturelle.", "Photo de voyage d’un adulte dans un café d’une vieille ville méditerranéenne, façade ocre et lumière de midi."],
      ["northern-lights", "Une adulte en combinaison d’hiver observe une aurore boréale près d’un lac sombre, bonnet violet et reflet vert dans l’eau; grand angle 24 mm, silhouette lisible et ciel spectaculaire.", "Photo de voyage d’une adulte observant une aurore boréale près d’un lac, combinaison d’hiver et reflet vert."],
      ["canal-bicycle", "Un adulte roule lentement à vélo le long d’un canal bordé d’arbres, manteau beige et pont de briques derrière lui; 35 mm, ciel couvert et ambiance européenne quotidienne.", "Photo de voyage d’un adulte à vélo le long d’un canal bordé d’arbres, manteau beige et pont de briques."],
      ["island-hike", "Une adulte s’arrête sur un sentier volcanique au-dessus de l’océan, coupe-vent turquoise et sac léger, cratère en profondeur; 28 mm, vent marqué et sentiment d’exploration.", "Photo de randonnée d’une adulte sur une île volcanique, coupe-vent turquoise et océan en contrebas."],
      ["night-train", "Un adulte regarde par la fenêtre d’un train de nuit, lumière de cabine chaude et paysage rural flou, veste en velours côtelé; 50 mm, reflet discret et atmosphère de départ.", "Photo de voyage d’un adulte dans un train de nuit, veste en velours et paysage rural flou."],
      ["harbor-fishers", "Une adulte marche sur un petit port de pêche au matin, panier en toile et maisons pastel derrière elle, bateaux sans marquage; 35 mm documentaire, lumière fraîche et détails du quai.", "Photo de voyage d’une adulte dans un port de pêche pastel, panier en toile et lumière du matin."]
    ]
  },
  {
    slug: "soccer",
    label: "Football",
    anchor: "une image de passion football adulte, centrée sur l’énergie du jeu ou du supporter, avec couleurs génériques, aucun blason, aucune marque et aucun joueur réel",
    directions: [
      ["stadium-scarf", "Un adulte lève une écharpe rouge unie dans une tribune pleine, stade flou sous les projecteurs et visage nettement visible; 35 mm, émotion collective et aucun blason ni texte.", "Photo de supporter adulte dans un stade, écharpe rouge unie, projecteurs et émotion du football."],
      ["women-training", "Une adulte en tenue de football bleu ciel conduit le ballon sur un terrain d’entraînement au lever du soleil, buts et brume derrière elle; 70 mm sportif, action nette et équipement sans logo.", "Photo de football féminin d’une adulte à l’entraînement au lever du soleil, ballon et terrain brumeux."],
      ["street-kick", "Un adulte frappe un ballon sur un terrain urbain entouré de murs colorés, tenue jaune et baskets, amis flous en arrière-plan; grand angle 28 mm, mouvement figé et scène de quartier.", "Photo de football de rue d’un adulte frappant un ballon sur un terrain urbain coloré."],
      ["rainy-goal", "Une adulte garde un petit but sous une pluie fine sur un terrain municipal, maillot vert uni et gants noirs, flaques en premier plan; 50 mm, lumière grise et intensité sportive.", "Photo de football sous la pluie d’une adulte devant un but, maillot vert et terrain détrempé."],
      ["tactics-board", "Deux adultes discutent autour d’un tableau tactique sans mots lisibles dans un vestiaire lumineux, maillots orange suspendus et ballon au sol; 35 mm documentaire, collaboration et diversité de profils.", "Photo de football de deux adultes préparant une tactique dans un vestiaire, tableau abstrait et maillots orange."],
      ["sunset-pitch", "Un adulte marche sur un terrain vide avec un ballon sous le bras, ciel orange derrière les cages et longues ombres; objectif 85 mm, silhouette claire et calme après le match.", "Photo de football d’un adulte quittant un terrain au coucher du soleil, ballon sous le bras et cages en silhouette."],
      ["fan-facepaint", "Une adulte porte un maquillage de supporter bleu et blanc sans symbole, photographiée devant des gradins colorés avant le coup d’envoi; 50 mm, sourire direct et lumière de stade.", "Portrait de supportrice adulte avec maquillage bleu et blanc sans symbole, gradins et lumière de stade."],
      ["indoor-futsal", "Un adulte court dans une salle de futsal aux lignes graphiques, maillot violet sans marque et ballon proche du pied; 35 mm, lumière zénithale et action dynamique sans foule.", "Photo de futsal d’un adulte en action dans une salle aux lignes graphiques, maillot violet sans logo."],
      ["goalkeeper-gloves", "Une adulte ajuste ses gants près d’un but avant une séance, terrain synthétique et filets nets derrière elle, veste d’échauffement orange; 70 mm, concentration et lumière latérale.", "Photo de gardienne adulte ajustant ses gants près d’un but, veste orange et terrain synthétique."],
      ["neighborhood-match", "Deux adultes se serrent la main après un match sur un terrain de quartier, ballon entre eux et immeubles en arrière-plan; 35 mm reportage, lumière de fin de journée et fair-play visible.", "Photo de football de quartier de deux adultes se serrant la main après le match, fair-play et immeubles."],
      ["stadium-tunnel", "Un adulte traverse un tunnel de stade éclairé en bleu avant d’entrer sur la pelouse, silhouette en tenue rouge unie et visage visible; 50 mm, perspective centrale et tension positive.", "Photo de football d’un adulte dans le tunnel bleu d’un stade avant le match, tenue rouge sans logo."],
      ["family-stand", "Une adulte et un adolescent? NON; deux adultes de générations différentes célèbrent dans une tribune avec drapeaux unis, aucun texte ni blason; 35 mm, joie partagée et visages nets.", "Photo de supporters adultes célébrant dans une tribune, drapeaux unis et ambiance de match."],
      ["ball-under-arm", "Une adulte en tenue blanche marche le long d’une ligne de touche au petit matin, ballon sous le bras, brume et arbres derrière elle; 70 mm, portrait sportif calme et équipement sans marque.", "Portrait de football d’une adulte au bord du terrain dans la brume, tenue blanche et ballon sous le bras."]
    ]
  },
  {
    slug: "urban",
    label: "Urban",
    anchor: "un portrait urbain documentaire où l’architecture, les trajets et les textures de la ville donnent autant d’identité au sujet que sa tenue",
    directions: [
      ["concrete-plaza", "Une adulte traverse une grande place en béton avec manteau orange et sac bleu, lignes modernistes et ombres de midi autour d’elle; 35 mm, composition graphique et mouvement naturel.", "Portrait urbain d’une adulte sur une place de béton, manteau orange et architecture moderniste."],
      ["metro-exit", "Un adulte sort d’une station de métro en escalier, veste vert olive et écouteurs, foule floue en arrière-plan et aucun panneau lisible; 50 mm, lumière froide et instant documentaire.", "Portrait urbain d’un adulte à la sortie du métro, veste vert olive et foule en mouvement."],
      ["skate-park", "Une adulte tient un skateboard près d’un module en béton, pantalon ample violet et tee-shirt blanc, lumière de fin d’après-midi; grand angle 28 mm, attitude active et espace ouvert.", "Portrait urbain d’une adulte avec skateboard dans un skatepark en béton, tenue violette et lumière dorée."],
      ["corner-cafe", "Un adulte boit un café à emporter devant une façade en briques, vélo attaché et arbres de rue autour, gobelet sans marque; 70 mm, matin frais et bokeh urbain.", "Portrait urbain d’un adulte devant un café de quartier, façade en briques, vélo et lumière matinale."],
      ["mural-color", "Une adulte pose devant une fresque abstraite sans lettres ni personnages protégés, combinaison turquoise et baskets blanches; 50 mm, lumière latérale et couleurs franches de rue.", "Portrait urbain d’une adulte devant une fresque abstraite, combinaison turquoise et couleurs de rue."],
      ["rain-crossing", "Un adulte traverse une avenue sous un parapluie transparent, imperméable jaune et vitrines floues sans enseigne lisible; 35 mm, reflets dans l’asphalte et ambiance après la pluie.", "Portrait urbain d’un adulte sous un parapluie transparent, imperméable jaune et avenue mouillée."],
      ["rooftop-water", "Une adulte remplit une gourde près d’un réservoir sur un toit, skyline dense et ciel rose derrière elle, tenue de sport bleu nuit; 35 mm, lumière d’aube et esprit de ville active.", "Portrait urbain d’une adulte en tenue de sport sur un toit au lever du soleil, skyline et gourde."],
      ["tram-reflection", "Un adulte est photographié à travers la vitre d’un tram, reflet de façades et visage lisible, veste bordeaux et sac en toile; 85 mm, rendu argentique et trajet quotidien.", "Portrait urbain d’un adulte dans un tram, reflets de façades, veste bordeaux et rendu argentique."],
      ["brutalist-underpass", "Une adulte marche sous un passage brutaliste aux plafonds bas, manteau blanc et ombre longue, lignes de fuite très présentes; grand angle 24 mm, contraste dramatique et posture assurée.", "Portrait urbain d’une adulte sous un passage brutaliste, manteau blanc et ombres géométriques."],
      ["flower-stall", "Un adulte achète un bouquet de feuillage auprès d’un étal de rue, chemise rose et marché urbain coloré derrière lui, aucun prix lisible; 50 mm, lumière diffuse et moment spontané.", "Portrait urbain d’un adulte devant un étal végétal, chemise rose et marché coloré."],
      ["night-laundromat", "Une adulte attend dans une laverie automatique de nuit, néons blancs, manteau bleu et machines floues sans marque; 35 mm, scène quotidienne inattendue et palette froide.", "Portrait urbain d’une adulte dans une laverie nocturne, manteau bleu et néons blancs."],
      ["bridge-walk", "Un adulte avance sur une passerelle piétonne au-dessus d’une voie ferrée, veste safran et ville au loin, soleil bas; téléobjectif 70 mm, silhouette nette et profondeur urbaine.", "Portrait urbain d’un adulte sur une passerelle au-dessus des voies, veste safran et soleil bas."],
      ["courtyard-steps", "Une adulte s’assoit sur les marches d’une cour d’immeuble rénovée, pantalon vert et chemise blanche, plantes en pots et murs colorés; 50 mm, lumière de midi et composition de quartier.", "Portrait urbain d’une adulte dans une cour colorée, pantalon vert, chemise blanche et plantes en pots."]
    ]
  },
  {
    slug: "street-style",
    label: "Street style",
    anchor: "une série de mode de rue éditoriale, diverse dans les silhouettes, les couleurs et les lieux, avec une direction de stylisme lisible pour chaque image",
    directions: [
      ["oversized-cobalt", "Une adulte porte un manteau cobalt oversize et des bottes noires devant une façade de verre, mains dans les poches et lumière froide du matin; 50 mm, silhouette mode complète et ligne graphique.", "Street style d’une adulte en manteau cobalt oversize devant une façade de verre, silhouette mode et lumière froide."],
      ["tailored-sand", "Un adulte en costume sable déstructuré et baskets blanches marche sous des arcades en pierre, sac souple à la main; 35 mm, soleil dur et attitude de défilé naturel.", "Street style masculin en costume sable déstructuré sous des arcades en pierre, baskets blanches et soleil franc."],
      ["denim-layered", "Une adulte combine veste denim, jupe plissée orange et bottes argentées près d’un kiosque urbain sans texte lisible; flash direct au 35 mm, palette pop et pose en mouvement.", "Street style d’une adulte en denim, jupe orange et bottes argentées près d’un kiosque urbain."],
      ["monochrome-green", "Un adulte porte une silhouette monochrome vert forêt, col roulé et pantalon large, dans un parking éclairé par bandes fluorescentes; 70 mm, contraste mode et posture calme.", "Street style masculin monochrome vert forêt dans un parking fluorescent, col roulé et pantalon large."],
      ["pink-suit-cafe", "Une adulte en tailleur rose poudré et lunettes transparentes s’assoit à la terrasse d’un café, livre fermé et mobilier graphique; objectif 85 mm, lumière diffuse et élégance contemporaine.", "Street style d’une adulte en tailleur rose poudré à une terrasse, lunettes transparentes et lumière diffuse."],
      ["leather-night", "Un adulte en blouson de cuir brun et pantalon écru marche dans une rue nocturne aux vitrines réfléchissantes sans marques, lampe sodium et silhouette entière; 35 mm, ton cinématographique.", "Street style masculin en cuir brun dans une rue nocturne, pantalon écru et reflets de vitrines."],
      ["yellow-raincoat", "Une adulte en imperméable jaune et pantalon bleu électrique attend sous une marquise en verre, parapluie fermé et pluie derrière elle; 50 mm, couleurs primaires et pose éditoriale.", "Street style d’une adulte en imperméable jaune et pantalon bleu sous la pluie, marquise en verre."],
      ["soft-knit", "Un adulte en cardigan lavande et pantalon gris perle traverse une galerie blanche, sac en cuir sans logo et lumière zénithale; 85 mm, minimalisme tactile et regard direct.", "Street style masculin en cardigan lavande dans une galerie blanche, pantalon gris perle et sac neutre."],
      ["utility-orange", "Une adulte porte une combinaison utilitaire orange et des chaussures de randonnée dans une cour industrielle, tuyaux et murs de briques en profondeur; grand angle 28 mm, mode fonctionnelle et énergie.", "Street style d’une adulte en combinaison utilitaire orange dans une cour industrielle, briques et chaussures de randonnée."],
      ["silk-scarf", "Un adulte en chemise blanche, pantalon noir et foulard de soie turquoise pose devant un hôtel moderniste, porte tournante et ombres de palmier; 70 mm, luxe graphique et mouvement du tissu.", "Street style masculin avec foulard turquoise devant un hôtel moderniste, chemise blanche et pantalon noir."],
      ["layered-wool", "Une adulte superpose manteau en laine prune, chemise rayée et pantalon crème sur un quai de train, valise rigide neutre près d’elle; 35 mm, lumière d’hiver et allure de voyage.", "Street style d’une adulte en manteau prune et couches rayées sur un quai de train, lumière d’hiver."],
      ["sporty-silver", "Un adulte mêle veste de survêtement argentée, pantalon droit noir et chaussures colorées dans un tunnel de métro, lumière cyan et rouge; 24 mm, cadrage audacieux et attitude urbaine.", "Street style masculin en veste argentée dans un tunnel de métro, pantalon noir et lumières cyan-rouge."],
      ["linen-summer", "Une adulte en ensemble de lin blanc et sac tressé marche dans une rue méditerranéenne, murs terracotta et ombres de volets autour; 50 mm, soleil d’été et élégance décontractée.", "Street style d’une adulte en lin blanc dans une rue méditerranéenne, sac tressé et murs terracotta."]
    ]
  },
  {
    slug: "mafia",
    label: "Mafia",
    anchor: "un univers noir de fiction inspiré du cinéma policier, centré sur les personnages, les costumes et l’atmosphère, sans violence graphique, arme ni personne réelle",
    directions: [
      ["1940s-diner", "Un adulte en costume trois pièces brun est assis dans un diner rétro presque vide, banquette rouge et lampe verte au-dessus de lui, aucune arme ni enseigne lisible; 50 mm, clair-obscur de film noir.", "Portrait noir de fiction d’un adulte en costume trois pièces dans un diner rétro, banquette rouge et lumière verte."],
      ["rainy-alley", "Une adulte en long manteau noir marche dans une ruelle mouillée bordée de briques, parapluie fermé à la main et réverbère ambré; 70 mm, tension narrative sans violence ni arme.", "Portrait de fiction noir d’une adulte dans une ruelle pluvieuse, long manteau noir et réverbère ambré."],
      ["smoky-office", "Un adulte en costume gris est debout dans un bureau aux stores vénitiens, téléphone ancien posé sur une table et fumée atmosphérique sans cigarette visible; 85 mm, lumière découpée et expression froide.", "Portrait de fiction inspiré du film noir d’un adulte dans un bureau aux stores vénitiens, costume gris et lumière découpée."],
      ["hotel-lobby", "Une adulte en tailleur bordeaux attend dans le hall d’un hôtel ancien, fauteuil en cuir et horloge sans chiffres lisibles, bouquet sombre à côté d’elle; 50 mm, doré profond et présence assurée.", "Portrait de fiction noir d’une adulte en tailleur bordeaux dans un hall d’hôtel ancien, fauteuil en cuir et lumière dorée."],
      ["train-compartment", "Un adulte en manteau camel est assis dans un compartiment de train Art déco, valise en cuir fermée et fenêtre nocturne derrière lui; 35 mm, reflet de lampe et narration de départ.", "Portrait de fiction noir d’un adulte dans un compartiment Art déco, manteau camel et valise en cuir."],
      ["neon-billiards", "Une adulte en robe noire à col haut se tient près d’une table de billard sous un néon bleu, queue posée contre le mur et aucun jeu en cours; 70 mm, fumée légère et composition de polar stylisé.", "Portrait de fiction noir d’une adulte près d’un billard sous un néon bleu, robe noire et atmosphère de polar."],
      ["harbor-warehouse", "Un adulte en veste de cuir sombre marche dans un entrepôt portuaire vide éclairé par des fenêtres hautes, cordages et caisses neutres autour, aucune arme; grand angle 28 mm et lumière froide.", "Portrait de fiction noir d’un adulte dans un entrepôt portuaire, veste sombre, cordages et lumière froide."],
      ["red-curtain", "Une adulte en costume pantalon ivoire se tient devant un rideau rouge de théâtre, carnet fermé dans une main et projecteur hors foyer; 85 mm, contraste théâtral et regard direct sans violence.", "Portrait de fiction inspiré du polar d’une adulte en costume ivoire devant un rideau rouge, carnet fermé et projecteur."],
      ["classic-car", "Un adulte en trench beige s’appuie contre une voiture ancienne sans marque visible devant un cinéma fermé, pluie fine et enseigne abstraite sans lettres; 50 mm, ambiance de nuit et lumière sodium.", "Portrait de fiction noir d’un adulte en trench beige près d’une voiture ancienne, cinéma fermé et pluie fine."],
      ["marble-stair", "Une adulte en manteau vert bouteille descend un escalier de marbre dans un immeuble ancien, gants rouges et rampe dorée; 35 mm, perspective verticale et élégance menaçante mais non violente.", "Portrait de fiction noir d’une adulte en manteau vert bouteille dans un escalier de marbre, gants rouges et lumière dorée."],
      ["jazz-backstage", "Un adulte en smoking noir attend derrière la scène d’un club de jazz, rideau bleu, pupitre vide et saxophone hors foyer, aucune personne reconnaissable; 85 mm, lumière ambre et calme tendu.", "Portrait de fiction noir d’un adulte en smoking dans les coulisses d’un club de jazz, rideau bleu et lumière ambre."],
      ["rooftop-deal", "Deux adultes en manteaux élégants discutent sur un toit au crépuscule, porte-documents fermé posé entre eux et skyline derrière, mains visibles, aucun objet violent; 70 mm, thriller de conversation et ciel violet.", "Scène de fiction noir de deux adultes discutant sur un toit, porte-documents fermé et skyline au crépuscule."],
      ["dawn-departure", "Une adulte quitte une gare ancienne à l’aube avec un chapeau feutre et une petite valise, vapeur de locomotive en arrière-plan et quai sans texte; 35 mm, palette sépia et fin de récit.", "Portrait de fiction noir d’une adulte quittant une gare à l’aube, chapeau feutre, valise et vapeur sépia."]
    ]
  }
].map((theme) => ({
  ...theme,
  directions: theme.directions.map(([key, brief, alt]) => ({ key, brief, alt }))
}));

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const value = token.slice(2);
    const separator = value.indexOf("=");
    if (separator >= 0) {
      result[value.slice(0, separator)] = value.slice(separator + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[value] = next;
      index += 1;
    } else {
      result[value] = "true";
    }
  }
  return result;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function buildPrompt(theme, direction, index) {
  const slotInstruction = index === 0
    ? "这是主题封面图：完整展示人物上半身与关键环境，人物面部清晰，避免顶部或底部裁切，保证在详情页首屏垂直画幅中完整可读。"
    : "这是详情页独立图库图：必须采用不同的景别、动作、构图和色彩重心，不要复制封面或同主题其他图片的视觉配方。";
  const sensitiveInstruction = ["boudoir", "bikini", "swimsuit"].includes(theme.slug)
    ? "这是面向成年人的审美与旅行编辑影像，保持得体、非露骨、非性暗示的姿态，服装与环境完整可见。"
    : "人物应自然、得体、符合生活方式或编辑摄影语境。";
  return [
    "Crée une photographie originale pour une galerie de photos IA privée destinée au storefront français Aidreamcapes.",
    "Catégorie Lifestyle & créatif; thème : " + theme.label + ".",
    "Ancre visuelle du thème : " + theme.anchor + ".",
    "Direction artistique indépendante de cette image : " + direction.brief,
    slotInstruction,
    sensitiveInstruction,
    "Rendu photographique crédible, détails naturels du visage, des mains, de la peau, des tissus et de la lumière; identité fictive d’un adulte consentant.",
    "Aucun mineur, aucune célébrité, aucune personne réelle reconnaissable, aucune nudité explicite, aucune violence, aucune arme, aucun gore.",
    "Aucun mot, texte lisible, logo, filigrane, interface, marque, blason, enseigne ou emballage identifiable. Pas de collage, grille, écran partagé ni visage dupliqué.",
    "Format vertical 2:3, sujet et décor lisibles, composition naturelle, sans copie d’une autre image et sans réutiliser une recette visuelle voisine."
  ].join("\n");
}

function buildPlan() {
  assert.equal(THEME_PLANS.length, 13, "Lifestyle & créatif must contain thirteen themes.");
  const tasks = [];
  for (const theme of THEME_PLANS) {
    assert.equal(theme.directions.length, 13, theme.slug + " must contain 13 independent directions.");
    theme.directions.forEach((direction, index) => {
      const slot = index === 0 ? "cover" : String(index).padStart(2, "0");
      const prompt = buildPrompt(theme, direction, index);
      const filename = theme.slug + "-" + slot + "-" + direction.key + ".webp";
      tasks.push({
        id: theme.slug + "-" + slot,
        theme: theme.slug,
        themeLabel: theme.label,
        slot,
        directionKey: direction.key,
        artDirection: direction.brief,
        altText: direction.alt,
        prompt,
        filename,
        stageFile: path.join(outputRoot, filename),
        finalFile: path.join(finalRoot, filename),
        outputRelative: path.posix.join("assets/sites/site_aidreamcapes_eu/generated/eu-regenerated", batchId, filename),
        publicUrl: finalPublicRoot + "/" + filename,
        status: "planned",
        providerRequestId: "",
        error: ""
      });
    });
  }
  assert.equal(tasks.length, 169, "The Lifestyle & créatif batch must contain 169 images.");
  assert.equal(new Set(tasks.map((task) => task.prompt)).size, tasks.length, "Prompts must be unique.");
  assert.equal(new Set(tasks.map((task) => task.artDirection)).size, tasks.length, "Art directions must be unique.");
  assert.equal(new Set(tasks.map((task) => task.altText)).size, tasks.length, "Alt text must be unique.");
  assert(tasks.every((task) => task.altText.length >= 35 && task.altText.length <= 180), "Alt text must be descriptive and concise.");
  assert(tasks.every((task) => !/(?:exemple|example|image de couverture|cover image|image \d+)/i.test(task.altText)), "Alt text must not use generic placeholders.");
  return {
    schemaVersion: 3,
    kind: "aidreamcapes-eu-lifestyle-diverse-image-regeneration",
    mode: "planned",
    batchId,
    createdAt: new Date().toISOString(),
    targetSite: targetSiteId,
    targetSiteSlug: "aidreamcapes-eu",
    scope: "Lifestyle & créatif",
    themes: THEME_PLANS.map((theme) => ({ slug: theme.slug, label: theme.label, anchor: theme.anchor, assetCount: theme.directions.length })),
    provider: {
      id: providerId,
      label: "image4",
      model: imageModel,
      endpoint: "",
      providerType: "image",
      size: imageSize,
      quality: imageQuality,
      attemptsPerCreate: 1,
      maxPaidCreateAttempts: tasks.length,
      noAutomaticRetry: true,
      fallback: "disabled"
    },
    diversity: {
      strategy: "theme-anchor-plus-independent-art-direction-plus-multi-fingerprint-cross-image-gate",
      independentArtDirections: tasks.length,
      uniquePrompts: new Set(tasks.map((task) => task.prompt)).size,
      uniqueAltTexts: new Set(tasks.map((task) => task.altText)).size,
      minimumCrossAHashDistance,
      minimumCrossDHashDistance,
      minimumCrossColorHashDistance
    },
    safety: {
      paidCreateAttemptsAuthorizedByBatchScope: null,
      noAutomaticRetry: true,
      noProviderFallback: true,
      ambiguousCreateStateStopsRun: true,
      providerResultRecoveredBeforeAnyRegeneration: true
    },
    counts: {
      lifestyleThemes: THEME_PLANS.length,
      generationTasks: tasks.length,
      covers: tasks.filter((task) => task.slot === "cover").length,
      gallery: tasks.filter((task) => task.slot !== "cover").length
    },
    tasks
  };
}

function bitDistance(left, right) {
  let value = left ^ right;
  let distance = 0;
  while (value) {
    distance += Number(value & 1n);
    value >>= 1n;
  }
  return distance;
}

async function imageFingerprints(filePath) {
  const luminance = await sharp(filePath).resize(8, 8, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let total = 0;
  for (const value of luminance.data) total += value;
  const average = total / luminance.data.length;
  let averageHash = 0n;
  luminance.data.forEach((value, index) => {
    if (value >= average) averageHash |= 1n << BigInt(index);
  });

  const gradient = await sharp(filePath).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let differenceHash = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const index = row * 9 + column;
      if (gradient.data[index] >= gradient.data[index + 1]) differenceHash |= 1n << BigInt(row * 8 + column);
    }
  }

  const color = await sharp(filePath).resize(8, 8, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = [0, 0, 0];
  for (let index = 0; index < color.data.length; index += 3) {
    for (let channel = 0; channel < 3; channel += 1) channels[channel] += color.data[index + channel];
  }
  for (let channel = 0; channel < 3; channel += 1) channels[channel] /= 64;
  let colorHash = 0n;
  for (let pixel = 0; pixel < 64; pixel += 1) {
    const index = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      if (color.data[index + channel] >= channels[channel]) colorHash |= 1n << BigInt(pixel * 3 + channel);
    }
  }
  return { averageHash, differenceHash, colorHash };
}

function imagePayload(body) {
  return body?.data?.[0]?.b64_json || body?.data?.[0]?.image_base64 || body?.output?.[0]?.b64_json || body?.output?.[0]?.image_base64 || body?.image_base64 || "";
}

function imageUrlPayload(body) {
  return body?.data?.[0]?.url || body?.output?.[0]?.url || body?.url || "";
}

function redactedBody(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => {
    if (/(?:b64|base64)/i.test(key) && typeof value === "string") return "[omitted:" + value.length + "]";
    return value;
  }));
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: providerId },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, preferred: true, maxImagesPerRequest: true }
    });
    assert(provider, "image4 provider was not found.");
    assert.equal(provider.providerType, "image", "image4 must be an image provider.");
    assert(provider.enabled, "image4 must be enabled.");
    assert(provider.apiKey && provider.aiUrl, "image4 must have a configured URL and key.");
    assert.equal(provider.modelType, imageModel, "image4 model must be gpt-image-2.");
    return { id: provider.id, label: provider.label, baseUrl: normalizeBaseUrl(provider.aiUrl), apiKey: providerApiKeyOverride || provider.apiKey, model: provider.modelType, maxImagesPerRequest: provider.maxImagesPerRequest, keySource: providerApiKeyOverride ? "explicit-runtime-override" : "database" };
  } finally {
    await prisma.$disconnect();
  }
}

async function checkProviderReadOnly(provider) {
  const response = await fetch(provider.baseUrl + "/v1/models", { headers: { Authorization: "Bearer " + provider.apiKey }, signal: AbortSignal.timeout(30_000) });
  const body = await response.json().catch(() => ({}));
  const ids = Array.isArray(body?.data) ? body.data.map((item) => item?.id).filter(Boolean) : [];
  assert(response.ok, "Provider read-only model check failed with " + response.status + ".");
  assert(ids.length === 0 || ids.includes(provider.model), "Provider read-only model check did not expose gpt-image-2.");
  return { status: response.status, modelCount: ids.length, modelMatch: ids.length === 0 ? "provider did not expose model list" : ids.includes(provider.model) };
}

async function convertProviderOutput(body, task) {
  let inputBuffer;
  const encoded = imagePayload(body);
  if (encoded) {
    inputBuffer = Buffer.from(encoded, "base64");
  } else {
    const remoteUrl = imageUrlPayload(body);
    assert(remoteUrl, task.id + ": provider returned no image payload.");
    const response = await fetch(remoteUrl, { signal: AbortSignal.timeout(60_000) });
    assert(response.ok, task.id + ": provider output download failed with " + response.status + ".");
    inputBuffer = Buffer.from(await response.arrayBuffer());
  }
  await sharp(inputBuffer).rotate().resize(1024, 1536, { fit: "cover", position: "attention" }).webp({ quality: 92, smartSubsample: true }).toFile(task.stageFile);
}

async function generate(manifest) {
  assert.equal(String(args.confirm || ""), expectedConfirmation, "Generation requires --confirm=" + expectedConfirmation);
  const maxPaidAttempts = Number(args["max-paid-attempts"] || 0);
  assert(Number.isInteger(maxPaidAttempts) && maxPaidAttempts >= manifest.tasks.length, "Generation requires --max-paid-attempts>=" + manifest.tasks.length);
  const provider = await loadProvider();
  const modelCheck = await checkProviderReadOnly(provider);
  const explicitResume = String(args["resume-after-explicit-approval"] || "") === "true";
  const resolveUnknownAsFailed = String(args["resolve-unknown-as-failed"] || "") === "true";
  const stopAfterTask = String(args["stop-after-task"] || "");
  const previousRuntime = manifest.runtime || {};
  if (Number(previousRuntime.paidCreateAttempts || 0) > 0) {
    assert(explicitResume, "Existing provider attempts require --resume-after-explicit-approval=true.");
    assert(Number(previousRuntime.ambiguous || 0) === 0 || resolveUnknownAsFailed, "Ambiguous provider state requires --resolve-unknown-as-failed=true.");
    for (const task of manifest.tasks) {
      if (task.status === "failed" || (task.status === "unknown_provider_state" && resolveUnknownAsFailed)) {
        task.status = "planned";
        task.error = "";
      }
    }
    manifest.runtime.succeeded = manifest.tasks.filter((task) => task.status === "succeeded").length;
    manifest.runtime.failed = manifest.tasks.filter((task) => task.status === "failed").length;
    manifest.runtime.ambiguous = manifest.tasks.filter((task) => task.status === "unknown_provider_state").length;
  }
  manifest.provider = { ...manifest.provider, endpoint: provider.baseUrl + providerImageGenerationsPath, maxImagesPerRequest: provider.maxImagesPerRequest, maxPaidCreateAttempts: maxPaidAttempts, readOnlyModelCheck: modelCheck, keySource: provider.keySource };
  manifest.safety.paidCreateAttemptsAuthorizedByBatchScope = maxPaidAttempts;
  for (const task of manifest.tasks) {
    const override = PROMPT_OVERRIDES[task.id];
    if (override) {
      task.prompt = override.prompt;
      task.artDirection = override.artDirection;
      task.promptRevision = override.revision;
    }
  }
  manifest.runtime = {
    paidCreateAttempts: Number(previousRuntime.paidCreateAttempts || 0),
    succeeded: manifest.tasks.filter((task) => task.status === "succeeded").length,
    failed: manifest.tasks.filter((task) => task.status === "failed").length,
    ambiguous: Number(previousRuntime.ambiguous || 0),
    startedAt: previousRuntime.startedAt || new Date().toISOString(),
    resumedAt: explicitResume ? new Date().toISOString() : previousRuntime.resumedAt,
    providerRequestIds: Array.isArray(previousRuntime.providerRequestIds) ? previousRuntime.providerRequestIds : []
  };
  writeJson(manifestPath, manifest);
  fs.mkdirSync(outputRoot, { recursive: true });
  console.log(JSON.stringify({ operation: "paid-create", endpoint: provider.baseUrl + providerImageGenerationsPath, method: "POST", provider: provider.label, model: provider.model, size: imageSize, quality: imageQuality, maxPaidCreateAttempts: maxPaidAttempts, attemptsPerCreate: 1, retry: false, fallback: false, stopCondition: "stop on first failed or ambiguous create; evaluate diversity before apply" }, null, 2));

  for (const task of manifest.tasks) {
    if (task.status === "succeeded") continue;
    assert(manifest.runtime.paidCreateAttempts < maxPaidAttempts, "paid_create_cap_exceeded");
    const promptRevision = PROMPT_OVERRIDES[task.id]?.revision || "original";
    const idempotencyKey = expectedConfirmation + ":" + manifest.batchId + ":" + task.id + (promptRevision === "original" ? "" : ":" + promptRevision);
    const startedAt = Date.now();
    manifest.runtime.paidCreateAttempts += 1;
    let response;
    let body = {};
    try {
      response = await fetch(provider.baseUrl + providerImageGenerationsPath, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + provider.apiKey, "Idempotency-Key": idempotencyKey, "X-Client-Request-Id": task.id },
        body: JSON.stringify({ model: provider.model, prompt: task.prompt, size: imageSize, quality: imageQuality, response_format: "b64_json" }),
        signal: AbortSignal.timeout(maxCreateTimeoutMs)
      });
      body = await response.json().catch(() => ({}));
    } catch (error) {
      task.status = "unknown_provider_state";
      task.error = error instanceof Error ? error.message : String(error);
      manifest.runtime.ambiguous += 1;
      manifest.runtime.failed += 1;
      writeJson(
        path.join(path.dirname(manifestPath), manifest.batchId + "-" + task.id + "-provider.json"),
        {
          taskId: task.id,
          providerId: provider.id,
          providerLabel: provider.label,
          model: provider.model,
          endpoint: provider.baseUrl + providerImageGenerationsPath,
          idempotencyKey,
          clientRequestId: task.id,
          requestId: "",
          status: null,
          elapsedMs: Date.now() - startedAt,
          error: task.error,
          retryPolicy: "no-retry"
        }
      );
      writeJson(path.join(path.dirname(manifestPath), manifest.batchId + "-provider-audit.json"), manifest.runtime);
      writeJson(manifestPath, manifest);
      throw new Error(task.id + ": ambiguous provider create state; stopped without retry.");
    }
    const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
    writeJson(path.join(path.dirname(manifestPath), manifest.batchId + "-" + task.id + "-provider.json"), { taskId: task.id, providerId: provider.id, providerLabel: provider.label, model: provider.model, endpoint: provider.baseUrl + providerImageGenerationsPath, idempotencyKey, clientRequestId: task.id, requestId, status: response.status, elapsedMs: Date.now() - startedAt, response: redactedBody(body), retryPolicy: "no-retry" });
    if (!response.ok) {
      task.status = "failed";
      task.error = "provider_status_" + response.status;
      manifest.runtime.failed += 1;
      writeJson(manifestPath, manifest);
      throw new Error(task.id + ": provider create failed; stopped without retry.");
    }
    try {
      await convertProviderOutput(body, task);
    } catch (error) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : String(error);
      manifest.runtime.failed += 1;
      writeJson(manifestPath, manifest);
      throw new Error(task.id + ": provider result conversion failed; stopped without retry.");
    }
    task.outputHash = sha256(fs.readFileSync(task.stageFile));
    task.outputFingerprints = Object.fromEntries(Object.entries(await imageFingerprints(task.stageFile)).map(([key, value]) => [key, value.toString(16)]));
    task.providerRequestId = requestId;
    task.status = "succeeded";
    task.error = "";
    manifest.runtime.succeeded += 1;
    manifest.runtime.providerRequestIds.push({ taskId: task.id, requestId });
    writeJson(manifestPath, manifest);
    console.log("succeeded " + task.id + " (" + manifest.runtime.succeeded + "/" + manifest.tasks.length + ")");
    if (stopAfterTask === task.id) {
      manifest.runtime.probeStoppedAt = task.id;
      manifest.runtime.probeStoppedAtAt = new Date().toISOString();
      writeJson(manifestPath, manifest);
      console.log("probe stopped after " + task.id);
      return;
    }
  }

  const diversityResult = await evaluateDiversity(manifest);
  manifest.diversityResult = diversityResult;
  manifest.runtime.completedAt = new Date().toISOString();
  manifest.runtime.qualityFailed = diversityResult.pass ? 0 : diversityResult.failures.length;
  writeJson(manifestPath, manifest);
  assert(diversityResult.pass, "Diversity gate failed; no assets were applied.");
  console.log(JSON.stringify({ ok: true, paidCreateAttempts: manifest.runtime.paidCreateAttempts, diversity: diversityResult }, null, 2));
}

async function evaluateDiversity(manifest) {
  const failures = [];
  const prompts = new Set(manifest.tasks.map((task) => task.prompt));
  const directions = new Set(manifest.tasks.map((task) => task.artDirection));
  const alts = new Set(manifest.tasks.map((task) => task.altText));
  if (prompts.size !== manifest.tasks.length) failures.push("duplicate_prompts");
  if (directions.size !== manifest.tasks.length) failures.push("duplicate_art_directions");
  if (alts.size !== manifest.tasks.length) failures.push("duplicate_alt_text");
  const hashes = [];
  const outputHashes = new Set();
  for (const task of manifest.tasks) {
    assert(fs.existsSync(task.stageFile), "Missing staged image: " + task.stageFile);
    outputHashes.add(sha256(fs.readFileSync(task.stageFile)));
    hashes.push({ id: task.id, hashes: await imageFingerprints(task.stageFile) });
  }
  if (outputHashes.size < minimumUniqueImageHashCount) failures.push("duplicate_output_hash");
  let minAverageDistance = 64;
  let minDifferenceDistance = 64;
  let minColorDistance = 192;
  let closestAveragePair = null;
  let closestDifferencePair = null;
  let closestColorPair = null;
  const visuallyClosePairs = [];
  for (let left = 0; left < hashes.length; left += 1) {
    for (let right = left + 1; right < hashes.length; right += 1) {
      const averageDistance = bitDistance(hashes[left].hashes.averageHash, hashes[right].hashes.averageHash);
      const differenceDistance = bitDistance(hashes[left].hashes.differenceHash, hashes[right].hashes.differenceHash);
      const colorDistance = bitDistance(hashes[left].hashes.colorHash, hashes[right].hashes.colorHash);
      if (averageDistance < minAverageDistance) { minAverageDistance = averageDistance; closestAveragePair = [hashes[left].id, hashes[right].id]; }
      if (differenceDistance < minDifferenceDistance) { minDifferenceDistance = differenceDistance; closestDifferencePair = [hashes[left].id, hashes[right].id]; }
      if (colorDistance < minColorDistance) { minColorDistance = colorDistance; closestColorPair = [hashes[left].id, hashes[right].id]; }
      if (averageDistance < minimumCrossAHashDistance && differenceDistance < minimumCrossDHashDistance && colorDistance < minimumCrossColorHashDistance) {
        visuallyClosePairs.push({ pair: [hashes[left].id, hashes[right].id], averageDistance, differenceDistance, colorDistance });
      }
    }
  }
  if (visuallyClosePairs.length) failures.push("cross_image_visual_similarity_pairs=" + visuallyClosePairs.length);
  return { pass: failures.length === 0, minimumCrossAHashDistance, minimumCrossDHashDistance, minimumCrossColorHashDistance, actualMinimumCrossAHashDistance: minAverageDistance, actualMinimumCrossDHashDistance: minDifferenceDistance, actualMinimumCrossColorDistance: minColorDistance, closestAveragePair, closestDifferencePair, closestColorPair, visuallyClosePairs, uniqueOutputHashes: outputHashes.size, failures };
}

async function apply(manifest) {
  assert.equal(String(args.confirm || ""), expectedConfirmation, "Apply requires --confirm=" + expectedConfirmation);
  assert.equal(manifest.runtime?.succeeded, manifest.tasks.length, "All provider tasks must succeed before apply.");
  assert.equal(manifest.runtime?.failed, 0, "Failed provider tasks block apply.");
  assert.equal(manifest.diversityResult?.pass, true, "Diversity gate must pass before apply.");
  assertDatabaseTarget({ expectedTarget: "local" });
  assertNonProductionWriteTarget();
  assert(!fs.existsSync(finalRoot), "Final output directory already exists: " + finalRoot);

  const prisma = new PrismaClient();
  try {
    const slugs = manifest.themes.map((theme) => theme.slug);
    const packs = await prisma.creativePack.findMany({ where: { siteId: targetSiteId, status: "active", categoryRecord: { slug: { in: slugs } } }, include: { categoryRecord: true } });
    assert.equal(packs.length, slugs.length, "Expected all thirteen active Lifestyle packs.");
    const bySlug = new Map(packs.map((pack) => [pack.categoryRecord?.slug, pack]));
    for (const slug of slugs) assert(bySlug.has(slug), "Missing active pack: " + slug);
    const backupPath = path.join(path.dirname(manifestPath), manifest.batchId + "-apply-backup.json");
    writeJson(backupPath, { createdAt: new Date().toISOString(), target: "local", siteId: targetSiteId, packs: packs.map((pack) => ({ id: pack.id, categoryId: pack.categoryId, imageUrl: pack.imageUrl, galleryImages: pack.galleryImages, galleryImageAlts: pack.galleryImageAlts, categoryRecord: pack.categoryRecord })) });
    for (const task of manifest.tasks) {
      assert(fs.existsSync(task.stageFile), "Missing staged image: " + task.stageFile);
      fs.mkdirSync(path.dirname(task.finalFile), { recursive: true });
      fs.copyFileSync(task.stageFile, task.finalFile);
    }
    const grouped = new Map();
    for (const task of manifest.tasks) {
      const group = grouped.get(task.theme) || { cover: null, gallery: [] };
      if (task.slot === "cover") group.cover = task;
      else group.gallery.push(task);
      grouped.set(task.theme, group);
    }
    const updated = await prisma.$transaction(async (tx) => {
      for (const theme of manifest.themes) {
        const pack = bySlug.get(theme.slug);
        const group = grouped.get(theme.slug);
        assert(group?.cover && group.gallery.length === 12, "Incomplete theme: " + theme.slug);
        group.gallery.sort((left, right) => left.slot.localeCompare(right.slot, undefined, { numeric: true }));
        const ordered = [group.cover, ...group.gallery];
        await tx.creativePackCategory.update({ where: { id: pack.categoryRecord.id }, data: { imageUrl: group.cover.publicUrl } });
        await tx.creativePack.update({ where: { id: pack.id }, data: { imageUrl: group.cover.publicUrl, galleryImages: group.gallery.map((task) => task.publicUrl), galleryImageAlts: ordered.map((task) => task.altText) } });
        for (const task of ordered) {
          const storageKey = task.outputRelative;
          const mediaId = "media_site_aidreamcapes_xby_" + sha256(storageKey).slice(0, 16);
          await tx.mediaAsset.upsert({
            where: { siteId_storageKey: { siteId: targetSiteId, storageKey } },
            create: { id: mediaId, siteId: targetSiteId, label: task.altText, storageKey, mimeType: "image/webp", usageType: "package", sourceType: "ai-diverse-regeneration", previewUrl: task.publicUrl, originUrl: task.publicUrl, altText: task.altText },
            update: { label: task.altText, mimeType: "image/webp", usageType: "package", sourceType: "ai-diverse-regeneration", previewUrl: task.publicUrl, originUrl: task.publicUrl, altText: task.altText }
          });
        }
      }
      return { updatedPacks: slugs.length, updatedCategories: slugs.length, mediaAssets: manifest.tasks.length };
    }, { timeout: 120_000 });
    for (const theme of manifest.themes) {
      const pack = bySlug.get(theme.slug);
      const group = grouped.get(theme.slug);
      group.gallery.sort((left, right) => left.slot.localeCompare(right.slot, undefined, { numeric: true }));
      const expected = { imageUrl: group.cover.publicUrl, galleryImages: group.gallery.map((task) => task.publicUrl), galleryImageAlts: [group.cover, ...group.gallery].map((task) => task.altText) };
      const readback = await prisma.creativePack.findUnique({ where: { id: pack.id }, select: { imageUrl: true, galleryImages: true, galleryImageAlts: true } });
      assert.equal(readback?.imageUrl, expected.imageUrl, "Cover readback failed: " + theme.slug);
      assert.deepEqual(readback?.galleryImages, expected.galleryImages, "Gallery readback failed: " + theme.slug);
      assert.deepEqual(readback?.galleryImageAlts, expected.galleryImageAlts, "Alt readback failed: " + theme.slug);
      assert(readback.galleryImageAlts.every((alt) => typeof alt === "string" && alt.length >= 35 && !/(?:exemple|example|image de couverture|cover image)/i.test(alt)), "SEO alt readback failed: " + theme.slug);
    }
    manifest.apply = { target: "local", appliedAt: new Date().toISOString(), generated: manifest.tasks.length, backupPath, finalRoot, protectedChanged: false, unrelatedChanged: false, updated };
    manifest.mode = "applied";
    writeJson(manifestPath, manifest);
    console.log(JSON.stringify({ ok: true, mode: "applied", batchId, updated }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assert(["plan", "generate", "apply"].includes(mode), "Unsupported mode: " + mode);
  if (mode === "plan") {
    if (fs.existsSync(manifestPath)) {
      const existingManifest = readJson(manifestPath);
      assert(Number(existingManifest.runtime?.paidCreateAttempts || 0) === 0, "Refusing to rebuild a manifest with provider attempts; use the existing batch manifest.");
    }
    const manifest = buildPlan();
    writeJson(manifestPath, manifest);
    console.log(JSON.stringify({ ok: true, mode, manifestPath, batchId, generationTasks: manifest.tasks.length, uniquePrompts: manifest.diversity.uniquePrompts, uniqueArtDirections: manifest.diversity.independentArtDirections, uniqueAltTexts: manifest.diversity.uniqueAltTexts, themes: manifest.themes.map((theme) => theme.slug), provider: manifest.provider }, null, 2));
    return;
  }
  const manifest = readJson(manifestPath);
  assert.equal(manifest.batchId, batchId, "Manifest batch id mismatch.");
  if (mode === "generate") await generate(manifest);
  else await apply(manifest);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
