#!/usr/bin/env node

// Local-only copy repair for the EU storefront's shared public pages.
// No provider calls, asset deletion, route changes, or writes outside
// site_aidreamcapes_xby are allowed here.
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const DOMAIN = "https://aidreamcapes.eu";
const apply = process.argv.includes("--apply") || process.argv.includes("--apply-local");
const BACKUP_ROOT = path.resolve(".tmp", "aidreamcapes-eu-core-pages-copy");

assertDatabaseTarget({ expectedTarget: "local" });
if (apply) assertNonProductionWriteTarget();

const COMMON = {
  faqSettings: {
    anchor: "FAQ",
    layout: "visual_faq",
    journeyTitles: "Choisir|Importer|Vérifier|Télécharger",
    journeyDescriptions: "Choisissez une direction.|Ajoutez vos sources autorisées.|Relisez le résultat.|Téléchargez depuis la galerie privée."
  },
  trust: {
    title: "Des créations encadrées et faciles à vérifier",
    blocks: {
      trust_no_training: { label: "Confidentialité", value: "Vos sources restent dans le cadre publié" },
      trust_auto_delete: { label: "Conservation", value: "Durée de conservation clairement indiquée" },
      trust_refund: { label: "Remboursement", value: "Demande examinée selon la politique publiée", linkLabel: "Lire la politique de remboursement" },
      trust_encryption: { label: "Sécurité", value: "Chiffrement en transit et au repos" }
    }
  },
  conversion: {
    title: "Prêt à créer avec Aidreamcapes ?",
    eyebrow: "PHOTO ET VIDÉO AVEC L’IA",
    subtitle: "Choisissez un parcours, vérifiez le coût en crédits et retrouvez vos résultats dans votre galerie privée.",
    primaryCta: "Commencer à créer",
    secondaryCta: "Voir les tarifs",
    blocks: {
      cta_metric_credits: { label: "Crédits de départ", value: "200" },
      cta_metric_styles: { label: "Directions créatives", value: "15+" },
      cta_metric_private: { label: "Galerie privée", value: "Oui" }
    }
  }
};

const FAQ = {
  packages: [
    ["Quels packs photo IA puis-je découvrir ?", "Parcourez des packs de portraits, de styles, de scènes saisonnières et de contenus créatifs. Chaque fiche présente sa direction visuelle avant l’importation des sources."],
    ["Comment choisir un pack photo IA ?", "Choisissez d’abord l’occasion, le sujet et le cadrage recherchés. Comparez ensuite les exemples et le nombre d’images avant de réserver vos crédits."],
    ["Puis-je voir les exemples avant de créer ?", "Oui. Les exemples servent à comprendre la lumière, la composition et l’ambiance du pack. Vérifiez toujours que la direction correspond aux photos que vous pouvez utiliser."],
    ["Comment fonctionnent les crédits ?", "Le coût en crédits est affiché avant la demande. Les crédits sont réservés au lancement du parcours selon la configuration du pack et du compte."],
    ["Où retrouver les créations terminées ?", "Les résultats sont regroupés dans votre espace connecté et votre galerie privée. Vous pouvez les relire, puis télécharger ceux qui correspondent à votre projet."],
    ["Quelles photos puis-je importer ?", "Utilisez des photos nettes dont vous détenez les droits ou l’autorisation nécessaire. Évitez les captures d’écran, les visages masqués et les contenus protégés sans permission."]
  ],
  video: [
    ["Quels types de vidéos IA puis-je créer ?", "Comparez des vidéos narratives, cinématographiques, musicales, commerciales, sociales et des animations à partir d’une image ou d’une consigne."],
    ["Comment choisir un thème vidéo ?", "Commencez par le message et le canal de diffusion, puis choisissez le thème dont le rythme, le cadrage et la structure correspondent à votre objectif."],
    ["Puis-je partir d’une image ?", "Oui, lorsqu’un parcours l’autorise. Utilisez une image dont vous contrôlez les droits, décrivez le mouvement attendu et vérifiez le visage, les mains et le décor."],
    ["Comment sont utilisés les crédits ?", "Le coût prévu est présenté avant la génération. Consultez les détails du thème et de la durée avant de confirmer la demande."],
    ["Où retrouver les vidéos terminées ?", "Les vidéos disponibles sont conservées dans votre espace connecté. Relisez-les avant de les télécharger ou de les publier sur le canal choisi."],
    ["Que vérifier avant de partager une vidéo ?", "Vérifiez les personnes, la voix, le texte, les marques, la musique, les droits et le format d’affichage afin que le contenu soit clair et conforme."]
  ],
  pricing: [
    ["Que comprennent les formules Aidreamcapes ?", "Les formules donnent accès à un nombre de crédits défini et aux parcours compatibles avec votre compte. Consultez la fiche tarifaire actuelle avant de choisir."],
    ["Quand les crédits sont-ils utilisés ?", "Les crédits sont utilisés lorsque vous confirmez une demande de génération. Le coût et les paramètres du parcours sont affichés avant cette confirmation."],
    ["Le coût est-il affiché avant la création ?", "Oui. Vérifiez le nombre d’images ou la durée, les sources sélectionnées et le coût indiqué avant de lancer la génération."],
    ["Puis-je utiliser mes créations pour mon activité ?", "Vous pouvez utiliser un résultat lorsque vous contrôlez les sources, les droits des personnes et les éléments intégrés, tout en respectant les règles du canal de diffusion."],
    ["Où retrouver mes résultats ?", "Les créations terminées restent dans votre galerie privée liée au compte. Vous pouvez les contrôler avant de les télécharger."],
    ["Que se passe-t-il si une génération échoue ?", "Conservez la référence de la demande et contactez l’assistance si le statut ou les crédits ne sont pas rétablis selon la politique applicable."]
  ],
  collections: [
    ["Que puis-je créer avec les thèmes photo IA ?", "Explorez des portraits professionnels, des styles créatifs, des scènes de couple, des univers saisonniers et des images adaptées aux profils ou aux réseaux sociaux."],
    ["Comment comparer les collections photo ?", "Comparez le sujet, la composition, le format et la galerie d’exemples. Choisissez une collection cohérente avec vos sources et votre intention."],
    ["Quelles sources sont acceptées ?", "Importez uniquement des images nettes que vous avez le droit d’utiliser. Les photos doivent présenter clairement les sujets nécessaires au résultat."],
    ["Les résultats sont-ils conservés dans un espace privé ?", "Oui. Les demandes et créations sont associées à votre compte afin que vous puissiez les vérifier dans votre galerie privée."],
    ["Combien coûte un pack photo ?", "Le coût en crédits dépend du pack et de sa configuration. Il est affiché avant la confirmation de la demande."],
    ["Puis-je télécharger les résultats ?", "Oui, après vérification du résultat. Téléchargez les fichiers qui conviennent à votre usage et respectez les droits liés aux sources et aux personnes représentées."]
  ]
};

const SPECS = {
  "/ai-image-generation": {
    seo: ["Thèmes photo IA | Aidreamcapes", "Explorez les thèmes photo IA Aidreamcapes pour créer des portraits, des styles et des scènes cohérentes à partir de photos autorisées.", "thèmes photo IA, portraits IA, styles photo, collections créatives"],
    ogImageAlt: "Mosaïque de portraits et de styles photo proposés par Aidreamcapes.",
    sections: {
      faq_1: { settings: { title: "Questions fréquentes sur les thèmes photo IA", eyebrow: "AVANT DE CHOISIR UN PACK", subtitle: "Comparez les thèmes, les sources, les crédits et la galerie privée avant de commencer." }, faq: FAQ.collections },
      trust_1: COMMON.trust,
      packages_1: { settings: { title: "Collections de thèmes photo IA", eyebrow: "CHOISIR UNE DIRECTION", subtitle: "Parcourez les packs photo IA par sujet, style et usage." } },
      taxonomy_1: { settings: { title: "Trouvez un thème adapté à votre projet", eyebrow: "CATÉGORIES PHOTO IA", subtitle: "Comparez les portraits, les styles, les univers créatifs et les outils disponibles." }, blocks: {
        taxonomy_headshot: { meta: "Portrait professionnel", title: "Portraits professionnels", description: "Des portraits nets pour vos profils, présentations et pages d’équipe." },
        taxonomy_style: { meta: "Style et beauté", title: "Styles et coiffures", description: "Testez une direction de coiffure, de tenue ou de beauté à partir de sources autorisées." },
        taxonomy_worlds: { meta: "Univers créatifs", title: "Univers cinématographiques", description: "Explorez des décors imaginaires, urbains ou éditoriaux avec un cadrage lisible." },
        taxonomy_sports: { meta: "Sports et supporters", title: "Portraits de supporters", description: "Créez des scènes de supporters sans logos officiels ni ressemblance non autorisée." },
        taxonomy_video: { meta: "Animation photo", title: "Animation de photos", description: "Animez une image autorisée avec un mouvement contrôlé et vérifiable." },
        taxonomy_creator: { meta: "Créateur", title: "Portraits pour créateurs", description: "Préparez des images cohérentes pour vos profils et vos contenus créatifs." }
      } },
      conversion_1: COMMON.conversion,
      proof_pairs_1: { settings: { title: "Comparer des directions visuelles", subtitle: "Observez le cadrage, la lumière et l’ambiance avant de choisir un thème." }, blocks: {
        proof_pair_headshot: { afterLabel: "Portrait professionnel", beforeLabel: "Photo source autorisée", description: "Une comparaison claire entre la source et une direction de portrait." },
        proof_pair_gala: { afterLabel: "Portrait de soirée", beforeLabel: "Photo source autorisée" },
        proof_pair_style: { afterLabel: "Style créatif", beforeLabel: "Photo source autorisée" }
      } },
      feature_tabs_1: { settings: { title: "Choisissez votre parcours de création", eyebrow: "PHOTO, VIDÉO ET STYLE", subtitle: "Passez d’un pack photo à un outil vidéo ou à une direction de style selon votre objectif." }, blocks: {
        tab_packages: { label: "Packs photo", title: "Choisir un résultat photo", description: "Parcourez les thèmes et sélectionnez une direction avant l’importation." },
        tab_video: { label: "Vidéo IA", title: "Animer une image", description: "Transformez une image autorisée en courte séquence lorsque le parcours le permet." },
        tab_tryon: { label: "Style créatif", title: "Explorer une nouvelle direction", description: "Testez une ambiance, une tenue ou un univers cohérent avec votre projet." }
      } },
      sample_strip_1: { settings: { title: "Exemples de styles photo IA", eyebrow: "INSPIRATION", subtitle: "Comparez les styles disponibles avant de préparer votre propre série." }, blocks: {
        sample_headshot: { meta: "Portrait professionnel", label: "Portrait studio" }, sample_hairstyle: { meta: "Style beauté", label: "Coiffure" }, sample_cyberpunk: { meta: "Univers futuriste", label: "Cyberpunk" }, sample_nature: { meta: "Voyage", label: "Décor extérieur" }, sample_mafia: { meta: "Éditorial", label: "Portrait rétro" }, sample_worldcup: { meta: "Sports", label: "Supporters" }
      } },
      packages_strip_1: { settings: { title: "De l’importation à la galerie privée", eyebrow: "UN PARCOURS SIMPLE", subtitle: "Suivez des étapes visibles pour préparer, vérifier et télécharger vos créations." }, blocks: {
        pkg_path_upload: { meta: "Étape 01", title: "Importer vos sources", text: "Ajoutez des photos nettes que vous avez le droit d’utiliser." },
        pkg_path_preview: { meta: "Étape 02", title: "Choisir un pack", text: "Comparez la direction, les exemples et le coût en crédits." },
        pkg_path_generate: { meta: "Étape 03", title: "Confirmer la création", text: "Vérifiez les paramètres avant de lancer la demande privée." },
        pkg_path_deliver: { meta: "Étape 04", title: "Relire et télécharger", text: "Contrôlez le résultat dans votre galerie privée avant le partage." }
      } }
    }
  },
  "/best-packages": {
    seo: ["Meilleurs packs photo IA | Aidreamcapes", "Trouvez un pack photo IA adapté à votre portrait, votre style ou votre occasion, puis vérifiez les crédits et les résultats dans votre galerie privée.", "meilleurs packs photo IA, packs portraits IA, galerie privée"],
    ogImageAlt: "Portrait de supporter dans un stade éclairé pour présenter les packs photo IA.",
    sections: {
      faq_1: { settings: { title: "Questions fréquentes sur les packs photo IA", eyebrow: "AVANT DE CHOISIR UN PACK", subtitle: "Comparez les directions, les sources et les crédits avant de commencer." }, faq: FAQ.packages },
      intro_1: { settings: { title: "Meilleurs packs photo IA", eyebrow: "CHOISIR UNE DIRECTION PHOTO", body: "Comparez des packs de portraits, de styles et de scènes saisonnières à partir de photos autorisées. Vérifiez les exemples et le coût en crédits avant de commencer.", headingLevel: "h1" } },
      featured_pack_1: { settings: { badge: "Pack supporters", label: "Une direction sportive à personnaliser", title: "Portraits de supporters de football", photos: "Scènes de stade et portraits", privacy: "Galerie privée", subtitle: "Créez des scènes de supporters à partir de vos propres photos, sans logos officiels ni ressemblance non autorisée.", bottomNote: "Vérifiez les droits des personnes et des éléments visibles avant le partage.", primaryCta: "Créer ce pack", safetyCopy: "Utilisez des photos autorisées et évitez les logos officiels, les marques protégées et les ressemblances de personnalités sans permission.", overlayChips: "portrait de supporter|scène de stade|photo de groupe|format social", overlayTitle: "Des portraits de supporters avec une direction claire", secondaryCta: "Voir les packs sports", campaignLabel: "Pack photo IA pour supporters", includedTitle: "Exemples de rendus", includedOutputs: "Portraits de supporters|Scènes de groupe|Ambiance de stade|Portraits au coucher du soleil|Cadrages pour profil|Images de couverture", overlaySubtitle: "Choisissez une scène, vérifiez les crédits et relisez chaque résultat.", nextCampaignLabel: "Comparer une autre direction" }, blocks: {
        seasonal_worldcup_1: { meta: "Stade", label: "Portrait de supporter" }, seasonal_worldcup_2: { meta: "Groupe", label: "Scène de match" }, seasonal_worldcup_3: { meta: "Profil", label: "Portrait cadré" }, seasonal_worldcup_4: { meta: "Récit", label: "Moment entre supporters" }, seasonal_worldcup_5: { meta: "Téléphone", label: "Cadrage vertical" }, seasonal_worldcup_6: { meta: "Couverture", label: "Ambiance de stade" }
      } },
      featured_christmas_1: { settings: { badge: "Pack de Noël", label: "Une direction chaleureuse pour les fêtes", title: "Photos de Noël", photos: "Portraits et cartes de fête", subtitle: "Créez des portraits de groupe et des scènes de Noël à partir de photos autorisées.", bottomNote: "Relisez les visages, les décorations et le texte avant de partager une carte.", safetyCopy: "Utilisez des photos autorisées et vérifiez les personnes, les décorations et les marques visibles avant le partage." }, blocks: {
        seasonal_christmas_1: { meta: "Carte de fête", label: "Portrait de Noël" }, seasonal_christmas_2: { meta: "Groupe", label: "Moment en famille" }, seasonal_christmas_3: { meta: "Souvenir", label: "Lumières de Noël" }, seasonal_christmas_4: { meta: "Album privé", label: "Scène chaleureuse" }, seasonal_christmas_5: { meta: "Portrait", label: "Ambiance festive" }, seasonal_christmas_6: { meta: "Réseaux sociaux", label: "Image de carte" }
      } },
      featured_thanksgiving_1: { settings: { badge: "Pack Action de grâce", label: "Une direction chaleureuse pour les retrouvailles", title: "Photos de Thanksgiving", photos: "Repas et portraits de groupe", subtitle: "Créez des souvenirs de table, de gratitude et de retrouvailles avec des photos autorisées.", bottomNote: "Vérifiez les personnes représentées et les informations avant le partage.", safetyCopy: "Utilisez des photos autorisées et vérifiez les personnes, les décorations et les marques visibles avant le partage." }, blocks: {
        seasonal_thanksgiving_1: { meta: "Table", label: "Repas de fête" }, seasonal_thanksgiving_2: { meta: "Groupe", label: "Retrouvailles" }, seasonal_thanksgiving_3: { meta: "Carte", label: "Message de gratitude" }, seasonal_thanksgiving_4: { meta: "Album privé", label: "Souvenir familial" }, seasonal_thanksgiving_5: { meta: "Saison", label: "Lumière automnale" }, seasonal_thanksgiving_6: { meta: "Téléchargement", label: "Portrait de groupe" }
      } }
    }
  },
  "/best-ai-video": {
    seo: ["Meilleurs thèmes vidéo IA | Aidreamcapes", "Comparez les thèmes vidéo IA Aidreamcapes pour produits, créateurs, récits, réseaux sociaux et annonces avant de choisir votre direction.", "meilleurs thèmes vidéo IA, vidéo produit, vidéo créateur, vidéo sociale"],
    ogImageAlt: "Scène visuelle destinée à illustrer les thèmes vidéo créés avec l’IA.",
    sections: {
      faq_1: { settings: { title: "Questions fréquentes sur les thèmes vidéo IA", eyebrow: "AVANT DE CHOISIR UN THÈME", subtitle: "Comparez les formats, les sources, les crédits et les contrôles avant la génération." }, faq: FAQ.video },
      best_ai_video_1: { settings: { title: "Meilleurs thèmes vidéo IA", eyebrow: "CHOISIR UN FORMAT VIDÉO", subtitle: "Comparez des directions narratives, commerciales, musicales et sociales avant de créer." } }
    }
  },
  "/pricing": {
    seo: ["Tarifs et crédits photo vidéo IA | Aidreamcapes", "Consultez les tarifs et les crédits Aidreamcapes, puis choisissez une formule adaptée à vos créations photo et vidéo dans une galerie privée.", "tarifs photo vidéo IA, crédits Aidreamcapes, formules IA"],
    ogImageAlt: "Aperçu visuel d’un espace de création photo et vidéo IA avec crédits.",
    sections: {
      faq_1: { settings: { title: "Questions fréquentes sur les tarifs et les crédits", eyebrow: "AVANT DE CHOISIR UNE FORMULE", subtitle: "Comprenez les crédits, la génération, la galerie privée et les règles de partage." }, faq: FAQ.pricing },
      trust_1: COMMON.trust,
      pricing_1: { settings: { title: "Formules et crédits", subtitle: "Choisissez la formule adaptée à votre rythme de création photo et vidéo IA.", description: "Le coût en crédits est affiché avant chaque demande. Comparez les formules et les parcours disponibles pour votre compte.", marketComparison: "Comparez le prix actuel, le nombre de crédits et la fréquence de renouvellement avant de choisir une formule.", featuredBadgeLabel: "Le plus choisi" } },
      conversion_1: COMMON.conversion,
      plan_rules_1: { settings: { title: "Comment fonctionnent les crédits ?", eyebrow: "FORMULES ET CRÉDITS", body: "Les crédits servent à lancer les parcours disponibles dans votre compte. Vérifiez le coût, les sources et le résultat attendu avant chaque demande.", primaryCta: "Voir les formules", secondaryCta: "Créer avec vos photos" }, blocks: {
        plan_rule_tools: { meta: "Parcours", title: "Choisir un outil", description: "Sélectionnez un pack photo ou un thème vidéo selon le résultat recherché." },
        plan_rule_model: { meta: "Paramètres", title: "Vérifier le rendu", description: "Contrôlez les sources, le format et la direction avant de lancer la génération." },
        plan_rule_credits: { meta: "Crédits", title: "Consulter le coût", description: "Le coût prévu est visible avant la confirmation de la demande." },
        plan_rule_gallery: { meta: "Galerie privée", title: "Relire les résultats", description: "Retrouvez les créations dans votre compte et téléchargez celles qui conviennent." }
      } },
      pricing_intro_1: { settings: { title: "Des tarifs lisibles pour vos créations IA", eyebrow: "TARIFS", body: "Consultez les formules disponibles, comparez les crédits inclus et choisissez le rythme qui correspond à vos projets." } }
    }
  },
  "/workflow": {
    seo: ["Comment créer avec l’IA | Aidreamcapes", "Suivez le parcours Aidreamcapes : importer des photos autorisées, choisir un thème, vérifier les crédits et retrouver les résultats privés.", "comment créer avec IA, workflow photo IA, workflow vidéo IA"],
    ogImageAlt: "Parcours visuel d’une création photo et vidéo IA, de l’importation à la galerie.",
    sections: {
      workflow_1: { settings: { title: "Créer avec l’IA en quatre étapes", eyebrow: "COMMENT ÇA MARCHE", subtitle: "Importez vos sources, choisissez une direction, vérifiez le coût et relisez le résultat." }, blocks: {
        step_upload: { meta: "01", title: "Importer vos sources", text: "Ajoutez des photos, vidéos ou éléments que vous avez le droit d’utiliser." },
        step_pack: { meta: "02", title: "Choisir une direction", text: "Sélectionnez un pack photo ou un thème vidéo adapté à votre objectif." },
        step_credits: { meta: "03", title: "Vérifier les crédits", text: "Consultez le coût, les paramètres et les sources avant de confirmer." },
        step_deliver: { meta: "04", title: "Relire et télécharger", text: "Retrouvez les résultats terminés dans votre galerie privée, puis vérifiez-les avant le partage." }
      } },
      conversion_1: COMMON.conversion,
      plan_rules_1: { settings: { title: "Un parcours visible à chaque étape", eyebrow: "CONTRÔLES UTILES", body: "AIdreamcapes regroupe les sources, les choix créatifs, les crédits et les résultats dans un espace connecté afin de rendre chaque demande plus facile à vérifier." }, blocks: {
        plan_rule_tools: { meta: "01 · Sources", title: "Préparer les fichiers", description: "Utilisez des sources nettes et autorisées, avec les personnes et les détails nécessaires visibles." },
        plan_rule_model: { meta: "02 · Direction", title: "Choisir le rendu", description: "Définissez l’ambiance, le cadrage, le format et le message à conserver." },
        plan_rule_credits: { meta: "03 · Coût", title: "Confirmer la demande", description: "Relisez le coût en crédits et les paramètres avant de lancer la création." },
        plan_rule_gallery: { meta: "04 · Livraison", title: "Vérifier la galerie", description: "Contrôlez les visages, les mains, le texte et le contexte avant le téléchargement." }
      } },
      tutorial_video_1: { settings: { title: "Voir le parcours de création", eyebrow: "GUIDE", subtitle: "Découvrez comment préparer une demande et vérifier un résultat dans l’espace privé.", playLabel: "Voir le guide de création", videoUrl: "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-20260814.mp4" } },
      workflow_intro_1: { settings: { title: "Pourquoi le parcours reste simple", eyebrow: "UN ESPACE PRIVÉ", body: "Vous choisissez une direction avant la génération, vous voyez les crédits nécessaires et vous retrouvez les résultats dans une galerie privée.", primaryCta: "Commencer à créer", secondaryCta: "Voir les tarifs" }, blocks: {
        workflow_intro_private: { meta: "Privé", title: "Garder les demandes regroupées", description: "Vos sources, demandes et créations restent associées à votre compte." },
        workflow_intro_credits: { meta: "Crédits", title: "Voir le coût avant de confirmer", description: "Le parcours affiche les crédits nécessaires avant le lancement." },
        workflow_intro_gallery: { meta: "Galerie", title: "Relire avant le partage", description: "Vérifiez le rendu final puis téléchargez les fichiers adaptés à votre usage." }
      } },
      tutorial_image_video_1: { settings: { title: "Passer d’une image à une courte vidéo", eyebrow: "IMAGE VERS VIDÉO", subtitle: "Animez une source autorisée lorsque le thème le permet et vérifiez chaque mouvement avant le partage.", playLabel: "Voir le guide image vers vidéo", videoUrl: "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-video-tutorial-20260814.mp4" } }
    }
  },
  "/about-us": {
    seo: ["À propos d’Aidreamcapes | Studio photo vidéo IA", "Découvrez Aidreamcapes, un studio photo et vidéo IA privé qui aide les créateurs à préparer, vérifier et conserver des contenus visuels.", "à propos Aidreamcapes, studio photo IA, studio vidéo IA"],
    ogImageAlt: "Portrait éditorial représentant l’univers créatif d’Aidreamcapes.",
    sections: {
      trust_1: COMMON.trust,
      conversion_1: COMMON.conversion,
      about_intro_1: { settings: { title: "Un studio privé pour créer avec l’IA", eyebrow: "À PROPOS D’AIDREAMCAPES", body: "Aidreamcapes aide les créateurs, les familles et les petites équipes à transformer des photos autorisées en portraits, séries et courtes vidéos à vérifier avant le partage.", primaryCta: "Commencer à créer", secondaryCta: "Nous contacter" }, blocks: {
        about_private: { meta: "Privé", title: "Un espace de travail personnel", description: "Les sources, les demandes et les résultats restent regroupés dans votre compte." },
        about_packages: { meta: "Parcours", title: "Choisir le résultat d’abord", description: "Parcourez les packs et les outils avant d’importer vos photos." },
        about_delivery: { meta: "Livraison", title: "Des résultats à vérifier", description: "Relisez chaque création dans la galerie privée avant de la télécharger." }
      } },
      about_story_1: { settings: { title: "Une création guidée par l’intention", eyebrow: "NOTRE APPROCHE", body: "Une bonne création commence par une intention claire : un portrait, une scène de couple, un contenu de créateur ou un souvenir de saison. Aidreamcapes rassemble les choix importants dans un même parcours afin que les sources, les crédits et les résultats restent faciles à comprendre.", bodyParagraphs: ["Une bonne création commence par une intention claire : un portrait, une scène de couple, un contenu de créateur ou un souvenir de saison.", "Aidreamcapes rassemble les choix importants dans un même parcours afin que les sources, les crédits et les résultats restent faciles à comprendre."] }, blocks: {
        about_story_start: { meta: "01", title: "Commencer par le sujet", description: "Définissez le résultat que vous souhaitez obtenir avant de choisir un style." },
        about_story_occasion: { meta: "02", title: "Respecter le contexte", description: "Gardez les personnes, les droits et l’occasion représentée au centre de la création." },
        about_story_next: { meta: "03", title: "Vérifier avant de partager", description: "Contrôlez les détails visuels, le texte et le format dans votre galerie privée." }
      } },
      about_values_1: { settings: { title: "Les principes qui structurent le service", eyebrow: "NOS PRINCIPES", body: "Nous privilégions des crédits lisibles, des sources autorisées, un parcours compréhensible et une vérification humaine du résultat avant le partage.", primaryCta: "Voir les tarifs", secondaryCta: "Consulter l’aide" }, blocks: {
        about_value_transparency: { meta: "01", title: "Crédits lisibles", description: "Le coût prévu doit être compris avant la confirmation d’une demande." },
        about_value_support: { meta: "02", title: "Parcours accompagné", description: "Les étapes et les informations utiles restent visibles dans l’espace privé." },
        about_value_safety: { meta: "03", title: "Usage responsable", description: "Les personnes, les droits et le contexte doivent être respectés dans chaque création." }
      } },
      about_company_1: { settings: { title: "L’entreprise qui opère le service", eyebrow: "INFORMATIONS LÉGALES", imageAlt: "Portrait éditorial illustrant l’équipe et l’activité d’Aidreamcapes.", imageCaption: "Espace de travail créatif consacré à des projets clients réels.", body: "Aidreamcapes est un service numérique consacré à la création photo et vidéo avec l’IA. Les informations sur l’opérateur, l’assistance et la juridiction sont présentées dans les pages légales et les coordonnées publiées.", bodyParagraphs: ["Aidreamcapes est un service numérique consacré à la création photo et vidéo avec l’IA.", "Les informations sur l’opérateur, l’assistance et la juridiction sont présentées dans les pages légales et les coordonnées publiées."] }, blocks: {
        about_company_operator: { meta: "Opérateur", title: "MRNARUEBET LLC", description: "Société opérant le service Aidreamcapes." },
        about_company_founder: { meta: "Direction", title: "NARUEBET NAKPHONG", description: "Responsable indiqué dans les informations de l’entreprise." },
        about_company_jurisdiction: { meta: "Juridiction", title: "Delaware, États-Unis", description: "MRNARUEBET LLC est organisée dans l’État du Delaware." }
      } }
    }
  },
  "/creators-circle": {
    seo: ["Cercle des créateurs Aidreamcapes", "Découvrez le Cercle des créateurs pour préparer des campagnes photo IA, des contenus partageables et des collaborations dans un cadre clair.", "Cercle des créateurs, programme créateur IA, campagnes photo"],
    ogImageAlt: "Créateurs préparant une campagne de contenus visuels avec l’IA.",
    sections: {
      trust_1: COMMON.trust,
      pricing_1: { settings: { title: "Des formules adaptées aux projets créatifs", subtitle: "Comparez les crédits et les parcours avant de préparer une campagne ou une série de contenus.", description: "Choisissez un rythme de création adapté à votre audience, à vos canaux et aux sources autorisées dont vous disposez.", marketComparison: "Vérifiez le prix actuel, les crédits inclus et les parcours pris en charge avant de planifier une campagne.", featuredBadgeLabel: "Recommandée" } },
      conversion_1: COMMON.conversion,
      creators_fit_1: { settings: { title: "Pour quels créateurs ?", eyebrow: "PROJETS ET AUDIENCES", body: "Le Cercle des créateurs s’adresse aux personnes qui souhaitent préparer des expériences visuelles claires pour une communauté, une marque ou un projet éditorial.", primaryCta: "Contacter le Cercle des créateurs", secondaryCta: "Voir les tarifs" }, blocks: {
        creator_fit_social: { meta: "Réseaux sociaux", title: "Créateurs de contenus courts", description: "Préparez des visuels cohérents pour Reels, TikTok, Shorts et carrousels." },
        creator_fit_newsletter: { meta: "Communauté", title: "Propriétaires de newsletters", description: "Proposez des idées visuelles à une audience qui vous connaît déjà." },
        creator_fit_photo: { meta: "Studio", title: "Photographes et consultants", description: "Présentez des directions créatives sans remplacer vos règles de consentement et de droits." },
        creator_fit_paid: { meta: "Campagnes", title: "Partenaires marketing", description: "Testez des concepts publicitaires et relisez chaque élément avant diffusion." }
      } },
      partner_form_1: { settings: { title: "Présenter une demande de partenariat", eyebrow: "CANDIDATURE", body: "Décrivez votre audience, vos canaux et les idées de contenus que vous souhaitez tester. Utilisez des informations précises et vérifiables.", primaryCta: "Envoyer la candidature", secondaryCta: "Retour au Cercle des créateurs" }, blocks: {
        partner_field_name: { label: "Nom complet", placeholder: "Votre nom" }, partner_field_email: { label: "Adresse e-mail", placeholder: "vous@exemple.com" }, partner_field_website: { label: "Site ou profil principal", placeholder: "https://votre-site.com" }, partner_field_channels: { label: "Canaux de diffusion", placeholder: "Instagram, TikTok, YouTube, newsletter ou communauté" }, partner_field_audience: { label: "Votre audience", placeholder: "Qui vous suit et pourquoi ces packs photo IA pourraient l’intéresser ?" }, partner_field_cadence: { label: "Rythme de publication", placeholder: "Vidéos hebdomadaires, newsletters, campagnes ou publications de communauté" }, partner_field_ideas: { label: "Premières idées", placeholder: "Quels packs, récits ou angles saisonniers souhaitez-vous tester ?" }, partner_field_terms: { label: "J’accepte les conditions du partenariat" }
      } },
      creators_intro_1: { settings: { title: "Construire une expérience visuelle utile", eyebrow: "POUR VOS PROJETS", body: "Présentez une idée claire, choisissez des sources autorisées et mesurez la qualité du résultat avant de le partager avec votre audience.", primaryCta: "Parler de votre projet", secondaryCta: "Commencer à créer" }, blocks: {
        creator_intro_commission: { meta: "Canal", title: "Choisir le bon format", description: "Adaptez le cadrage et la durée à votre canal et à votre audience." },
        creator_intro_privacy: { meta: "Confiance", title: "Respecter le parcours privé", description: "Gardez les sources et les demandes dans un espace contrôlé." },
        creator_intro_assets: { meta: "Ressources", title: "Préparer des assets cohérents", description: "Utilisez des images et des éléments dont les droits sont vérifiés." },
        creator_intro_measurement: { meta: "Mesure", title: "Relire avant publication", description: "Contrôlez le message, le rendu et les règles du canal avant de publier." }
      } },
      creators_steps_1: { settings: { title: "Comment fonctionne le partenariat", eyebrow: "QUATRE ÉTAPES", body: "Présentez votre projet, échangez sur le bon parcours, préparez une première activation et analysez les retours." }, blocks: {
        creator_step_apply: { meta: "01", title: "Présenter votre projet", description: "Indiquez votre audience, vos canaux et votre intention." }, creator_step_match: { meta: "02", title: "Choisir un parcours", description: "Identifiez les packs et les formats qui correspondent à votre public." }, creator_step_launch: { meta: "03", title: "Lancer un test", description: "Préparez une première série et vérifiez chaque contenu avant diffusion." }, creator_step_learn: { meta: "04", title: "Analyser et améliorer", description: "Conservez ce qui fonctionne et ajustez la direction pour la suite." }
      } },
      partner_expectations_1: { settings: { title: "Ce que nous recherchons", eyebrow: "AVANT D’ENVOYER VOTRE DEMANDE", body: "Nous privilégions les projets qui présentent une audience identifiable, une idée utile et un usage respectueux des images et des personnes." }, blocks: {
        partner_expectation_fit: { meta: "Audience", title: "Une audience identifiable", description: "Expliquez qui vous suit et quel besoin visuel vous souhaitez servir." }, partner_expectation_quality: { meta: "Qualité", title: "Un cadrage créatif utile", description: "Décrivez le résultat attendu et le canal sur lequel il sera vérifié." }, partner_expectation_compliance: { meta: "Règles", title: "Un usage responsable", description: "Respectez le consentement, les droits, la confidentialité et les règles publicitaires." }, partner_expectation_launch: { meta: "Lancement", title: "Une formule testable", description: "Proposez une première idée limitée, mesurable et facile à relire." }
      } }
    }
  },
  "/tools": {
    seo: ["Outils photo et vidéo IA | Aidreamcapes", "Choisissez un outil photo ou vidéo avec l’IA pour créer, retoucher, animer et organiser vos contenus dans un espace privé.", "outils photo IA, outils vidéo IA, retouche photo IA, animation photo"],
    ogImageAlt: "Interface d’outils de création photo et vidéo avec l’IA.",
    sections: { video_theme_directory_1: { settings: { title: "Outils photo et vidéo IA", subtitle: "Choisissez un outil pour créer, retoucher ou animer une image dans un parcours clair.", headingLevel: "h1" } } }
  },
  "/blog/video-photo-package-guide": {
    seo: ["Guide vidéo et photo IA | Aidreamcapes", "Apprenez à préparer une photo et une courte vidéo avec l’IA : sources autorisées, choix du thème, crédits, vérification et galerie privée.", "guide photo IA, guide vidéo IA, animation photo, galerie privée"],
    ogImageAlt: "Guide visuel pour préparer une photo et une courte vidéo avec l’IA.",
    sections: {
      blog_detail_1: { settings: {
        title: "Préparer une photo et une courte vidéo avec l’IA",
        summary: "Suivez une méthode claire pour choisir vos sources, sélectionner un thème, contrôler les crédits et vérifier chaque résultat dans votre galerie privée.",
        eyebrow: "GUIDE PHOTO ET VIDÉO IA",
        author: "Équipe éditoriale Aidreamcapes",
        authorUrl: "/about-us",
        authorType: "Organization",
        entityName: "Guide Aidreamcapes sur la préparation de photos et de courtes vidéos avec l’IA",
        tags: "photo IA|vidéo IA|animation photo|galerie privée",
        guideType: "Guide photo et vidéo IA",
        publishedAt: "2026-07-28",
        updatedAt: "2026-08-18",
        readMinutes: "7",
        evidenceType: "editorial-guidance",
        evidenceDate: "2026-08-18",
        reviewOwner: "Équipe éditoriale Aidreamcapes",
        targetHref: "/ai-video-generation/motion-generator",
        targetLabel: "Découvrir le générateur de mouvement",
        secondaryTargetHref: "/pricing",
        secondaryTargetLabel: "Voir les tarifs",
        primaryCta: "Créer avec vos photos",
        primaryHref: "/ai-image-generation",
        secondaryCta: "Voir les tarifs",
        secondaryHref: "/pricing",
        imageAlt: "Photo de référence préparée pour une courte animation avec l’IA.",
        relatedLinks: [
          { href: "/ai-video-generation/motion-generator", label: "Générateur de mouvement" },
          { href: "/ai-image-generation/avatar", label: "Créer un portrait de profil" }
        ],
        userIntent: "Préparer une photo autorisée ou une courte vidéo avec un mouvement cohérent dans une galerie privée.",
        inputRequirements: ["Une photo nette dont vous contrôlez les droits", "Une direction de mouvement compréhensible", "Un cadrage adapté au thème choisi"],
        reviewChecklist: ["Stabilité du visage", "Mains, cheveux et contours", "Recadrage du mouvement", "Artefacts dans l’arrière-plan"],
        verifiedLimitations: ["Le résultat, la stabilité de l’identité et le cadrage doivent être vérifiés avant le partage."],
        rightsWarnings: ["Utilisez uniquement des sources et des éléments dont vous détenez les droits ou l’autorisation."],
        body: "<p>Une bonne création photo ou vidéo avec l’IA commence par une source claire et une intention précise. Préparez une image dont vous contrôlez les droits, puis choisissez un thème correspondant au résultat attendu.</p><h2>Préparer les sources et le cadrage</h2><p>Utilisez une photo nette, suffisamment éclairée et adaptée au mouvement ou au style recherché. Vérifiez les personnes visibles, les marques, le texte et les éléments que vous êtes autorisé à transformer.</p><h2>Choisir le thème et vérifier les crédits</h2><p>Comparez le cadrage, l’ambiance, le format et la durée avant de confirmer. Le coût en crédits doit être lisible avant la demande, afin que vous puissiez choisir un parcours adapté à votre projet.</p><h2>Relire le résultat dans la galerie privée</h2><p>Après la génération, contrôlez le visage, les mains, les cheveux, le mouvement, le texte et l’arrière-plan. Téléchargez uniquement un résultat cohérent avec les sources, les droits des personnes et le canal de diffusion prévu.</p>"
      } }
    }
  }
};

function clone(value) { return structuredClone(value); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function patchSection(section, spec) {
  if (!section || !spec) return false;
  let changed = false;
  if (spec.settings) {
    const nextSettings = { ...(section.settings ?? {}), ...spec.settings };
    changed ||= JSON.stringify(nextSettings) !== JSON.stringify(section.settings ?? {});
    section.settings = nextSettings;
  }
  if (spec.blocks && Array.isArray(section.blocks)) {
    section.blocks = section.blocks.map((block) => {
      const patch = spec.blocks[block.id];
      if (!patch) return block;
      const next = { ...block, settings: { ...(block.settings ?? {}), ...patch } };
      changed ||= JSON.stringify(next) !== JSON.stringify(block);
      return next;
    });
  }
  if (spec.faq && Array.isArray(section.blocks)) {
    section.blocks = section.blocks.map((block, index) => ({
      ...block,
      settings: { ...(block.settings ?? {}), question: spec.faq[index]?.[0] ?? block.settings?.question ?? "", answer: spec.faq[index]?.[1] ?? block.settings?.answer ?? "" }
    }));
    changed = true;
  }
  return changed;
}
function applySpec(input, pagePath, spec) {
  const page = clone(input ?? { pageType: "page", sections: {}, sectionsOrder: [] });
  page.seo = { ...(page.seo ?? {}) };
  const [title, description, keywords] = spec.seo;
  page.seo = {
    ...page.seo,
    index: true,
    follow: true,
    title,
    description,
    keywords,
    canonical: `${DOMAIN}${pagePath}`,
    canonicalPath: pagePath,
    robots: { ...(page.seo.robots ?? {}), index: true, follow: true, maxImagePreview: "large" },
    ogImageAlt: spec.ogImageAlt,
    twitterImageAlt: spec.ogImageAlt
  };
  page.sections = page.sections ?? {};
  for (const [sectionId, sectionSpec] of Object.entries(spec.sections ?? {})) {
    patchSection(page.sections[sectionId], sectionSpec);
  }
  return page;
}

function packImages(pack) {
  if (!pack) return [];
  return [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])].filter((value) => typeof value === "string" && value.startsWith("/assets/"));
}

function applyFeaturedPackImages(page, packByName) {
  const featured = [
    ["featured_pack_1", /soccer/i],
    ["featured_christmas_1", /christmas/i],
    ["featured_thanksgiving_1", /thanksgiving/i]
  ];
  for (const [sectionId, namePattern] of featured) {
    const section = page.sections?.[sectionId];
    const pack = [...packByName.entries()].find(([name]) => namePattern.test(name))?.[1];
    const images = packImages(pack);
    if (!section || images.length < 6 || !Array.isArray(section.blocks)) continue;
    section.blocks = section.blocks.map((block, index) => ({
      ...block,
      settings: { ...(block.settings ?? {}), imageUrl: images[index % images.length] }
    }));
  }
  return page;
}

const prisma = new PrismaClient();
try {
  const paths = Object.keys(SPECS);
  const [themes, lives, packs] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: paths } } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: paths } } }),
    prisma.creativePack.findMany({ where: { siteId: SITE_ID, status: "active", name: { in: ["Soccer", "Christmas Photo", "Thanksgiving Photo"] } }, select: { name: true, imageUrl: true, galleryImages: true } })
  ]);
  const packByName = new Map(packs.map((pack) => [pack.name, pack]));
  const themeByPath = new Map(themes.map((row) => [row.slug, row]));
  const liveByPath = new Map(lives.map((row) => [row.slug, row]));
  const report = { ok: true, mode: apply ? "apply-local" : "dry-run", siteId: SITE_ID, providerCalls: 0, oldResourcesDeleted: 0, pages: [], backup: null };
  for (const pagePath of paths) {
    const spec = SPECS[pagePath];
    const theme = themeByPath.get(pagePath);
    const live = liveByPath.get(pagePath);
    const nextThemeDraft = theme ? applyFeaturedPackImages(applySpec(theme.draftJson, pagePath, spec), packByName) : undefined;
    const nextThemePublished = theme ? applyFeaturedPackImages(applySpec(theme.publishedJson, pagePath, spec), packByName) : undefined;
    const nextLive = live ? applyFeaturedPackImages(applySpec(live.contentJson, pagePath, spec), packByName) : undefined;
    report.pages.push({ path: pagePath, themePage: Boolean(theme), livePage: Boolean(live), changed: Boolean(
      (theme && (JSON.stringify(theme.draftJson) !== JSON.stringify(nextThemeDraft) || JSON.stringify(theme.publishedJson) !== JSON.stringify(nextThemePublished))) ||
      (live && JSON.stringify(live.contentJson) !== JSON.stringify(nextLive))
    ) });
    if (apply && (theme || live)) {
      report.backup ||= path.join(BACKUP_ROOT, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      const backup = fs.existsSync(report.backup) ? JSON.parse(fs.readFileSync(report.backup, "utf8")) : { themePages: [], livePages: [] };
      if (theme) backup.themePages.push({ id: theme.id, slug: theme.slug, draftJson: theme.draftJson, publishedJson: theme.publishedJson });
      if (live) backup.livePages.push({ id: live.id, slug: live.slug, contentJson: live.contentJson });
      writeJson(report.backup, backup);
    }
  }
  if (apply) {
    await prisma.$transaction(async (tx) => {
      for (const pagePath of paths) {
        const theme = themeByPath.get(pagePath);
        const live = liveByPath.get(pagePath);
        const spec = SPECS[pagePath];
        if (theme) await tx.themePage.update({ where: { id: theme.id }, data: { draftJson: applyFeaturedPackImages(applySpec(theme.draftJson, pagePath, spec), packByName), publishedJson: applyFeaturedPackImages(applySpec(theme.publishedJson, pagePath, spec), packByName) } });
        if (live) await tx.livePage.update({ where: { id: live.id }, data: { contentJson: applyFeaturedPackImages(applySpec(live.contentJson, pagePath, spec), packByName) } });
      }
    });
  }
  const reportPath = path.join(BACKUP_ROOT, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeJson(reportPath, report);
  console.log(JSON.stringify({ ...report, report: reportPath }, null, 2));
} finally {
  await prisma.$disconnect();
}
