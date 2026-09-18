#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "plan").toLowerCase();
const batchId = String(args.batch || "aidreamcapes-eu-professional-diverse-20260913-v2");
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
const expectedConfirmation = "aidreamcapes-eu-professional-diverse-regeneration";
const minimumCrossAHashDistance = 10;
const minimumCrossDHashDistance = 12;
const minimumCrossColorHashDistance = 24;
const minimumUniqueImageHashCount = 91;

const THEME_PLANS = [
  {
    slug: "avatar",
    label: "Avatar",
    anchor: "un portrait d’identité personnelle contemporain, immédiatement lisible comme une image de profil premium et non comme une photo corporate générique",
    directions: [
      { key: "cobalt-studio", brief: "Un adulte seul est photographié dans un studio bleu cobalt aux panneaux mats, debout de trois-quarts, les épaules ouvertes et le regard directement dirigé vers l’objectif; éclairage flash doux de magazine, blazer bleu nuit sur t-shirt ivoire, cadrage poitrine très net, arrière-plan minimal sans accessoire.", alt: "Avatar adulte en blazer bleu nuit dans un studio cobalt, regard direct et éclairage éditorial doux." },
      { key: "mirror-loft", brief: "Dans un loft lumineux rempli de miroirs verticaux, une jeune adulte ajuste une boucle d’oreille devant son reflet puis regarde l’objectif par-dessus son épaule; photographie lifestyle au 50 mm, chemise en lin safran, lumière du matin et reflets géométriques, cadrage taille avec profondeur visible.", alt: "Avatar féminin dans un loft aux miroirs, chemise safran et lumière matinale." },
      { key: "bicycle-courier", brief: "Un adulte à vélo s’arrête dans une rue européenne colorée avec son casque sous le bras, posture naturelle et sourire discret; style portrait documentaire pris au 35 mm, veste coupe-vent vert menthe, murs peints et ombres de fin d’après-midi, composition en pied avec beaucoup de contexte urbain.", alt: "Avatar adulte avec vélo dans une rue colorée, veste vert menthe et portrait documentaire." },
      { key: "ceramics-workshop", brief: "Une adulte seule travaille dans un atelier de céramique clair, les mains légèrement couvertes d’argile et une petite forme abstraite posée devant elle; lumière latérale industrielle, tablier terracotta sur pull crème, mise au point sur le visage et les mains, image chaleureuse prise sur le vif.", alt: "Avatar féminin dans un atelier de céramique, tablier terracotta et mains couvertes d’argile." },
      { key: "rooftop-dawn", brief: "Au lever du soleil sur une terrasse d’immeuble, un adulte en veste légère regarde la ville avec confiance, silhouette placée sur le tiers gauche et ciel pastel dominant; traitement cinématographique grand angle, pantalon beige, chemise blanche et vent visible dans le vêtement, ambiance d’indépendance.", alt: "Avatar adulte sur une terrasse au lever du jour, ville pastel et veste légère au vent." },
      { key: "library-lamp", brief: "Une adulte est assise dans une bibliothèque contemporaine sombre, un livre fermé sans texte lisible posé sur ses genoux, visage tourné vers une lampe sculpturale; portrait au 85 mm avec faible profondeur de champ, cardigan violet prune, lumière ponctuelle chaude et expression réfléchie.", alt: "Avatar féminin assis dans une bibliothèque contemporaine sous une lampe chaude." },
      { key: "market-stall", brief: "Dans un marché couvert aux tissus orange, turquoise et rose, un adulte tient un bouquet de feuillage sans fleurs dominantes et échange un regard complice avec l’objectif; photographie de rue spontanée au 35 mm, veste denim et pull orange brûlé, lumière diffuse et arrière-plan vivant.", alt: "Avatar adulte dans un marché coloré, veste denim et lumière diffuse de rue." },
      { key: "brutalist-hall", brief: "Une adulte au profil marqué pose dans un hall brutaliste en béton clair, assise sur un banc monolithique et tournée vers une bande de lumière naturelle; composition graphique symétrique, col roulé blanc sous veste noire, contraste monochrome et espace négatif assumé.", alt: "Avatar féminin dans un hall brutaliste, tenue noire et blanche et composition graphique." },
      { key: "record-shop-flash", brief: "Un adulte souriant est photographié au flash direct dans une boutique de disques vintage, vinyles flous en arrière-plan sans titre lisible; esthétique instantanée 35 mm, chemise rayée bleu et crème, posture légèrement inclinée et couleurs saturées façon portrait social.", alt: "Avatar adulte au flash dans une boutique de disques vintage, chemise rayée et couleurs saturées." },
      { key: "forest-trail", brief: "Une adulte seule marche sur un sentier forestier humide après la pluie, s’arrêtant pour regarder l’objectif avec une expression assurée; portrait environnemental au téléobjectif, imperméable rouge brique, fougères et brume douce, palette organique et cadrage mi-corps.", alt: "Avatar féminin sur un sentier forestier humide, imperméable brique et brume légère." },
      { key: "neon-arcade", brief: "Un adulte est debout dans une salle d’arcade rétro éclairée par des tubes magenta et cyan, manette tenue contre la poitrine sans écran lisible; portrait nocturne au 35 mm, bomber argenté et t-shirt noir, lumière colorée sur le visage et énergie ludique.", alt: "Avatar adulte dans une salle d’arcade néon, bomber argenté et lumière magenta-cyan." },
      { key: "sketchbook-desk", brief: "Une adulte est assise à un bureau d’artiste près d’une fenêtre, carnet ouvert mais sans écriture visible, crayons et matières abstraites autour d’elle; image calme au 50 mm, combinaison bleu ardoise, lumière naturelle blanche et geste de dessin interrompu pour regarder l’objectif.", alt: "Avatar féminin à un bureau d’artiste, carnet ouvert et lumière naturelle de fenêtre." },
      { key: "coastal-wind", brief: "Un adulte se tient sur une plage rocheuse au bord d’une mer grise, manteau long soulevé par le vent et visage tourné vers la caméra; photographie éditoriale grand angle, pull vert mousse et pantalon sable, horizon dégagé et sensation d’espace personnel.", alt: "Avatar adulte sur une côte rocheuse, manteau au vent et horizon marin dégagé." }
    ]
  },
  {
    slug: "headshot",
    label: "Portraits professionnels",
    anchor: "un portrait professionnel crédible, humain et adapté à une bio, une équipe ou un profil de carrière, avec un contexte de métier clairement distinct",
    directions: [
      { key: "architect-office", brief: "Une architecte adulte pose dans un atelier lumineux avec des maquettes blanches et des plans retournés sans texte lisible, appuyée contre une table de travail; objectif 85 mm, veste ivoire et chemise bleu pâle, lumière latérale du nord et expression calme de leadership.", alt: "Portrait professionnel d’une architecte dans un atelier lumineux avec maquettes blanches." },
      { key: "chef-kitchen", brief: "Un chef adulte est photographié dans une cuisine professionnelle en acier, toque absente, tablier vert forêt et torchon sur l’épaule, tenant une cuillère en bois sans nourriture mise en scène; portrait documentaire au 50 mm, vapeur douce et lumière chaude de service.", alt: "Portrait professionnel d’un chef en cuisine inox, tablier vert forêt et lumière chaleureuse." },
      { key: "botanical-researcher", brief: "Une chercheuse adulte se tient dans une serre botanique avec des feuilles tropicales en profondeur, lunettes posées sur la tête et carnet fermé dans la main; cadrage poitrine au 85 mm, veste beige et pull vert sauge, lumière filtrée et rendu naturel.", alt: "Portrait professionnel d’une chercheuse dans une serre botanique, veste beige et feuillage tropical." },
      { key: "film-editor", brief: "Un monteur vidéo adulte pose dans une salle de montage sombre avec plusieurs moniteurs volontairement flous et sans interface lisible, casque autour du cou; éclairage bleu froid de bord et lampe orange de bureau, sweat gris structuré, portrait trois-quarts au 50 mm.", alt: "Portrait professionnel d’un monteur vidéo dans une salle de montage aux lumières bleue et orange." },
      { key: "ceramic-designer", brief: "Une designer adulte est portraiturée dans un studio de design avec des échantillons de céramique et des volumes colorés, mains propres posées sur une table; objectif 85 mm, chemisier rose poudré et pantalon charbon, lumière douce et arrière-plan tactile.", alt: "Portrait professionnel d’une designer dans un studio de céramique aux échantillons colorés." },
      { key: "urban-planner", brief: "Un urbaniste adulte se tient sur une passerelle vitrée avec une ville moderne floue derrière lui, veste camel et col roulé marine; cadrage taille au 70 mm, lumière de fin de journée, lignes architecturales diagonales et posture ouverte.", alt: "Portrait professionnel d’un urbaniste sur une passerelle vitrée avec ville moderne en arrière-plan." },
      { key: "florist-studio", brief: "Une fleuriste adulte pose dans son atelier parmi des feuillages, des vases de formes variées et quelques fleurs blanches, sans composition de mariage; portrait rapproché au 50 mm, tablier bleu pétrole, lumière diffuse de fenêtre et sourire discret.", alt: "Portrait professionnel d’une fleuriste dans un atelier végétal aux vases variés." },
      { key: "sound-engineer", brief: "Un ingénieur du son adulte est photographié dans une cabine de studio avec panneaux acoustiques et console floue sans marque lisible, une main sur le dossier d’un fauteuil; lumière rouge sombre et halo violet, chemise noire, portrait de profil net au 85 mm.", alt: "Portrait professionnel d’un ingénieur du son en studio, panneaux acoustiques et lumière violette." },
      { key: "museum-curator", brief: "Une conservatrice adulte pose dans une galerie de musée blanche devant une sculpture abstraite, mains croisées et regard direct; photographie au 85 mm, costume lavande, lumière de musée très propre, composition frontale avec espace négatif et aucune œuvre reconnaissable.", alt: "Portrait professionnel d’une conservatrice dans une galerie blanche devant une sculpture abstraite." },
      { key: "mountain-guide", brief: "Un guide de montagne adulte est portraituré devant une paroi rocheuse et une vallée brumeuse, lunettes de soleil accrochées au col et sac technique visible; objectif 50 mm, veste orange brûlé et bonnet gris, lumière froide d’altitude et expression fiable.", alt: "Portrait professionnel d’un guide de montagne devant une vallée brumeuse, veste orange et sac technique." },
      { key: "atelier-tailor", brief: "Une couturière adulte pose dans un atelier de confection avec rouleaux de tissu et mannequin sans vêtement de marque, tenant un mètre souple; cadrage poitrine au 50 mm, blouse blanche et pantalon bleu encre, lumière chaude de lampe et détails textiles.", alt: "Portrait professionnel d’une couturière dans un atelier de confection aux rouleaux de tissu." },
      { key: "coastal-scientist", brief: "Une biologiste marine adulte est photographiée sur un quai calme avec bouées et eau turquoise en arrière-plan, combinaison de travail ouverte sur un pull clair, aucun logo; portrait au 70 mm, lumière naturelle brillante et regard assuré.", alt: "Portrait professionnel d’une biologiste marine sur un quai, eau turquoise et tenue de terrain." },
      { key: "community-teacher", brief: "Un formateur adulte pose dans une salle communautaire lumineuse avec chaises colorées et tableau effacé sans mots lisibles, tenant un marqueur fermé; style reportage au 35 mm, chemise jaune pâle et pantalon brun, lumière douce et expression accueillante.", alt: "Portrait professionnel d’un formateur dans une salle communautaire aux chaises colorées." }
    ]
  },
  {
    slug: "gala-photo",
    label: "Portraits de gala",
    anchor: "une photographie de soirée élégante, cérémonielle ou tapis rouge, avec un vêtement formel et une architecture d’événement clairement reconnaissable",
    directions: [
      { key: "red-carpet-steps", brief: "Une adulte en combinaison noire structurée monte quelques marches de marbre devant un théâtre éclairé, tenant une pochette argentée et regardant l’objectif; objectif 50 mm, flash de tapis rouge maîtrisé, reflets humides et ambiance d’arrivée officielle.", alt: "Portrait de gala féminin sur des marches de marbre, combinaison noire et pochette argentée." },
      { key: "opera-foyer", brief: "Un adulte en smoking ivoire se tient dans le foyer d’un opéra avec lustre monumental et colonnes dorées, mains détendues et visage net; portrait au 85 mm, lumière ambre de salle, profondeur de champ courte et élégance classique.", alt: "Portrait de gala masculin dans un foyer d’opéra, smoking ivoire et lustre doré." },
      { key: "velvet-theatre", brief: "Une adulte en robe longue vert émeraude sans décolleté pose dans un théâtre aux fauteuils de velours, assise au bord d’une loge et tournée vers la lumière; rendu cinématographique au 85 mm, rouges profonds et ombres douces.", alt: "Portrait de gala féminin en robe émeraude dans une loge de théâtre en velours." },
      { key: "museum-night", brief: "Un adulte en costume bleu nuit marche dans une galerie de musée après la fermeture, entouré de sculptures abstraites et de faisceaux directionnels; cadrage en pied au 35 mm, chaussures vernies, lumière froide et posture naturelle en mouvement.", alt: "Portrait de gala masculin en costume bleu nuit dans une galerie de musée nocturne." },
      { key: "rooftop-tuxedo", brief: "Une adulte en tailleur blanc cassé pose sur un toit-terrasse avec skyline nocturne, coupe de champagne absente et mains libres sur la veste; portrait éditorial au 70 mm, vent léger, lumières de ville et palette nacrée.", alt: "Portrait de gala féminin en tailleur blanc cassé sur une terrasse avec skyline nocturne." },
      { key: "art-deco-staircase", brief: "Un adulte en costume bordeaux descend un escalier Art déco aux rampes géométriques, une main sur la rampe et un regard latéral; objectif 50 mm, lumière latérale dorée, composition symétrique et texture de velours visible.", alt: "Portrait de gala masculin dans un escalier Art déco, costume bordeaux et lumière dorée." },
      { key: "winter-courtyard", brief: "Une adulte en manteau de soirée bleu glacier se tient dans une cour d’hôtel en hiver, arbres nus et lanternes chaudes autour d’elle; photographie au 85 mm, gants satinés, souffle léger dans l’air froid et humeur sophistiquée.", alt: "Portrait de gala féminin dans une cour d’hôtel hivernale, manteau bleu glacier et lanternes." },
      { key: "blank-press-wall", brief: "Un adulte en costume noir minimaliste pose devant un mur de couleur prune sans aucun logo ni texte, avec une lumière de flash latérale et une ombre nette; portrait frontal au 85 mm, mains croisées et rendu de photocall haut de gamme.", alt: "Portrait de gala masculin devant un mur prune sans logo, costume noir et flash latéral." },
      { key: "jazz-club", brief: "Une adulte en robe bleu pétrole est assise dans un club de jazz intimiste, saxophone et tables flous en arrière-plan sans personne identifiable; éclairage ponctuel ambre et bleu, objectif 50 mm, pose détendue et sourire vers la caméra.", alt: "Portrait de gala féminin en robe bleu pétrole dans un club de jazz éclairé à l’ambre." },
      { key: "glass-pavilion", brief: "Un adulte en smoking blanc et pantalon noir pose dans un pavillon vitré contemporain sous une pluie fine, reflets de la ville sur les vitres; grand angle 35 mm, lumière cyan, silhouette entière et attitude calme de cérémonie.", alt: "Portrait de gala masculin dans un pavillon vitré sous la pluie, smoking blanc et lumière cyan." },
      { key: "garden-soiree", brief: "Une adulte en robe longue jaune safran marche dans un jardin de soirée avec guirlandes lumineuses, feuillage et mobilier discret; cadrage en mouvement au 50 mm, chaussures plates élégantes, lumière chaude et expression spontanée.", alt: "Portrait de gala féminin en robe safran dans un jardin illuminé de soirée." },
      { key: "marble-lobby", brief: "Un adulte en costume gris perle est appuyé contre une colonne de marbre dans le hall d’un hôtel, fleurs blanches discrètes et lumière zénithale; objectif 85 mm, composition verticale sobre, mains visibles et regard confiant.", alt: "Portrait de gala masculin en costume gris perle dans un hall d’hôtel en marbre." },
      { key: "stage-curtain", brief: "Une adulte en robe noire à manches longues se tient devant un rideau de scène rouge profond, un micro hors champ et aucune performance reconnaissable; lumière de projecteur douce, cadrage poitrine au 70 mm et expression concentrée.", alt: "Portrait de gala féminin devant un rideau de scène rouge, robe noire et lumière de projecteur." }
    ]
  },
  {
    slug: "portrait-photo",
    label: "Portraits personnels",
    anchor: "un portrait personnel éditorial qui raconte une personnalité, une humeur ou un univers intime, sans réduire chaque image à une photo de profil standard",
    directions: [
      { key: "analog-cafe", brief: "Une adulte est assise seule dans un café parisien calme, tasse en céramique colorée devant elle et regard perdu vers la fenêtre; esthétique argentique avec grain visible, pull orange doux, lumière de pluie et cadrage documentaire au 50 mm.", alt: "Portrait personnel féminin dans un café pluvieux, pull orange et lumière de fenêtre." },
      { key: "greenhouse-shadow", brief: "Un adulte marche dans une serre ancienne en verre, feuilles projetant des ombres sur son visage et chemise blanche légèrement ouverte au col; photographie au 35 mm, verts profonds, contre-jour naturel et expression contemplative.", alt: "Portrait personnel masculin dans une serre ancienne, ombres de feuillage et chemise blanche." },
      { key: "painter-studio", brief: "Une adulte se tient dans un atelier de peinture aux murs couverts de traces de couleurs, pinceau posé dans une main et tablier bleu taché; lumière de fenêtre nord, objectif 50 mm, palette vive mais visage net et attitude directe.", alt: "Portrait personnel féminin dans un atelier de peinture, tablier bleu et murs colorés." },
      { key: "rocky-shore", brief: "Un adulte assis sur des rochers regarde l’horizon d’une côte volcanique, veste jaune moutarde et pantalon noir contrastant avec le ciel gris; cadrage large au 35 mm, embruns fins, posture de profil et atmosphère méditative.", alt: "Portrait personnel masculin sur une côte volcanique, veste moutarde et horizon marin." },
      { key: "tram-window", brief: "Une adulte est assise près de la fenêtre d’un tramway ancien, ville floue en mouvement et main posée sur la vitre; photographie de rue au 50 mm, manteau prune, lumière de fin d’après-midi et sensation de trajet intime.", alt: "Portrait personnel féminin dans un tramway ancien, manteau prune et ville en mouvement." },
      { key: "dance-rehearsal", brief: "Un adulte est capturé au milieu d’une répétition de danse dans un studio en bois, mouvement du bras arrêté à mi-geste et miroir flou sans reflet dupliqué; objectif 35 mm, débardeur gris et pantalon bleu, lumière latérale douce.", alt: "Portrait personnel masculin dans un studio de danse, geste suspendu et lumière latérale." },
      { key: "desert-road", brief: "Une adulte se tient près d’une voiture ancienne sans marque visible sur une route désertique, chapeau tenu à la main et montagnes lointaines; grand angle au 28 mm, combinaison sable, soleil dur et ombres graphiques.", alt: "Portrait personnel féminin sur une route désertique, combinaison sable et montagnes lointaines." },
      { key: "bookshop-ladder", brief: "Un adulte choisit un livre dans une librairie étroite, debout sur une petite échelle en bois avec couvertures volontairement floues et illisibles; cadrage vertical au 50 mm, veste en velours vert, lumière chaude et composition en profondeur.", alt: "Portrait personnel masculin dans une librairie, veste en velours vert et échelle en bois." },
      { key: "lavender-field", brief: "Une adulte marche dans un champ de lavande au crépuscule, robe bleu pâle et chapeau de paille porté contre la poitrine; téléobjectif 85 mm, lignes de fleurs, lumière violette douce et regard tourné vers l’objectif.", alt: "Portrait personnel féminin dans un champ de lavande au crépuscule, robe bleu pâle." },
      { key: "ceramic-bathroom", brief: "Un adulte pose dans une salle de bains moderniste aux carreaux turquoise, assis sur un tabouret et tenant une serviette rayée; flash direct artistique au 35 mm, chemise terracotta, couleurs franches et expression légèrement amusée.", alt: "Portrait personnel masculin dans une salle de bains turquoise, chemise terracotta et flash artistique." },
      { key: "raincoat-crosswalk", brief: "Une adulte traverse un passage piéton après une averse, parapluie fermé à la main et manteau jaune, passants flous sans visages distincts; photographie urbaine au 35 mm, reflets sur l’asphalte et énergie spontanée.", alt: "Portrait personnel féminin après la pluie, manteau jaune et reflets urbains sur l’asphalte." },
      { key: "mountain-cabin", brief: "Un adulte est assis près d’une fenêtre de chalet avec une tasse fumante et une couverture en laine, montagnes floues derrière; objectif 85 mm, pull bleu ardoise, lumière froide du matin et atmosphère silencieuse.", alt: "Portrait personnel masculin dans un chalet, tasse fumante et montagnes derrière la fenêtre." },
      { key: "night-flower-shop", brief: "Une adulte pose devant une boutique de fleurs fermée, rideau métallique coloré et bouquet de feuillage tenu contre elle, aucune enseigne lisible; flash de nuit au 50 mm, veste argentée, ombres franches et attitude indépendante.", alt: "Portrait personnel féminin de nuit devant une boutique fleurie, veste argentée et feuillage." }
    ]
  },
  {
    slug: "black-friday",
    label: "Black Friday",
    anchor: "une image de campagne commerciale Black Friday énergique et premium, reconnaissable par l’univers de shopping et de promotion mais sans texte, logo ou produit de marque",
    directions: [
      { key: "white-studio-bag", brief: "Une adulte en veste rouge vif tient un sac shopping noir mat sans logo dans un studio blanc très lumineux, deux boîtes neutres au sol et regard direct; photographie publicitaire au 50 mm, ombre nette et contraste graphique rouge-noir.", alt: "Campagne Black Friday avec femme en veste rouge, sac noir sans logo et boîtes neutres." },
      { key: "warehouse-pallet", brief: "Un adulte en sweat bleu électrique pousse un petit chariot de cartons bruns vierges dans un entrepôt de préparation de commandes, gestes dynamiques et lumière de néons; grand angle 28 mm, lignes de stockage en profondeur et ambiance de lancement commercial.", alt: "Campagne Black Friday dans un entrepôt, homme en sweat bleu et chariot de cartons vierges." },
      { key: "street-window", brief: "Deux adultes habillés en jaune citron et violet posent devant une vitrine urbaine totalement dépourvue de texte, tenant chacun un objet de consommation non identifiable; photo de rue au 35 mm, lumière de fin de journée et composition en diagonale.", alt: "Campagne Black Friday avec deux adultes devant une vitrine sans texte, tenues jaune et violette." },
      { key: "tech-tabletop", brief: "Vue plongeante d’un bureau sombre où des mains adultes disposent un casque audio noir sans marque, une tablette éteinte et un ruban argenté, avec une silhouette floue hors cadre; éclairage bleu nuit et orange, nature morte commerciale nette.", alt: "Mise en scène Black Friday de produits tech sans marque sur un bureau bleu et orange." },
      { key: "couple-comparison", brief: "Un couple adulte compare deux boîtes cadeaux sans inscription dans un salon contemporain, chacun tenant un modèle différent et souriant vers l’autre; photographie lifestyle au 50 mm, vêtements crème et vert, lumière naturelle vive et scène de décision d’achat.", alt: "Campagne Black Friday montrant un couple comparant deux boîtes cadeaux sans inscription." },
      { key: "night-market", brief: "Une adulte en manteau argenté marche dans un marché nocturne avec sacs unis et guirlandes lumineuses, foule floue autour d’elle; flash de reportage au 35 mm, rouge profond et cyan, mouvement visible et sensation d’offre exceptionnelle.", alt: "Campagne Black Friday de nuit, femme en manteau argenté parmi sacs unis et lumières colorées." },
      { key: "beauty-counter", brief: "Un adulte tient un flacon de soin opaque sans marque devant un comptoir de salle de bains rose poudré, composition centrée et visage souriant; photo publicitaire au 85 mm, lumière diffuse, serviette lilas et rendu propre de lancement produit.", alt: "Campagne Black Friday beauté avec homme tenant un flacon opaque sans marque dans une salle rose." },
      { key: "fashion-rack", brief: "Une adulte choisit une veste orange brûlé sur un portant de vêtements sans étiquette lisible, racks formant des lignes verticales autour d’elle; photographie éditoriale au 35 mm, lumière blanche de showroom, pose active et palette multicolore.", alt: "Campagne Black Friday mode avec femme choisissant une veste orange sur un portant sans étiquette." },
      { key: "home-appliance", brief: "Un adulte prépare une boisson dans une cuisine claire avec un petit appareil électroménager noir sans marque au premier plan, tablier bleu et geste de démonstration; lumière du matin, objectif 50 mm et composition produit-lifestyle réaliste.", alt: "Campagne Black Friday cuisine avec homme démontrant un appareil noir sans marque." },
      { key: "mobile-office", brief: "Une adulte travaille depuis un bureau domestique entouré de colis plats neutres et d’un ordinateur portable fermé sans logo, une main levant une carte vierge; lumière chaude de lampe, cadrage taille au 50 mm et ambiance de préparation promotionnelle.", alt: "Campagne Black Friday dans un bureau à domicile, femme entourée de colis neutres." },
      { key: "outdoor-shopping", brief: "Deux adultes sortent d’un centre commercial moderne avec des sacs en papier unis, l’un porte un manteau vert et l’autre une écharpe corail; lumière froide d’hiver, photographie en mouvement au 35 mm, architecture et ciel visibles.", alt: "Campagne Black Friday avec deux adultes sortant d’un centre commercial, sacs en papier sans logo." },
      { key: "luxury-black-set", brief: "Une adulte en robe bleu royal pose dans un décor noir brillant avec une boîte cadeau dorée sans texte, éclairage de contour sculptural et reflet au sol; portrait publicitaire au 85 mm, posture statique et luxe contemporain.", alt: "Campagne Black Friday premium avec femme en robe bleu royal et boîte dorée sans texte." },
      { key: "delivery-bicycle", brief: "Un adulte à vélo cargo transporte des paquets neutres dans une rue colorée, regard tourné vers l’objectif au moment d’un arrêt; photo documentaire au 28 mm, veste jaune, ciel couvert et énergie logistique de période commerciale.", alt: "Campagne Black Friday avec livreur adulte à vélo cargo et paquets neutres dans une rue colorée." }
    ]
  },
  {
    slug: "only-fans",
    label: "Créations pour fans",
    anchor: "un portrait de créateur adulte destiné à une page d’abonnement ou de communauté, expressif et personnel mais toujours habillé, non explicite et respectueux",
    directions: [
      { key: "home-musician", brief: "Une créatrice adulte chante dans un petit studio musical domestique avec microphone et clavier sans marque, casque posé sur une table; lumière rose et bleue, cadrage mi-corps au 35 mm, veste en jean et expression énergique, aucun texte lisible.", alt: "Portrait de créatrice adulte dans un studio musical, microphone sans marque et lumière rose-bleue." },
      { key: "climbing-gym", brief: "Un créateur adulte pose dans une salle d’escalade avec mur coloré et baudrier correctement porté, mains propres et regard confiant; objectif 50 mm, t-shirt vert olive, lumière naturelle de verrière et arrière-plan sportif sans logo.", alt: "Portrait de créateur adulte dans une salle d’escalade, baudrier et mur coloré." },
      { key: "gaming-room", brief: "Une créatrice adulte est assise dans une pièce de jeu éclairée par des bandes LED cyan, manette tenue à deux mains et écrans floutés sans interface lisible; photographie au 35 mm, hoodie violet et posture concentrée mais accueillante.", alt: "Portrait de créatrice adulte dans une salle de jeu aux lumières LED cyan et violettes." },
      { key: "cooking-stream", brief: "Un créateur adulte prépare une recette simple dans une cuisine jaune et blanche, caméra sur trépied visible mais éteinte et ingrédients colorés sur le plan de travail; cadrage documentaire au 35 mm, tablier rayé et sourire vers l’objectif.", alt: "Portrait de créateur adulte en cuisine, tablier rayé et préparation colorée pour une communauté." },
      { key: "travel-balcony", brief: "Une créatrice adulte se tient sur le balcon d’un hôtel face à une ville côtière, carte pliée sans texte dans une main et lunettes accrochées au col; lumière dorée, chemise en lin turquoise et cadrage au 50 mm.", alt: "Portrait de créatrice adulte sur un balcon côtier, chemise turquoise et lumière dorée." },
      { key: "illustrator-studio", brief: "Un créateur adulte dessine dans un atelier rempli d’affiches abstraites sans mots lisibles, tablette graphique et pinceaux autour de lui; lumière blanche de fenêtre, chemise orange, vue trois-quarts au 50 mm et mains clairement visibles.", alt: "Portrait de créateur adulte dans un atelier d’illustration, tablette graphique et pinceaux." },
      { key: "book-club-nook", brief: "Une créatrice adulte lit un livre fermé sur une banquette d’un coin bibliothèque chaleureux, couvertures floutées et illisibles et lampe champignon à côté; portrait rapproché au 85 mm, pull bleu ciel, lumière ambre et expression complice.", alt: "Portrait de créatrice adulte dans un coin lecture chaleureux, pull bleu ciel et lampe ambre." },
      { key: "dance-rehearsal", brief: "Un créateur adulte répète une chorégraphie dans un studio de danse aux murs lavande, mouvement arrêté au milieu d’un tour et miroir sans reflet dupliqué; grand angle 28 mm, tenue sportive noire et jaune, lumière claire.", alt: "Portrait de créateur adulte en répétition de danse, studio lavande et tenue noire et jaune." },
      { key: "fashion-rack", brief: "Une créatrice adulte choisit entre deux vestes sur un portant de studio, miroir latéral et housses sans marque autour d’elle; photo mode au 50 mm, robe verte sous veste blanche, lumière de showroom et attitude éditoriale.", alt: "Portrait de créatrice adulte dans un studio de mode, vestes sur portant et robe verte." },
      { key: "motorcycle-garage", brief: "Un créateur adulte pose dans un garage propre près d’une moto ancienne sans emblème visible, casque posé sur un établi et mains dans les poches; éclairage directionnel orange et bleu, veste en cuir brun et cadrage en pied.", alt: "Portrait de créateur adulte dans un garage, moto ancienne sans emblème et veste en cuir brun." },
      { key: "urban-gardener", brief: "Une créatrice adulte arrose des plantes sur un toit-jardin urbain, arrosoir métallique et bacs végétaux autour d’elle, skyline en arrière-plan; lumière du matin, salopette beige sur t-shirt rose, photographie au 35 mm.", alt: "Portrait de créatrice adulte dans un jardin urbain, salopette beige et plantes en terrasse." },
      { key: "winter-creator", brief: "Un créateur adulte en bonnet orange et manteau bleu pose devant une fenêtre couverte de buée, appareil photo compact sans marque suspendu au cou; lumière froide extérieure et lampe chaude intérieure, portrait au 85 mm.", alt: "Portrait de créateur adulte en hiver, bonnet orange et appareil photo sans marque." },
      { key: "ring-light-makeup", brief: "Une créatrice adulte prépare un maquillage artistique devant un miroir éclairé par un anneau lumineux, pinceaux posés sur la table et palette sans inscription; cadrage poitrine au 50 mm, chemise lilas, lumière blanche et sourire naturel.", alt: "Portrait de créatrice adulte devant un anneau lumineux, pinceaux et maquillage artistique." }
    ]
  },
  {
    slug: "singles-awareness-day",
    label: "Journée du célibat",
    anchor: "un portrait positif de personne adulte seule, centré sur l’autonomie, le plaisir personnel et la confiance, avec une scène de vie variée plutôt qu’une romance de couple",
    directions: [
      { key: "sunrise-run", brief: "Une adulte termine une course au lever du soleil sur une promenade au bord de l’eau, bouteille réutilisable sans logo à la main et sourire essoufflé; photographie sportive au 35 mm, coupe-vent corail, lumière rose et mouvement naturel.", alt: "Portrait de confiance en soi d’une femme après une course au lever du soleil." },
      { key: "solo-cafe", brief: "Un adulte profite seul d’un café de quartier, casque audio autour du cou et carnet fermé sur la table, regard tourné vers la rue; photographie lifestyle au 50 mm, pull vert sauge, lumière matinale et ambiance sereine.", alt: "Portrait de confiance en soi d’un homme seul dans un café, pull vert sauge et lumière matinale." },
      { key: "museum-afternoon", brief: "Une adulte observe une grande installation abstraite dans un musée, silhouette décentrée et mains derrière le dos; composition architecturale au 28 mm, pantalon rouge brique et chemise blanche, lumière propre et sentiment de curiosité indépendante.", alt: "Portrait de confiance en soi d’une femme seule devant une installation abstraite au musée." },
      { key: "solo-road-trip", brief: "Un adulte ouvre le coffre d’une voiture ancienne garée près d’un belvédère, sac de voyage coloré et carte pliée sans texte visible; grand angle 35 mm, veste denim et pantalon sable, ciel vaste et humeur d’aventure personnelle.", alt: "Portrait de confiance en soi d’un homme en road trip près d’un belvédère." },
      { key: "home-cooking", brief: "Une adulte cuisine un plat de légumes dans une cuisine ensoleillée, écouteurs autour du cou et ustensiles colorés sur le plan de travail; cadrage documentaire au 35 mm, tablier turquoise, geste dynamique et joie quotidienne.", alt: "Portrait de confiance en soi d’une femme cuisinant seule dans une cuisine ensoleillée." },
      { key: "pottery-class", brief: "Un adulte façonne une tasse en argile dans un atelier collectif mais photographié seul, tour de potier et étagères de pièces autour; objectif 50 mm, tablier gris sur t-shirt jaune, lumière latérale et concentration heureuse.", alt: "Portrait de confiance en soi d’un homme modelant une tasse en argile dans un atelier." },
      { key: "rooftop-dance", brief: "Une adulte danse librement sur une terrasse urbaine au crépuscule, veste légère ouverte et skyline floue derrière elle; photographie au 35 mm avec mouvement du tissu, tenue mauve et orange, lumière bleu-rose et énergie libératrice.", alt: "Portrait de confiance en soi d’une femme dansant seule sur une terrasse au crépuscule." },
      { key: "botanical-bench", brief: "Un adulte est assis seul sur un banc dans un jardin botanique, lunettes de soleil posées sur la tête et grande feuille au premier plan; téléobjectif 85 mm, chemise crème, verts profonds et expression apaisée.", alt: "Portrait de confiance en soi d’un homme seul sur un banc dans un jardin botanique." },
      { key: "bookstore-bag", brief: "Une adulte sort d’une librairie avec un sac en papier uni et un roman fermé sans texte lisible, marchant sous une arcade colorée; street photography au 35 mm, manteau bleu cobalt, soleil d’hiver et posture assurée.", alt: "Portrait de confiance en soi d’une femme sortant d’une librairie, manteau bleu cobalt." },
      { key: "beach-kite", brief: "Un adulte court sur une plage venteuse avec un cerf-volant géométrique, pieds dans le sable et visage tourné vers l’objectif; grand angle 28 mm, pull orange et pantalon bleu, ciel clair et plaisir spontané.", alt: "Portrait de confiance en soi d’un homme courant seul sur une plage avec un cerf-volant." },
      { key: "train-window", brief: "Une adulte voyage seule dans un train, assise près d’une grande fenêtre avec une veste posée sur le siège et paysage flou; photographie au 50 mm, pull rose poudré, lumière de fin de journée et regard confiant.", alt: "Portrait de confiance en soi d’une femme seule dans un train, paysage flou derrière la fenêtre." },
      { key: "concert-balcony", brief: "Un adulte profite d’un concert depuis une petite tribune, mains levées et lumières de scène colorées en arrière-plan sans artiste identifiable; photographie au 35 mm, chemise noire et foulard jaune, mouvement et joie collective.", alt: "Portrait de confiance en soi d’un homme profitant seul d’un concert aux lumières colorées." },
      { key: "morning-market", brief: "Une adulte choisit des agrumes sur un marché en plein air, panier en osier et bouquet de feuillage, vendeurs flous derrière elle; objectif 50 mm, trench vert olive, lumière claire et sourire tourné vers la caméra.", alt: "Portrait de confiance en soi d’une femme au marché, panier en osier et trench vert olive." }
    ]
  }
];

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const withoutPrefix = token.slice(2);
    const separator = withoutPrefix.indexOf("=");
    if (separator >= 0) {
      result[withoutPrefix.slice(0, separator)] = withoutPrefix.slice(separator + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[withoutPrefix] = next;
      index += 1;
    } else {
      result[withoutPrefix] = "true";
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
  const coverInstruction =
    index === 0
      ? "Cette image est la couverture : elle doit être la lecture la plus immédiate du thème, avec le sujet et l’environnement entièrement visibles."
      : "Cette image est une pièce autonome de galerie : elle doit avoir une idée visuelle, une distance de caméra et une énergie distinctes de la couverture et des autres images.";
  return [
    "Crée une photographie originale pour une galerie de photos IA privée destinée au storefront français.",
    "Thème et ancre visuelle : " + theme.label + " — " + theme.anchor + ".",
    "Direction créative unique de cette image : " + direction.brief,
    coverInstruction,
    "Le rendu doit être une photographie éditoriale crédible, avec une anatomie naturelle, des mains réalistes, une peau et des matières détaillées, sans rendu plastique.",
    "Utilise uniquement des adultes consentants et des identités fictives. Aucun mineur, aucune nudité explicite, aucune pose sexualisée, aucune violence, aucun gore, aucune célébrité et aucun personnage protégé.",
    "N’ajoute aucun texte lisible, mot, légende, logo, filigrane, interface, marque, emballage identifiable ou enseigne lisible. Ne crée ni collage, ni grille, ni écran partagé, ni visage dupliqué.",
    "Format vertical 2:3, image complète, composition naturelle, sujet et décor lisibles. Ne copie aucune image de référence et ne réutilise pas la recette visuelle d’une autre image."
  ].join("\n");
}

function buildPlan() {
  assert.equal(THEME_PLANS.length, 7, "Expected seven Professional themes.");
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
        outputRelative: path.posix.join(
          "assets/sites/site_aidreamcapes_eu/generated/eu-regenerated",
          batchId,
          filename
        ),
        publicUrl: finalPublicRoot + "/" + filename,
        status: "planned",
        providerRequestId: "",
        error: ""
      });
    });
  }
  assert.equal(tasks.length, 91, "The Professional batch must contain 91 images.");
  assert.equal(new Set(tasks.map((task) => task.prompt)).size, 91, "Prompts must be unique.");
  assert.equal(new Set(tasks.map((task) => task.artDirection)).size, 91, "Art directions must be unique.");
  assert.equal(new Set(tasks.map((task) => task.altText)).size, 91, "Alt text must be unique.");
  assert(
    tasks.every((task) => !/(?:exemple|example|image de couverture|cover image)\s*\d*/i.test(task.altText)),
    "Alt text must not use generic numbered placeholders."
  );
  return {
    schemaVersion: 3,
    kind: "aidreamcapes-eu-professional-diverse-image-regeneration",
    mode: "planned",
    batchId,
    createdAt: new Date().toISOString(),
    targetSite: targetSiteId,
    targetSiteSlug: "aidreamcapes-eu",
    scope: "Professional / Professionnel",
    themes: THEME_PLANS.map((theme) => ({
      slug: theme.slug,
      label: theme.label,
      anchor: theme.anchor,
      assetCount: theme.directions.length
    })),
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
      paidCreateAttemptsAuthorizedByBatchScope: tasks.length,
      noAutomaticRetry: true,
      noProviderFallback: true,
      ambiguousCreateStateStopsRun: true,
      providerResultRecoveredBeforeAnyRegeneration: true
    },
    counts: {
      professionalThemes: THEME_PLANS.length,
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

async function imageHash(filePath) {
  const result = await sharp(filePath)
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let total = 0;
  for (const value of result.data) total += value;
  const average = total / result.data.length;
  let hash = 0n;
  result.data.forEach((value, index) => {
    if (value >= average) hash |= 1n << BigInt(index);
  });
  return hash;
}

async function imageFingerprints(filePath) {
  const luminance = await sharp(filePath)
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let total = 0;
  for (const value of luminance.data) total += value;
  const average = total / luminance.data.length;
  let averageHash = 0n;
  luminance.data.forEach((value, index) => {
    if (value >= average) averageHash |= 1n << BigInt(index);
  });

  const gradient = await sharp(filePath)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let differenceHash = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const index = row * 9 + column;
      if (gradient.data[index] >= gradient.data[index + 1]) {
        differenceHash |= 1n << BigInt(row * 8 + column);
      }
    }
  }

  const color = await sharp(filePath)
    .resize(8, 8, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channelAverages = [0, 0, 0];
  for (let index = 0; index < color.data.length; index += 3) {
    for (let channel = 0; channel < 3; channel += 1) channelAverages[channel] += color.data[index + channel];
  }
  for (let channel = 0; channel < 3; channel += 1) channelAverages[channel] /= 64;
  let colorHash = 0n;
  for (let pixel = 0; pixel < 64; pixel += 1) {
    const index = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      if (color.data[index + channel] >= channelAverages[channel]) {
        colorHash |= 1n << BigInt(pixel * 3 + channel);
      }
    }
  }
  return { averageHash, differenceHash, colorHash };
}

function imagePayload(body) {
  return (
    body?.data?.[0]?.b64_json ||
    body?.data?.[0]?.image_base64 ||
    body?.output?.[0]?.b64_json ||
    body?.output?.[0]?.image_base64 ||
    body?.image_base64 ||
    ""
  );
}

function imageUrlPayload(body) {
  return body?.data?.[0]?.url || body?.output?.[0]?.url || body?.url || "";
}

function redactedBody(body) {
  return JSON.parse(
    JSON.stringify(body, (key, value) => {
      if (/(?:b64|base64)/i.test(key) && typeof value === "string") {
        return "[omitted:" + value.length + "]";
      }
      return value;
    })
  );
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        label: true,
        aiUrl: true,
        apiKey: true,
        modelType: true,
        providerType: true,
        enabled: true,
        preferred: true,
        supportsGenerationN: true,
        maxImagesPerRequest: true
      }
    });
    assert(provider, "image4 provider was not found.");
    assert.equal(provider.providerType, "image", "image4 must be an image provider.");
    assert(provider.enabled, "image4 must be enabled.");
    assert(provider.apiKey && provider.aiUrl, "image4 must have a configured URL and key.");
    assert.equal(provider.modelType, imageModel, "image4 model must be gpt-image-2.");
    return {
      id: provider.id,
      label: provider.label,
      baseUrl: normalizeBaseUrl(provider.aiUrl),
      apiKey: provider.apiKey,
      model: provider.modelType,
      maxImagesPerRequest: provider.maxImagesPerRequest
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function checkProviderReadOnly(provider) {
  const response = await fetch(provider.baseUrl + "/v1/models", {
    headers: { Authorization: "Bearer " + provider.apiKey },
    signal: AbortSignal.timeout(30_000)
  });
  const body = await response.json().catch(() => ({}));
  const ids = Array.isArray(body?.data)
    ? body.data.map((item) => item?.id).filter(Boolean)
    : [];
  assert(response.ok, "Provider read-only model check failed with " + response.status + ".");
  return {
    status: response.status,
    modelCount: ids.length,
    modelMatch: ids.length === 0 ? "provider did not expose model list" : ids.includes(provider.model)
  };
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
  await sharp(inputBuffer)
    .rotate()
    .resize(1024, 1536, { fit: "cover", position: "attention" })
    .webp({ quality: 92, smartSubsample: true })
    .toFile(task.stageFile);
}

async function generate(manifest) {
  assert.equal(
    String(args.confirm || ""),
    expectedConfirmation,
    "Generation requires --confirm=" + expectedConfirmation
  );
  const maxPaidAttempts = Number(args["max-paid-attempts"] || 0);
  assert(Number.isInteger(maxPaidAttempts) && maxPaidAttempts >= manifest.tasks.length, "Generation requires --max-paid-attempts>=" + manifest.tasks.length);
  const provider = await loadProvider();
  const modelCheck = await checkProviderReadOnly(provider);
  const resumeAfterProtocolFix = String(args["resume-after-protocol-fix"] || "") === "true";
  const previousRuntime = manifest.runtime || {};
  const previousAttempts = Number(previousRuntime.paidCreateAttempts || 0);
  const previousNonSucceeded = manifest.tasks.filter((task) => task.status !== "succeeded");
  if (previousAttempts > 0 || previousNonSucceeded.some((task) => task.status === "failed" || task.status === "unknown_provider_state")) {
    assert(resumeAfterProtocolFix, "Existing provider attempts require --resume-after-protocol-fix=true.");
    assert.equal(Number(previousRuntime.ambiguous || 0), 0, "Ambiguous provider state cannot be resumed automatically.");
    for (const task of manifest.tasks) {
      if (task.status === "failed") {
        task.status = "planned";
        task.error = "";
      }
    }
  }
  manifest.provider = {
    ...manifest.provider,
    endpoint: provider.baseUrl + providerImageGenerationsPath,
    maxImagesPerRequest: provider.maxImagesPerRequest,
    maxPaidCreateAttempts: maxPaidAttempts,
    readOnlyModelCheck: modelCheck
  };
  manifest.diversity = {
    ...manifest.diversity,
    strategy: "theme-anchor-plus-independent-art-direction-plus-multi-fingerprint-cross-image-gate",
    minimumCrossAHashDistance,
    minimumCrossDHashDistance,
    minimumCrossColorHashDistance
  };
  manifest.runtime = {
    paidCreateAttempts: previousAttempts,
    succeeded: manifest.tasks.filter((task) => task.status === "succeeded").length,
    failed: manifest.tasks.filter((task) => task.status === "failed").length,
    ambiguous: Number(previousRuntime.ambiguous || 0),
    startedAt: previousRuntime.startedAt || new Date().toISOString(),
    resumedAt: resumeAfterProtocolFix ? new Date().toISOString() : previousRuntime.resumedAt,
    providerRequestIds: Array.isArray(previousRuntime.providerRequestIds) ? previousRuntime.providerRequestIds : []
  };
  writeJson(manifestPath, manifest);
  fs.mkdirSync(outputRoot, { recursive: true });
  console.log(
    JSON.stringify(
      {
        operation: "paid-create",
        endpoint: provider.baseUrl + providerImageGenerationsPath,
        method: "POST",
        provider: provider.label,
        model: provider.model,
        size: imageSize,
        quality: imageQuality,
        maxPaidCreateAttempts: maxPaidAttempts,
        attemptsPerCreate: 1,
        retry: false,
        fallback: false,
        stopCondition: "stop on first failed or ambiguous create; evaluate diversity before apply"
      },
      null,
      2
    )
  );

  for (const task of manifest.tasks) {
    if (task.status === "succeeded") continue;
    assert(manifest.runtime.paidCreateAttempts < maxPaidAttempts, "paid_create_cap_exceeded");
    const idempotencyKey = expectedConfirmation + ":" + manifest.batchId + ":" + task.id;
    const startedAt = Date.now();
    let response;
    let body = {};
    try {
      response = await fetch(provider.baseUrl + providerImageGenerationsPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + provider.apiKey,
          "Idempotency-Key": idempotencyKey,
          "X-Client-Request-Id": task.id
        },
        body: JSON.stringify({
          model: provider.model,
          prompt: task.prompt,
          size: imageSize,
          quality: imageQuality,
          response_format: "b64_json"
        }),
        signal: AbortSignal.timeout(maxCreateTimeoutMs)
      });
      body = await response.json().catch(() => ({}));
    } catch (error) {
      task.status = "unknown_provider_state";
      task.error = error instanceof Error ? error.message : String(error);
      manifest.runtime.ambiguous += 1;
      manifest.runtime.failed += 1;
      writeJson(
        path.join(path.dirname(manifestPath), manifest.batchId + "-provider-audit.json"),
        manifest.runtime
      );
      writeJson(manifestPath, manifest);
      throw new Error(task.id + ": ambiguous provider create state; stopped without retry.");
    }
    const requestId =
      response.headers.get("x-request-id") ||
      response.headers.get("request-id") ||
      "";
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
        requestId,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
        response: redactedBody(body),
        retryPolicy: "no-retry"
      }
    );
    manifest.runtime.paidCreateAttempts += 1;
    if (!response.ok) {
      task.status = "failed";
      task.error = "provider_status_" + response.status;
      manifest.runtime.failed += 1;
      writeJson(manifestPath, manifest);
      throw new Error(task.id + ": provider create failed; stopped without retry.");
    }
    await convertProviderOutput(body, task);
    task.outputHash = sha256(fs.readFileSync(task.stageFile));
    task.outputAHash = (await imageHash(task.stageFile)).toString(16).padStart(16, "0");
    task.providerRequestId = requestId;
    task.status = "succeeded";
    task.error = "";
    manifest.runtime.succeeded += 1;
    manifest.runtime.providerRequestIds.push({ taskId: task.id, requestId });
    writeJson(manifestPath, manifest);
    console.log("succeeded " + task.id + " (" + manifest.runtime.succeeded + "/" + manifest.tasks.length + ")");
  }

  const diversityResult = await evaluateDiversity(manifest);
  manifest.diversityResult = diversityResult;
  manifest.runtime.completedAt = new Date().toISOString();
  manifest.runtime.qualityFailed = diversityResult.pass ? 0 : diversityResult.failures.length;
  writeJson(manifestPath, manifest);
  assert(diversityResult.pass, "Diversity gate failed; no assets were applied.");
  console.log(
    JSON.stringify(
      {
        ok: true,
        paidCreateAttempts: manifest.runtime.paidCreateAttempts,
        diversity: diversityResult
      },
      null,
      2
    )
  );
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
    const outputHash = sha256(fs.readFileSync(task.stageFile));
    outputHashes.add(outputHash);
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
      if (averageDistance < minAverageDistance) {
        minAverageDistance = averageDistance;
        closestAveragePair = [hashes[left].id, hashes[right].id];
      }
      if (differenceDistance < minDifferenceDistance) {
        minDifferenceDistance = differenceDistance;
        closestDifferencePair = [hashes[left].id, hashes[right].id];
      }
      if (colorDistance < minColorDistance) {
        minColorDistance = colorDistance;
        closestColorPair = [hashes[left].id, hashes[right].id];
      }
      if (
        averageDistance < minimumCrossAHashDistance &&
        differenceDistance < minimumCrossDHashDistance &&
        colorDistance < minimumCrossColorHashDistance
      ) {
        visuallyClosePairs.push({
          pair: [hashes[left].id, hashes[right].id],
          averageDistance,
          differenceDistance,
          colorDistance
        });
      }
    }
  }
  if (visuallyClosePairs.length) failures.push("cross_image_visual_similarity_pairs=" + visuallyClosePairs.length);
  return {
    pass: failures.length === 0,
    minimumCrossAHashDistance,
    minimumCrossDHashDistance,
    minimumCrossColorHashDistance,
    actualMinimumCrossAHashDistance: minAverageDistance,
    actualMinimumCrossDHashDistance: minDifferenceDistance,
    actualMinimumCrossColorHashDistance: minColorDistance,
    closestAveragePair,
    closestDifferencePair,
    closestColorPair,
    visuallyClosePairs,
    uniqueOutputHashes: outputHashes.size,
    failures
  };
}

async function apply(manifest) {
  assert.equal(String(args.confirm || ""), expectedConfirmation, "Apply requires --confirm=" + expectedConfirmation);
  assert.equal(
    manifest.runtime?.succeeded,
    manifest.tasks.length,
    "All provider tasks must succeed before apply."
  );
  assert.equal(manifest.runtime?.failed, 0, "Failed provider tasks block apply.");
  assert.equal(manifest.diversityResult?.pass, true, "Diversity gate must pass before apply.");
  assertDatabaseTarget({ expectedTarget: "local" });
  assertNonProductionWriteTarget();
  assert(!fs.existsSync(finalRoot), "Final output directory already exists: " + finalRoot);

  const prisma = new PrismaClient();
  try {
    const slugs = manifest.themes.map((theme) => theme.slug);
    const packs = await prisma.creativePack.findMany({
      where: {
        siteId: targetSiteId,
        status: "active",
        categoryRecord: { slug: { in: slugs } }
      },
      include: { categoryRecord: true }
    });
    assert.equal(packs.length, slugs.length, "Expected all seven active Professional packs.");
    const bySlug = new Map(packs.map((pack) => [pack.categoryRecord?.slug, pack]));
    for (const slug of slugs) assert(bySlug.has(slug), "Missing active pack: " + slug);

    const backupPath = path.join(path.dirname(manifestPath), manifest.batchId + "-apply-backup.json");
    writeJson(backupPath, {
      createdAt: new Date().toISOString(),
      target: "local",
      siteId: targetSiteId,
      packs: packs.map((pack) => ({
        id: pack.id,
        categoryId: pack.categoryId,
        imageUrl: pack.imageUrl,
        galleryImages: pack.galleryImages,
        galleryImageAlts: pack.galleryImageAlts,
        categoryRecord: pack.categoryRecord
      }))
    });

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

    const updated = await prisma.$transaction(
      async (tx) => {
        for (const theme of manifest.themes) {
          const pack = bySlug.get(theme.slug);
          const group = grouped.get(theme.slug);
          assert(group?.cover && group.gallery.length === 12, "Incomplete theme: " + theme.slug);
          group.gallery.sort((left, right) => left.slot.localeCompare(right.slot, undefined, { numeric: true }));
          const ordered = [group.cover, ...group.gallery];
          const nextPack = {
            imageUrl: group.cover.publicUrl,
            galleryImages: group.gallery.map((task) => task.publicUrl),
            galleryImageAlts: ordered.map((task) => task.altText)
          };
          await tx.creativePackCategory.update({
            where: { id: pack.categoryRecord.id },
            data: { imageUrl: group.cover.publicUrl }
          });
          await tx.creativePack.update({ where: { id: pack.id }, data: nextPack });
          for (const task of ordered) {
            const storageKey = task.outputRelative;
            const mediaId =
              "media_site_aidreamcapes_xby_" + sha256(storageKey).slice(0, 16);
            await tx.mediaAsset.upsert({
              where: { siteId_storageKey: { siteId: targetSiteId, storageKey } },
              create: {
                id: mediaId,
                siteId: targetSiteId,
                label: task.altText,
                storageKey,
                mimeType: "image/webp",
                usageType: "package",
                sourceType: "ai-diverse-regeneration",
                previewUrl: task.publicUrl,
                originUrl: task.publicUrl,
                altText: task.altText
              },
              update: {
                label: task.altText,
                mimeType: "image/webp",
                usageType: "package",
                sourceType: "ai-diverse-regeneration",
                previewUrl: task.publicUrl,
                originUrl: task.publicUrl,
                altText: task.altText
              }
            });
          }
        }
        return { updatedPacks: slugs.length, updatedCategories: slugs.length, mediaAssets: manifest.tasks.length };
      },
      { timeout: 120_000 }
    );

    for (const theme of manifest.themes) {
      const pack = bySlug.get(theme.slug);
      const group = grouped.get(theme.slug);
      group.gallery.sort((left, right) => left.slot.localeCompare(right.slot, undefined, { numeric: true }));
      const expected = {
        imageUrl: group.cover.publicUrl,
        galleryImages: group.gallery.map((task) => task.publicUrl),
        galleryImageAlts: [group.cover, ...group.gallery].map((task) => task.altText)
      };
      const readback = await prisma.creativePack.findUnique({
        where: { id: pack.id },
        select: { imageUrl: true, galleryImages: true, galleryImageAlts: true }
      });
      assert.equal(readback?.imageUrl, expected.imageUrl, "Cover readback failed: " + theme.slug);
      assert.deepEqual(readback?.galleryImages, expected.galleryImages, "Gallery readback failed: " + theme.slug);
      assert.deepEqual(readback?.galleryImageAlts, expected.galleryImageAlts, "Alt readback failed: " + theme.slug);
    }
    manifest.apply = {
      target: "local",
      appliedAt: new Date().toISOString(),
      generated: manifest.tasks.length,
      backupPath,
      finalRoot,
      protectedChanged: false,
      unrelatedChanged: false,
      updated
    };
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
    const manifest = buildPlan();
    writeJson(manifestPath, manifest);
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode,
          manifestPath,
          batchId,
          generationTasks: manifest.tasks.length,
          uniquePrompts: manifest.diversity.uniquePrompts,
          uniqueArtDirections: manifest.diversity.independentArtDirections,
          uniqueAltTexts: manifest.diversity.uniqueAltTexts,
          provider: manifest.provider
        },
        null,
        2
      )
    );
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
