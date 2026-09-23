const HOME_SEO = {
  title: "Création photo et vidéo IA | AIdreamcapes",
  description: "Créez des portraits, séries photo et courtes vidéos avec vos propres images. AIdreamcapes vous accompagne dans un espace privé, avec des crédits visibles et des galeries personnelles.",
  keywords: "générateur photo IA, générateur vidéo IA, portraits IA, séries photo, galerie privée, AIdreamcapes"
};

export const AIDREAMCAPES_EU_HOMEPAGE_VIDEO_SLUGS = [
  "talking-photo",
  "cinematic-video",
  "music-video",
  "tiktok-video",
  "instagram-reels",
  "product-video",
  "product-ad-video",
  "promo-video"
];
export const AIDREAMCAPES_EU_HOMEPAGE_IMAGE_SLUGS = [
  "engagement",
  "wedding-photo",
  "valentine-photos",
  "christmas-photos",
  "halloween-party-photos",
  "thanksgiving-group-photos",
  "profile-cards",
  "professional-headshots"
];

export const AIDREAMCAPES_EU_HOMEPAGE_SECTION_ORDER = [
  "hero_1",
  "generation_showcase_1",
  "tutorial_video_1",
  "proof_1",
  "faq_1",
  "conversion_1",
  "brand_strip_1"
];

export const AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCK_IDS = [
  "review_ava",
  "review_lucas",
  "review_mia",
  "review_noah",
  "review_chloe",
  "review_eli",
  "review_jordan",
  "review_riley"
];

const AIDREAMCAPES_EU_EXCLUDED_FOOTER_HREFS = new Set(["/workflow", "/pricing"]);

const HOME_SECTION_COPY = {
  hero_1: {
    eyebrow: "Création photo et vidéo avec l’IA",
    headline: "Créez des vidéos, portraits professionnels et séries photo avec vos images",
    heroBadge: "Création photo et vidéo IA",
    authRibbon: "Consultez vos crédits avant la génération",
    bulletList: "Politique d’entraînement - {LIVE_TRAINING_POLICY_STATEMENT}|Conservation des sources - Vos photos suivent la durée de conservation publiée de {LIVE_SOURCE_MEDIA_RETENTION_DAYS} jours.|Examen des remboursements - {LIVE_REFUND_REVIEW_POLICY_STATEMENT} Les demandes doivent être envoyées sous {LIVE_REFUND_WINDOW_DAYS} jours.|Espace sécurisé - Importations, demandes, crédits et galeries restent dans votre compte.",
    imageBadge: "Flux photo et vidéo IA",
    subheadline: "Importez vos photos et choisissez votre création : vidéos IA, annonces Save the Date, portraits professionnels, portraits de couple, images saisonnières ou séries créatives. Consultez les exemples et le coût en crédits avant de lancer la génération, puis retrouvez vos résultats dans votre espace.",
    imageCaption: "Créez des vidéos et séries photo pour vos réseaux, vos profils professionnels, vos portraits, vos souvenirs de couple et vos projets créatifs.",
    highlightWord: "Portraits IA",
    authButtonLabel: "Créer un compte avec votre e-mail",
    authPrimaryLabel: "Continuer avec Google",
    socialProofLabel: "Importations, demandes et galeries privées",
    authEmailPlaceholder: "Adresse e-mail"
  },
  generation_showcase_1: {
    title: "Découvrez les thèmes photo et vidéo déjà créés par notre communauté.",
    eyebrow: "Exemples créés par nos clients",
    subtitle: "Ces exemples proviennent de créations réalisées dans des comptes privés. Parcourez les thèmes pour choisir une direction qui vous ressemble.",
    imageTitle: "Générateurs photo IA à découvrir",
    primaryCta: "Commencer avec vos photos",
    videoTitle: "Générateurs vidéo IA à découvrir",
    imageAllLabel: "Voir toutes les photos",
    videoAllLabel: "Voir toutes les vidéos",
    imageSlugs: AIDREAMCAPES_EU_HOMEPAGE_IMAGE_SLUGS.join("|"),
    videoSlugs: AIDREAMCAPES_EU_HOMEPAGE_VIDEO_SLUGS.join("|"),
    videoItemLimit: 8
  },
  tutorial_video_1: {
    title: "Comment ça marche",
    eyebrow: "Comment ça marche",
    imageAlt: "Capture de la page d’accueil montrant le parcours de création photo IA et l’inscription au compte.",
    subtitle: "Importez des photos autorisées, choisissez un flux de création, consultez le coût en crédits et générez depuis votre espace connecté.",
    playLabel: "Voir le tutoriel de création AIdreamcapes",
    supportingCopy: "Choisissez un flux vidéo IA lorsque vous souhaitez transformer une image ou une série approuvée en courte séquence, puis vérifiez le résultat avant de le partager."
  },
  proof_1: {
    mode: "reviews",
    title: "Ce que disent nos clients",
    subtitle: "Des créations personnelles, simples à préparer et à retrouver.",
    summaryBody: "AIdreamcapes est un studio photo et vidéo IA privé qui aide les créateurs, les familles et les petites équipes à explorer de nouvelles images à partir de photos qu’ils sont autorisés à utiliser.",
    summaryMeta: "Avis positifs",
    summaryTitle: "Ce que disent nos clients"
  },
  faq_1: {
    title: "Questions fréquentes",
    eyebrow: "Avant d’importer vos photos",
    imageAlt: "Portrait chaleureux dans une ambiance festive pour une série de cartes saisonnières.",
    subtitle: "Des réponses claires sur les photos sources, les packs, les crédits, les images IA, les courtes vidéos, les outils de style, la confidentialité et la livraison.",
    featureCaption: "Des directions de création originales, des photos sources autorisées et une livraison en galerie privée dans un seul compte.",
    imageListAlt: "Portrait festif à la lumière chaleureuse|Portrait de couple dans un décor hivernal enneigé|Portrait de couple avec une composition prête pour une carte|Portrait de groupe autour d’une table chaleureuse|Portrait de fête d’Halloween avec un style cinématographique|Série de portraits saisonniers avec une lumière festive",
    journeyTitle: "Votre parcours photo",
    journeyTitles: "Importer|Choisir un pack|Générer|Télécharger",
    journeyDescriptions: "Ajoutez des photos nettes.|Choisissez une scène ou un style.|L’IA crée votre série.|Téléchargez vos résultats dans la galerie privée."
  },
  pricing_1: {
    title: "Formules et crédits",
    subtitle: "Choisissez la formule de crédits adaptée à vos albums privés de fans et à vos souvenirs de saison.",
    description: "Utilisez vos crédits pour les parcours photo et vidéo IA disponibles. Le coût requis en crédits est affiché avant la création.",
    sidePanelBody: "Vérifiez le coût en crédits avant chaque création et utilisez la formule ou la recharge adaptée à vos besoins.",
    sidePanelTitle: "Des formules claires pour créer des albums privés et explorer de nouvelles idées en toute simplicité.",
    sidePanelEyebrow: "Pourquoi choisir les crédits",
    featuredBadgeLabel: "Le plus populaire"
  },
  package_catalog_1: {
    tabs: "Tout|Photos de fans|Sports|Looks VIP|Noël|Action de grâce|Halloween|Saisonnier|Créateur|Vidéo|Outils",
    label: "STUDIOS PHOTO IA",
    steps: "Choisir un pack|Voir le coût en crédits|Créer l’album",
    title: "Packs photo IA par style et usage",
    subtitle: "Découvrez les thèmes AIdreamcapes publiés : portraits professionnels, créations lifestyle, univers créatifs, effets magiques et outils photo, avant d’utiliser vos crédits.",
    directoryLabel: "THÈMES PHOTO IA",
    directorySubtitle: "Comparez chaque thème actif par catégorie, titre, couverture et parcours avant de commencer un pack photo privé."
  },
  conversion_1: {
    title: "Envie d’essayer AIdreamcapes ?",
    eyebrow: "CRÉATION PHOTO ET VIDÉO IA",
    subtitle: "Créez des vidéos IA, des annonces Save the Date et des séries photo professionnelles à partir de vos images, dans un seul espace privé.",
    primaryCta: "Créer maintenant",
    secondaryCta: "Choisir une formule"
  },
  brand_strip_1: {
    title: "Pour les créateurs, photographes, vendeurs sociaux, studios, communautés de fans et petites équipes."
  }
};

const HOME_BLOCK_COPY = {
  hero_cta_primary: { label: "Créer maintenant" },
  hero_cta_secondary: { label: "Explorer les vidéos IA" },
  hero_stat_credits: { label: "affichés avant la génération", value: "Crédits" },
  hero_stat_packs: { label: "flux photo et vidéo IA", value: "Photo + vidéo" },
  hero_stat_private: { label: "importations, demandes, galeries", value: "Privé" },
  review_ava: { role: "Série de supporters", quote: "Je ne pensais pas que les scènes dans le stade seraient aussi convaincantes. La photo de football est devenue ma préférée.", location: "Série de fans" },
  review_lucas: { role: "Série professionnelle", quote: "J’avais besoin rapidement d’une nouvelle photo de profil. J’ai obtenu plusieurs portraits que je peux vraiment utiliser sur mon profil professionnel et mon site.", location: "Images de profil" },
  review_mia: { role: "Album de Noël", quote: "Nous avons créé nos photos de Noël à partir de quelques photos prises avec nos téléphones. Le résultat a dépassé nos attentes et nous en avons choisi une pour notre carte.", location: "Cartes de fête" },
  review_noah: { role: "Parcours avec crédits", quote: "C’est très simple. J’ai importé quelques photos, choisi le style qui me plaisait et tout était disponible dès que la création était prête.", location: "Galerie privée" },
  review_chloe: { role: "Contenu de créateur", quote: "Je voulais renouveler mes contenus sans refaire toujours la même séance. Certaines images étaient assez réussies pour être publiées dans la semaine.", location: "Scènes de créateur" },
  review_eli: { role: "Crédits transparents", quote: "Les portraits professionnels m’ont le plus surpris. Ils me ressemblent, avec un rendu beaucoup plus soigné que mes selfies précédents.", location: "Portraits et cartes" },
  review_jordan: { role: "Portraits d’équipe", quote: "Nous avions besoin de photos cohérentes pour notre page d’équipe sans organiser une journée complète en studio. Le résultat a demandé beaucoup moins d’efforts.", location: "Mise à jour de profil" },
  review_riley: { role: "Aperçus animés", quote: "Je l’ai d’abord essayé pour mes contenus Instagram et j’ai finalement conservé beaucoup plus d’images que prévu. C’est agréable d’avoir de nouvelles idées à publier.", location: "Contenu social" },
  cta_metric_credits: { label: "crédits de départ" },
  cta_metric_styles: { label: "packs de scènes disponibles" },
  cta_metric_private: { label: "Albums et importations privés", value: "" },
  partner_creator_teams: { name: "Équipes de créateurs", badge: "Contenu" },
  partner_photo_studios: { name: "Studios photo", badge: "Studio" },
  partner_social_sellers: { name: "Vendeurs sociaux", badge: "Commerce" },
  partner_fan_pages: { name: "Pages de fans", badge: "Communauté" },
  partner_event_marketers: { name: "Organisateurs d’événements", badge: "Campagne" },
  partner_holiday_shops: { name: "Boutiques saisonnières", badge: "Saison" },
  partner_creator_coaches: { name: "Accompagnateurs de créateurs", badge: "Guides" },
  partner_small_teams: { name: "Petites équipes", badge: "Profils" },
  catalog_worldcup: { meta: "Photos de supporters", title: "Photos de supporters de football", category: "Sports", description: "Créez des portraits de supporters, des affiches de match, des scènes de stade et des avatars pour vos propres photos. Usage personnel uniquement, sans logos officiels ni ressemblance de joueur sans autorisation." },
  catalog_christmas: { meta: "Cartes de fête", title: "Photos de Noël", category: "Noël", description: "Créez des portraits de groupe festifs, des visuels pour cartes, des scènes de couple chaleureuses et des souvenirs de saison." },
  catalog_christmas_couple: { meta: "Cartes de couple", title: "Nuits urbaines", category: "Style créatif", description: "Créez des portraits de couple en hiver, des moments entre amis et des souvenirs de fête à offrir." },
  catalog_holiday: { meta: "Albums de saison", title: "Fêtes et saisons", category: "Saisonnier", description: "Créez des portraits de saison pour Noël, l’Action de grâce, Halloween, les cartes familiales et les albums de groupe privés." },
  catalog_creator_vip: { meta: "Looks de tapis rouge", title: "Style créateur et gala", category: "Looks VIP", description: "Créez des portraits de soirée, des scènes de tapis rouge et des images de marque personnelle soignées à partir de photos autorisées." },
  catalog_thanksgiving: { meta: "Portraits de groupe", title: "Photos de fête", category: "Action de grâce", description: "Créez des portraits familiaux chaleureux, des souvenirs autour de la table, des cartes de gratitude et des albums saisonniers privés." },
  catalog_halloween: { meta: "Albums de fête", title: "Photos d’Halloween", category: "Halloween", description: "Créez des portraits costumés, des cartes de groupe originales, des looks cinématographiques et des images sociales de saison." },
  faq_about: { body: "Choisissez un pack ou un outil, consultez le coût en crédits, importez vos photos depuis votre compte et retrouvez vos créations dans une galerie privée.|AIdreamcapes vous aide à explorer une direction visuelle avant d’organiser une séance traditionnelle ou de multiplier les retouches.", answer: "AIdreamcapes est un studio photo et vidéo IA privé qui transforme des photos autorisées en portraits thématiques, images de groupe, visuels de profil, cartes saisonnières et courtes scènes animées.", imageAlt: "Portrait lifestyle avec un cadrage naturel pour un profil", question: "Qu’est-ce qu’AIdreamcapes ?", bulletList: "Parcours privé pour vos photos sources|Choix du pack et du flux avant la génération|Créations regroupées dans votre compte", linkList: "Parcourir les collections photo::/ai-image-generation|Découvrir les outils créatifs::/ai-video-generation" },
  faq_use: { body: "Le parcours réunit les décisions importantes : photos sources, direction du pack, fichiers sélectionnés, coût en crédits et état de la génération.|Vous pouvez vérifier la demande avant son lancement, puis revenir à la galerie privée lorsque le résultat est prêt.", answer: "Choisissez un pack ou un outil correspondant au résultat recherché, puis suivez les étapes d’importation et de génération dans votre espace connecté.", question: "Comment utiliser AIdreamcapes ?", bulletList: "Choisir une collection ou un outil|Importer des photos que vous pouvez utiliser|Confirmer la demande et les crédits|Vérifier et télécharger les résultats", linkList: "Voir le parcours::/workflow|Ouvrir votre espace::/login" },
  faq_use_cases: { body: "Chaque pack est organisé autour d’un objectif visuel. Les exemples vous aident à comparer la composition, la tenue, la lumière, le cadrage et le canal de diffusion avant d’utiliser vos crédits.", answer: "Le catalogue couvre les portraits personnels, les portraits professionnels, les visuels de créateur, les scènes de couple et de groupe, les univers éditoriaux, les cartes saisonnières et certains flux vidéo.", question: "Que puis-je créer ?", bulletList: "Profils et portraits professionnels|Contenu de créateur et réseaux sociaux|Portraits de couple, d’amis et de groupes|Albums de Noël, d’Halloween et de saison|Courtes séquences animées", linkList: "Comparer les thèmes photo::/ai-image-generation|Voir les outils vidéo::/ai-video-generation" },
  faq_free: { body: "L’écran de demande indique ce qui est disponible pour votre compte et le coût de chaque génération.|Vous n’avez pas à deviner le montant : vérifiez le pack, les fichiers sélectionnés et les crédits nécessaires avant de commencer.", answer: "La disponibilité dépend de la configuration actuelle des outils et des formules. Les aperçus légers peuvent être proposés sans abonnement lorsqu’ils sont activés, tandis que les créations privées, packs premium et demandes vidéo utilisent des crédits.", question: "AIdreamcapes est-il gratuit ?", bulletList: "Vérifier la formule et les outils disponibles|Consulter le coût en crédits avant la génération|Consulter la page des tarifs pour les conditions actuelles", linkList: "Voir les formules et tarifs::/pricing|Consulter les outils disponibles::/ai-video-generation" },
  faq_plans: { body: "Le nombre de crédits, le contenu des packs et les promotions éventuelles sont indiqués dans le parcours actuel de tarifs ou de paiement. Les offres pouvant évoluer, cette FAQ ne promet pas de bonus ni de durée fixe.|Les crédits sont liés au compte qui les a achetés ou reçus et doivent être vérifiés avant chaque demande.", answer: "Les formules donnent accès au compte et à des crédits récurrents. Des recharges ou packs ponctuels peuvent compléter vos besoins lorsqu’ils sont disponibles.", question: "Comment fonctionnent les formules, crédits et promotions ?", bulletList: "Les formules et recharges répondent à des usages différents|Les tarifs actuels définissent l’offre active|Lire les détails avant de confirmer le paiement", linkList: "Comparer les formules::/pricing|Lire les conditions d’achat::/terms" },
  faq_credits: { body: "Une demande peut prendre un peu de temps car les images et les vidéos utilisent une capacité de traitement dédiée. Votre espace rassemble l’état de la demande et l’historique du compte pour suivre les crédits réservés ou libérés.", answer: "Le coût en crédits est affiché avant le lancement. Les crédits sont réservés au début, comptabilisés après une livraison réussie et libérés lorsqu’une demande échoue selon son état.", question: "Quand les crédits sont-ils utilisés ?", bulletList: "Vérifier le coût avant de commencer|Une réservation peut rester active pendant le traitement|Une demande échouée peut libérer la réservation selon son état", linkList: "Consulter les détails de la formule::/pricing|Contacter l’assistance::/contact-us" },
  faq_uploads: { body: "Vos photos sources n’ont pas besoin de provenir d’un studio professionnel. Des photos prises au téléphone peuvent convenir si le sujet est bien éclairé, dégagé et photographié sous plusieurs angles utiles.", answer: "Utilisez des photos récentes et nettes où le visage est visible, sans filtre trop marqué. Quelques images variées donnent souvent de meilleures informations que de nombreux doublons.", imageAlt: "Portrait source net avec une lumière régulière et un visage visible", question: "Quelles photos dois-je importer ?", bulletList: "Privilégier une image nette et une lumière régulière|Inclure des vues de face, de trois-quarts et des expressions naturelles|Éviter les lunettes de soleil, filtres forts, flous et visages coupés|Prévoir une variété de tenues ou de coiffures si le pack le demande", linkList: "Voir le parcours d’importation::/workflow" },
  faq_couples: { body: "Pour une série de groupe, organisez vos photos sources et assurez-vous que chaque personne a autorisé l’usage prévu. Les résultats peuvent varier lorsque les visages sont petits, masqués ou trop rapprochés.", answer: "Oui. Les créations de couple, d’amis et de groupes fonctionnent mieux lorsque chaque personne est clairement visible sur des photos autorisées et que le pack choisi prend en charge plusieurs sujets.", imageAlt: "Portrait de couple dans une ambiance saisonnière douce", question: "Puis-je créer des photos de couple ou de groupe ?", bulletList: "Obtenir l’accord de chaque personne représentée|Utiliser des photos individuelles et de groupe nettes|Choisir un pack adapté au nombre de sujets|Vérifier les visages et les mains avant de partager", linkList: "Parcourir les thèmes de couple et de groupe::/ai-image-generation" },
  faq_photo_generator: { body: "Les exemples montrent une direction visuelle, sans garantir un résultat identique. La qualité des sources, la pose, la lumière, le nombre de sujets et le comportement du modèle influencent les images finales.", answer: "Le générateur associe vos photos sources autorisées à la direction du pack choisi pour créer une nouvelle série qui suit sa composition, son style et ses indications de scène.", imageAlt: "Portrait de créateur avec un cadrage soigné pour les réseaux", question: "Comment fonctionne le générateur de photos IA ?", bulletList: "Choisir une direction visuelle|Importer les photos sources|Vérifier la demande et les crédits|Examiner la galerie et conserver les meilleurs résultats", linkList: "Découvrir les collections photo::/ai-image-generation" },
  faq_video: { body: "La création vidéo est plus sensible à la composition et aux indications de mouvement qu’une image fixe. Commencez avec une image claire, gardez une intention précise et suivez l’aperçu ou l’état dans votre compte.", answer: "Certains thèmes transforment des images autorisées ou une direction visuelle préparée en courtes séquences animées. L’écran de demande précise les entrées, le format et le coût en crédits.", imageAlt: "Portrait prêt pour une courte séquence animée", question: "Comment fonctionne le parcours vidéo IA ?", bulletList: "Choisir un thème ou un pack compatible vidéo|Utiliser une image source claire ou une image terminée|Confirmer la durée, le format et les crédits affichés|Télécharger la séquence depuis votre espace privé", linkList: "Voir les outils vidéo::/ai-video-generation|Consulter le parcours::/workflow" },
  faq_styling: { body: "Ces outils permettent de comparer une apparence avant un rendez-vous ou une séance réelle. Il s’agit d’explorations visuelles : la couleur, la coupe, la matière et les détails du visage peuvent varier.", answer: "Les outils de style appliquent une modification ciblée, comme une coiffure, une apparence virtuelle, une orientation vestimentaire ou un traitement de présentation, à partir de votre photo source.", imageAlt: "Portrait de style virtuel avec une idée de coiffure et de tenue", question: "Comment fonctionnent les outils de style et de coiffure ?", bulletList: "Importer une image source bien éclairée|Choisir une direction de style à la fois|Comparer le résultat avec l’original|Considérer le résultat comme une idée, pas comme une garantie de coupe ou de taille", linkList: "Ouvrir les outils de style::/ai-video-generation" },
  faq_operator: { body: "Pour une question de formule, un écart de crédits, une demande échouée ou un problème de livraison, indiquez l’adresse du compte, les détails de la demande et une courte description afin que l’assistance retrouve le bon dossier.|Vous n’avez pas à gérer vous-même les fournisseurs de modèles ou l’infrastructure de génération.", answer: "AIdreamcapes est un studio IA destiné aux clients. Le compte, la facturation, la génération et la galerie sont gérés depuis l’espace du site.", question: "Qui exploite AIdreamcapes ?", bulletList: "Utiliser votre compte pour retrouver l’historique|Conserver les détails de la demande ou de la commande|Ne pas envoyer de photos privées sur un canal public non prévu", linkList: "Contacter l’assistance::/contact-us" },
  faq_publishing: { body: "Avant de publier, vérifiez que chaque personne représentée a autorisé l’usage, qu’aucun logo ou visage protégé n’est présenté de manière trompeuse et que toute mention IA nécessaire est ajoutée.", answer: "Vous pouvez utiliser des créations adaptées pour des profils, publications sociales, pages de créateur, cartes, brouillons de campagne et autres canaux si vous disposez des droits nécessaires et respectez les règles du canal choisi.", question: "Puis-je utiliser des photos IA sur les réseaux, profils ou pages professionnelles ?", bulletList: "Confirmer les autorisations des personnes et des sources|Vérifier les règles de la plateforme et les mentions nécessaires|Contrôler les cadrages, textes, mains et petits détails|Garder des affirmations commerciales exactes", linkList: "Lire les règles de contenu::/content|Consulter les conditions::/terms" },
  faq_privacy: { body: "La confidentialité dépend aussi de la manière dont vous partagez ou téléchargez une création. Utilisez la galerie privée pour vos vérifications, n’importez que des éléments que vous contrôlez et supprimez les contenus lorsque vous n’en avez plus besoin si les outils du compte le permettent.", answer: "Les importations, demandes de génération, albums, commandes et mouvements de crédits sont associés à votre compte connecté et ne sont pas publics par défaut.", question: "Mes photos et données personnelles sont-elles privées ?", bulletList: "Importer uniquement des contenus que vous êtes autorisé à utiliser|Protéger l’accès au compte|Vérifier les options de partage et de téléchargement|Lire la politique de confidentialité pour la conservation et vos droits", linkList: "Lire la politique de confidentialité::/privacy|Consulter les règles de contenu::/content" },
  faq_refunds: { body: "Les crédits utilisés pour un résultat livré ne sont généralement pas remboursables. Une demande échouée ou interrompue peut libérer sa réservation selon son état, tandis que les questions d’abonnement ou de paiement doivent être examinées au regard des conditions applicables.", answer: "L’éligibilité à un remboursement dépend de la politique en vigueur, des conditions de paiement et de l’état de la commande ou de la demande de génération concernée.", question: "Quelle est la politique de remboursement ?", bulletList: "Conserver la référence de la commande ou de la demande|Vérifier si la génération a réussi ou échoué|Contacter rapidement l’assistance en cas de débit ou de livraison incorrecte", linkList: "Lire la politique de remboursement::/refunds|Consulter les conditions d’achat::/terms" }
};

export const AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCKS = {
  review_ava: {
    name: "Ava M.",
    role: "Série de supporters",
    quote: "Je ne pensais pas que les scènes dans le stade seraient aussi convaincantes. La photo de football est devenue ma préférée.",
    rating: "5",
    location: "Série de fans",
    avatarUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-ava-headshot.webp?v=20260919eureviewheadshot1",
    resultImageUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/vendor-20260919/review-ava-theme.webp?v=20260919eureviewvendor1"
  },
  review_lucas: {
    name: "Lucas R.",
    role: "Série professionnelle",
    quote: "J’avais besoin rapidement d’une nouvelle photo de profil. J’ai obtenu plusieurs portraits que je peux vraiment utiliser sur mon profil professionnel et mon site.",
    rating: "5",
    location: "Images de profil",
    avatarUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-lucas-headshot.webp?v=20260919eureviewheadshot1",
    resultImageUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/vendor-20260919/review-lucas-theme.webp?v=20260919eureviewvendor1"
  },
  review_mia: {
    name: "Mia C.",
    role: "Album de Noël",
    quote: "Nous avons créé nos photos de Noël à partir de quelques photos prises avec nos téléphones. Le résultat a dépassé nos attentes et nous en avons choisi une pour notre carte.",
    rating: "5",
    location: "Cartes de fête",
    avatarUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-mia-headshot.webp?v=20260919eureviewheadshot1",
    resultImageUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/vendor-20260919/review-mia-theme.webp?v=20260919eureviewvendor1"
  },
  review_noah: {
    name: "Noé P.",
    role: "Parcours avec crédits",
    quote: "C’est très simple. J’ai importé quelques photos, choisi le style qui me plaisait et tout était disponible dès que la création était prête.",
    rating: "5",
    location: "Galerie privée",
    avatarUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-noah-headshot.webp?v=20260919eureviewheadshot1",
    resultImageUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/vendor-20260919/review-noah-theme.webp?v=20260919eureviewvendor1"
  },
  review_chloe: {
    name: "Chloé S.",
    role: "Contenu de créateur",
    quote: "Je voulais renouveler mes contenus sans refaire toujours la même séance. Certaines images étaient assez réussies pour être publiées dans la semaine.",
    rating: "5",
    location: "Scènes de créateur",
    avatarUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-chloe-headshot.webp?v=20260919eureviewheadshot1",
    resultImageUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/vendor-20260919/review-chloe-theme.webp?v=20260919eureviewvendor1"
  },
  review_eli: {
    name: "Eli T.",
    role: "Crédits transparents",
    quote: "Les portraits professionnels m’ont le plus surpris. Ils me ressemblent, avec un rendu beaucoup plus soigné que mes selfies précédents.",
    rating: "5",
    location: "Portraits et cartes",
    avatarUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-eli-headshot.webp?v=20260919eureviewheadshot1",
    resultImageUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/vendor-20260919/review-eli-theme.webp?v=20260919eureviewvendor1"
  },
  review_jordan: {
    name: "Jordan K.",
    role: "Portraits d’équipe",
    quote: "Nous avions besoin de photos cohérentes pour notre page d’équipe sans organiser une journée complète en studio. Le résultat a demandé beaucoup moins d’efforts.",
    rating: "5",
    location: "Mise à jour de profil",
    avatarUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-jordan-headshot.webp?v=20260919eureviewheadshot1",
    resultImageUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/vendor-20260919/review-jordan-theme.webp?v=20260919eureviewvendor1"
  },
  review_riley: {
    name: "Riley W.",
    role: "Aperçus animés",
    quote: "Je l’ai d’abord essayé pour mes contenus Instagram et j’ai finalement conservé beaucoup plus d’images que prévu. C’est agréable d’avoir de nouvelles idées à publier.",
    rating: "5",
    location: "Contenu social",
    avatarUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-riley-headshot.webp?v=20260919eureviewheadshot1",
    resultImageUrl: "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/vendor-20260919/review-riley-theme.webp?v=20260919eureviewvendor1"
  }
};

const HOMEPAGE_FAQ_BLOCK_IDS = Object.keys(HOME_BLOCK_COPY).filter((id) => id.startsWith("faq_"));
const HOMEPAGE_FAQ_IMAGE_BLOCK_IDS = [
  "faq_about",
  "faq_uploads",
  "faq_couples",
  "faq_photo_generator",
  "faq_video",
  "faq_styling"
];
export const DEFAULT_EU_HOMEPAGE_FAQ_IMAGES = [
  "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/christmas-photo/cover-seasonal-be76f6d3ee.webp?v=aidreamcapes-eu-no-crop-v1",
  "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/christmas-photo/gallery-01-seasonal-0444fe6334.webp?v=aidreamcapes-eu-no-crop-v1",
  "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/christmas-photo/gallery-02-seasonal-a632f6e02c.webp?v=aidreamcapes-eu-no-crop-v1",
  "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/thanksgiving-photo/cover-seasonal-2b3549dc37.webp?v=aidreamcapes-eu-no-crop-v1",
  "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/halloween-photo/cover-seasonal-fd5c22148e.webp?v=aidreamcapes-eu-no-crop-v1",
  "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/holiday/cover-holiday-cover-winter-window.webp?v=aidreamcapes-eu-no-crop-v1"
];

const HEADER_NAV_COPY = {
  global_header_1: "Création photo IA",
  global_header_2: "Création vidéo IA",
  global_header_3: "Meilleurs packs",
  global_header_4: "Comment ça marche",
  global_header_5: "Journal",
  global_header_6: "Tarifs"
};

const HEADER_CARD_COPY = {
  mega_tool_headshot: ["Profil", "Portraits professionnels", "Photo IA", "Créez des portraits nets pour vos CV, équipes et pages de présentation."],
  mega_tool_creator: ["Portrait", "Studio de portraits de créateur", "Photo IA", "Créez de nouveaux portraits pour vos newsletters, pages, miniatures, dossiers média et réseaux sociaux."],
  mega_tool_worldcup: ["Football", "Portraits de supporters", "Photo IA", "Créez des portraits de fans, affiches de match et avatars à partir de vos propres selfies. Usage personnel uniquement."],
  mega_tool_cyberpunk: ["Scène", "Portraits cyberpunk", "Photo IA", "Transformez votre selfie en portrait urbain néon avec une ambiance futuriste et un cadrage de type affiche."],
  mega_tool_gala: ["Style", "Portraits de gala", "Photo IA", "Créez des portraits de soirée avec une lumière éditoriale soignée."],
  mega_tool_noir: ["Noir", "Portraits de personnages", "Photo IA", "Imaginez des personnages cinématographiques inspirés du noir, du polar et des villes vintage."],
  mega_tool_anime: ["Avatar", "Créateur d’avatars illustrés", "Photo IA", "Créez des avatars de profil stylisés pour vos univers sociaux."],
  mega_tool_nature: ["Extérieur", "Photos d’aventure nature", "Photo IA", "Placez votre personnage dans des scènes de randonnée, de sport et de vie en plein air."],
  mega_tool_fashion: ["Éditorial", "Série mode éditoriale", "Photo IA", "Créez des histoires de tenues et des images de marque personnelle au style magazine."],
  mega_tool_product: ["Commerce", "Photos lifestyle de produit", "Photo IA", "Préparez des visuels de produits, de commerce social et de campagnes créatives."],
  mega_edit_background: ["Studio", "Changer l’arrière-plan", "Retouche photo IA", "Remplacez un arrière-plan uni pour obtenir une image personnelle plus claire et plus cohérente."],
  mega_edit_remove_bg: ["Utilitaire", "Supprimer l’arrière-plan", "Retouche photo IA", "Détourez un produit ou un portrait à partir de contenus que vous êtes autorisé à modifier."],
  mega_edit_magic_eraser: ["Utilitaire", "Gomme magique", "Retouche photo IA", "Retirez de petites distractions sur des portraits, cartes et scènes générées."],
  mega_edit_enhancer: ["Studio", "Améliorer une photo", "Retouche photo IA", "Améliorez des importations sombres avant de les utiliser dans un flux privé."],
  mega_edit_retouch: ["Retouche", "Retouche de portrait", "Retouche photo IA", "Nettoyez la peau, les mèches et la lumière sans changer l’identité du sujet."],
  mega_edit_unblur: ["Utilitaire", "Rendre une image plus nette", "Retouche photo IA", "Récupérez des photos de téléphone légèrement floues avant une génération payante."],
  mega_edit_color: ["Couleur", "Correction des couleurs", "Retouche photo IA", "Équilibrez les tons des portraits, affiches et aperçus de packs."],
  mega_edit_restore: ["Restauration", "Restaurer une ancienne photo", "Retouche photo IA", "Réparez des photos de famille passées et préparez-les pour un album privé."],
  mega_edit_prompt: ["Consigne", "Modifier avec une consigne", "Retouche photo IA", "Décrivez une retouche ciblée et prévisualisez-la avant d’utiliser vos crédits."],
  mega_edit_upscale: ["HD", "Agrandir et améliorer", "Retouche photo IA", "Affinez une image générée pour des téléchargements et affichages plus grands."],
  mega_video_image: ["Aperçu", "De l’image à la vidéo", "Création vidéo IA", "Transformez une image de pack terminée en courte idée animée."],
  mega_video_profile: ["Social", "Créer une séquence de profil", "Création vidéo IA", "Créez un mouvement court à partir de portraits ou de photos de profil."],
  mega_video_fan: ["Football", "Animation d’affiche de fan", "Création vidéo IA", "Animez des affiches de supporters et des scènes de profil de jour de match."],
  mega_video_intro: ["Portrait", "Vidéo d’introduction de créateur", "Création vidéo IA", "Transformez des portraits en courtes séquences d’introduction pour profils et reels."],
  mega_video_product: ["Commerce", "Séquence produit", "Création vidéo IA", "Créez des idées de mouvement simples pour des visuels de produit."],
  mega_video_avatar: ["Avatar", "Aperçu d’avatar animé", "Création vidéo IA", "Prévisualisez des concepts animés pour vos campagnes de profil."],
  mega_video_fashion: ["Style", "Départ de reel mode", "Création vidéo IA", "Créez des concepts courts à partir de séries éditoriales et d’idées d’essayage."],
  mega_video_album: ["Album", "Vidéo d’histoire d’album", "Création vidéo IA", "Transformez vos images préférées en une courte histoire d’album."]
};

const FOOTER_LABELS = {
  dreamshoot_footer_product_1: "Création photo IA",
  dreamshoot_footer_product_2: "Création vidéo IA",
  dreamshoot_footer_product_3: "Meilleurs packs",
  dreamshoot_footer_company_6: "Journal",
  dreamshoot_footer_company_7: "À propos",
  dreamshoot_footer_company_8: "Nous contacter",
  dreamshoot_footer_company_9: "Cercle des créateurs",
  dreamshoot_footer_company_10: "Politique de remboursement",
  dreamshoot_footer_support_11: "Politique de confidentialité",
  dreamshoot_footer_support_12: "Règles de contenu",
  dreamshoot_footer_support_13: "Conditions d’utilisation",
  dreamshoot_footer_support_14: "Politique relative aux cookies"
};

const FOOTER_HREF_LABELS = {
  "/ai-image-generation": "Création photo IA",
  "/best-ai-image": "Meilleures créations photo",
  "/best-ai-video": "Meilleures créations vidéo",
  "/ai-video-generation": "Création vidéo IA",
  "/best-packages": "Meilleurs packs",
  "/workflow": "Comment ça marche",
  "/pricing": "Tarifs",
  "/privacy": "Politique de confidentialité",
  "/terms": "Conditions d’utilisation",
  "/cookies": "Politique relative aux cookies",
  "/content": "Règles de contenu",
  "/help": "Centre d’aide",
  "/about-us": "À propos",
  "/contact-us": "Nous contacter",
  "/creators-circle": "Cercle des créateurs",
  "/blog": "Journal",
  "/children-privacy": "Confidentialité des mineurs",
  "/state-privacy": "Confidentialité régionale"
};

const SAVE_DATE_LABELS = {
  "valentines-day": "Saint-Valentin",
  engagement: "Fiançailles",
  proposal: "Demande en mariage",
  "save-the-date": "Annonce de date",
  "wedding-invitation": "Invitation de mariage",
  "wedding-ceremony": "Cérémonie de mariage",
  christmas: "Noël",
  halloween: "Halloween",
  thanksgiving: "Action de grâce",
  "new-year": "Nouvel An",
  "mothers-day": "Fête des mères",
  "fathers-day": "Fête des pères"
};

function setValues(target, values) {
  if (!target || typeof target !== "object" || Array.isArray(target)) return;
  Object.assign(target, values);
}

function normalizeImageList(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split("|") : [];
  return [...new Set(values.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
}

function restoreHomepageReviewContent(proofSection) {
  if (!proofSection || typeof proofSection !== "object") return;
  const currentBlocks = Array.isArray(proofSection.blocks) ? proofSection.blocks : [];
  const currentById = new Map(currentBlocks.filter((block) => block?.id).map((block) => [block.id, block]));
  const restoredBlocks = AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCK_IDS.map((blockId) => {
    const existing = currentById.get(blockId);
    const block = existing
      ? { ...existing, type: "testimonial", settings: { ...(existing.settings ?? {}) } }
      : { id: blockId, type: "testimonial", settings: {} };
    setValues(block.settings, AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCKS[blockId]);
    return block;
  });
  const canonicalReviewIds = new Set(AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCK_IDS);
  const preservedBlocks = currentBlocks.filter((block) => {
    const id = String(block?.id ?? "");
    return !canonicalReviewIds.has(id) && !/^review_/i.test(id);
  });
  proofSection.type = "testimonial_wall";
  proofSection.blocks = [...restoredBlocks, ...preservedBlocks];
  proofSection.settings = { ...(proofSection.settings ?? {}) };
}

function restoreHomepageFaqContent(faqSection, options = {}) {
  if (!faqSection || typeof faqSection !== "object") return;
  const currentBlocks = Array.isArray(faqSection.blocks) ? faqSection.blocks : [];
  const currentById = new Map(currentBlocks.filter((block) => block?.id).map((block) => [block.id, block]));
  const currentImageList = normalizeImageList(faqSection.settings?.imageList);
  const optionImageList = normalizeImageList(options.faqImages);
  const noCropOptionImageList = optionImageList.filter((image) => image.includes("/restored/originals/aidreamcapes-eu-no-crop-v1/"));
  const noCropCurrentImageList = currentImageList.filter((image) => image.includes("/restored/originals/aidreamcapes-eu-no-crop-v1/"));
  const imageList = (noCropOptionImageList.length >= HOMEPAGE_FAQ_IMAGE_BLOCK_IDS.length
    ? noCropOptionImageList
    : noCropCurrentImageList.length >= HOMEPAGE_FAQ_IMAGE_BLOCK_IDS.length
      ? noCropCurrentImageList
      : DEFAULT_EU_HOMEPAGE_FAQ_IMAGES).slice(0, 12);

  let imageIndex = 0;
  const restoredBlocks = HOMEPAGE_FAQ_BLOCK_IDS.map((blockId) => {
    const existing = currentById.get(blockId);
    const block = existing
      ? { ...existing, settings: { ...(existing.settings ?? {}) } }
      : { id: blockId, settings: {} };
    setValues(block.settings, HOME_BLOCK_COPY[blockId]);
    if (HOMEPAGE_FAQ_IMAGE_BLOCK_IDS.includes(blockId)) {
      block.settings.imageUrl = imageList[imageIndex % imageList.length];
      imageIndex += 1;
    }
    return block;
  });
  const preservedBlocks = currentBlocks.filter((block) => {
    const id = String(block?.id ?? "");
    return !HOMEPAGE_FAQ_BLOCK_IDS.includes(id) && !/^home_faq_\d+$/.test(id);
  });
  faqSection.blocks = [...restoredBlocks, ...preservedBlocks];
  faqSection.settings = { ...(faqSection.settings ?? {}) };
  faqSection.settings.imageUrl = imageList[0];
  faqSection.settings.imageList = imageList.join("|");
}

function removeAidreamcapesEuExcludedFooterLinks(footer) {
  if (!footer || !Array.isArray(footer.blocks)) return;
  footer.blocks = footer.blocks.filter((block) => {
    const href = String(block?.settings?.href ?? "").split(/[?#]/)[0];
    return !AIDREAMCAPES_EU_EXCLUDED_FOOTER_HREFS.has(href);
  });
}

function applySectionCopy(pageJson, options = {}) {
  if (!pageJson || typeof pageJson !== "object") return pageJson;
  const sections = pageJson.sections;
  if (!sections || typeof sections !== "object") return pageJson;
  restoreHomepageReviewContent(sections.proof_1);
  restoreHomepageFaqContent(sections.faq_1, options);
  for (const [sectionId, values] of Object.entries(HOME_SECTION_COPY)) {
    setValues(sections[sectionId]?.settings, values);
  }
  for (const [blockId, values] of Object.entries(HOME_BLOCK_COPY)) {
    for (const section of Object.values(sections)) {
      const block = Array.isArray(section?.blocks) ? section.blocks.find((candidate) => candidate?.id === blockId) : null;
      if (block) setValues(block.settings, values);
    }
  }
  pageJson.seo = {
    ...(pageJson.seo ?? {}),
    ...HOME_SEO,
    canonicalPath: "/",
    index: true,
    follow: true,
    robots: { ...(pageJson.seo?.robots ?? {}), index: true, follow: true }
  };
  return pageJson;
}

export function applyAidreamcapesEuHomepageCopy(pageJson, options = {}) {
  return applySectionCopy(pageJson, options);
}

export function applyAidreamcapesEuThemeHomepageCopy(templates, options = {}) {
  if (!templates || typeof templates !== "object") return templates;
  for (const key of ["index", "home", "/"]) {
    if (templates[key]) applySectionCopy(templates[key], options);
  }
  if (templates.sections) applySectionCopy(templates, options);
  return templates;
}

const PRODUCT_COPY = {
  starter: {
    summary: "Une formule simple pour vos premiers albums privés et vos séries de portraits.",
    badgeLabel: "Formule photo",
    features: [
      "Albums photo privés après la génération",
      "Éditeur photo IA avec consignes",
      "Filtres photo IA créatifs",
      "Créer des photos en quelques secondes avec une consigne",
      "Créer des vidéos IA",
      "Amélioration haute résolution pour les images",
      "Sans filigrane"
    ]
  },
  pro: {
    summary: "Davantage de crédits pour plusieurs albums, retouches et essais de style.",
    badgeLabel: "Le plus populaire",
    features: [
      "Albums photo privés après la génération",
      "Éditeur photo IA avec consignes",
      "Filtres photo IA créatifs",
      "Créer des photos en quelques secondes avec une consigne",
      "Créer des vidéos IA",
      "Amélioration haute résolution pour les images",
      "Sans filigrane"
    ]
  },
  premium: {
    summary: "La formule avec le plus de crédits pour les albums récurrents, les idées vidéo et les résultats premium.",
    badgeLabel: "Meilleure valeur",
    features: [
      "Albums photo privés après la génération",
      "Éditeur photo IA avec consignes",
      "Filtres photo IA créatifs",
      "Créer des photos en quelques secondes avec une consigne",
      "Créer des vidéos IA",
      "Amélioration haute résolution pour les images",
      "Sans filigrane",
      "Résultats 4K haute résolution"
    ]
  }
};

function localizedProductName(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const labels = {
    "medium credit pack": "Recharge moyenne de crédits",
    "medium crédit pack": "Recharge moyenne de crédits",
    "small credit pack": "Petite recharge de crédits",
    "small crédit pack": "Petite recharge de crédits",
    "large credit pack": "Grande recharge de crédits",
    "large crédit pack": "Grande recharge de crédits",
    "one-shot trial": "Essai ponctuel"
  };
  return labels[normalized] ?? value;
}

function localizedPriceLabel(value) {
  return String(value ?? "")
    .replace(/\bsemiannual\b/gi, "semestriel")
    .replace(/\bquarterly\b/gi, "trimestriel")
    .replace(/\bmonthly\b/gi, "mensuel")
    .replace(/\bcredit pack\b/gi, "recharge de crédits")
    .replace(/\bcrédit pack\b/gi, "recharge de crédits")
    .replace(/\bcredits\b/gi, "crédits")
    .replace(/\bcreditos\b/gi, "crédits");
}

export function applyAidreamcapesEuProductCopy(products, prices) {
  for (const product of products ?? []) {
    const planCopy = PRODUCT_COPY[String(product.name ?? "").trim().toLowerCase()];
    product.name = localizedProductName(product.name);
    if (planCopy) {
      product.metadata = { ...(product.metadata ?? {}), ...planCopy };
      for (const price of prices ?? []) {
        if (price.productId !== product.id) continue;
        price.label = localizedPriceLabel(price.label);
        price.metadata = {
          ...(price.metadata ?? {}),
          planSubtitle: planCopy.summary,
          ...(price.metadata?.discountLabel === "30% off" ? { discountLabel: "30 % de remise" } : {}),
          ...(price.metadata?.discountLabel === "Quarterly savings" ? { discountLabel: "Économie trimestrielle" } : {}),
          ...(price.metadata?.discountLabel === "Semiannual savings" ? { discountLabel: "Économie semestrielle" } : {}),
          ...(price.metadata?.editingLabel === "Standard editing" ? { editingLabel: "Retouche standard" } : {}),
          ...(price.metadata?.editingLabel === "Advanced editing" ? { editingLabel: "Retouche avancée" } : {}),
          ...(price.metadata?.editingLabel === "Premium editing et retouching" ? { editingLabel: "Retouche et finition premium" } : {}),
          ...(price.metadata?.billingCadence === "quarterly" ? { billingCadence: "trimestriel" } : {}),
          ...(price.metadata?.billingCadence === "semiannually" ? { billingCadence: "semestriel" } : {})
        };
      }
    }
  }
  return { products, prices };
}

function applySaasSectionsCopy(current, { logoUrl, supportEmail } = {}) {
  if (!current || typeof current !== "object") return current;
  const sections = current.sections;
  if (!sections || typeof sections !== "object") return current;
  const header = sections.header_plus;
  if (header) {
    header.card_name = "En-tête AIdreamcapes";
    setValues(header.settings ?? (header.settings = {}), {
      title: "AIdreamcapes",
      logoAlt: "Logo AIdreamcapes pour la création de photos et vidéos IA",
      logoImageUrl: logoUrl ?? header.settings?.logoImageUrl,
      ctaHref: "/app/create",
      ctaLabel: "Commencer à créer",
      mobileLabel: "Menu",
      announce_title: "Transformez vos photos en portraits, séries photo et vidéos IA dans un espace privé.",
      announce_bg_color: header.settings?.announce_bg_color ?? "#05070E",
      is_announce_show: true
    });
    for (const block of header.blocks ?? []) {
      if (HEADER_NAV_COPY[block.id]) setValues(block.settings, { label: HEADER_NAV_COPY[block.id] });
      const copy = HEADER_CARD_COPY[block.id];
      if (copy) setValues(block.settings, { badge: copy[0], title: copy[1], category: copy[2], description: copy[3] });
    }
  }
  const footer = sections.footer_plus;
  if (footer) {
    removeAidreamcapesEuExcludedFooterLinks(footer);
    footer.card_name = "Pied de page AIdreamcapes";
    setValues(footer.settings ?? (footer.settings = {}), {
      title: "AIdreamcapes",
      logoAlt: "Logo AIdreamcapes pour la création de photos et vidéos IA",
      logoImageUrl: logoUrl ?? footer.settings?.logoImageUrl,
      companyName: "AIdreamcapes.eu",
      contactEmail: supportEmail ?? footer.settings?.contactEmail,
      body: "Importez vos photos, choisissez un flux photo ou vidéo, vérifiez le coût en crédits et téléchargez vos créations privées.",
      tagline: "Vidéos IA, portraits, séries photo et albums privés avec un coût en crédits clairement indiqué",
      bottomLine: "Les crédits, projets photo et vidéo IA, albums privés et paiements restent dans votre compte.",
      socialBody: "AIdreamcapes vous aide à créer des vidéos, portraits, images de profil et albums thématiques à partir de vos propres photos.",
      socialHeading: "Pourquoi ça marche",
      companyHeading: "AIdreamcapes",
      productHeading: "Découvrir",
      supportHeading: "Assistance",
      copyright: "© 2026 AIdreamcapes.eu. Tous droits réservés."
    });
    for (const block of footer.blocks ?? []) {
      const href = String(block.settings?.href ?? "").split("?")[0];
      const label = FOOTER_LABELS[block.id] ?? FOOTER_HREF_LABELS[href];
      if (label) setValues(block.settings, { label });
    }
  }
  return current;
}

export function applyAidreamcapesEuThemeSettingsCopy(settings, options = {}) {
  if (!settings || typeof settings !== "object") return settings;
  if (settings.settings_data?.current) applySaasSectionsCopy(settings.settings_data.current, options);
  if (settings.saasSettingsCurrent) applySaasSectionsCopy(settings.saasSettingsCurrent, options);
  return settings;
}

export function applyAidreamcapesEuGlobalCopy(settings) {
  if (!settings || typeof settings !== "object") return settings;
  const global = settings.globalSections ?? {};
  const header = global.header ?? (global.header = { type: "header", settings: {}, blocks: [] });
  const footer = global.footer ?? (global.footer = { type: "footer", settings: {}, blocks: [] });
  removeAidreamcapesEuExcludedFooterLinks(footer);
  setValues(header.settings ?? (header.settings = {}), {
    title: "AIdreamcapes",
    logoAlt: "Logo AIdreamcapes pour la création de photos et vidéos IA",
    ctaLabel: "Commencer à créer",
    mobileLabel: "Menu"
  });
  for (const block of header.blocks ?? []) {
    if (HEADER_NAV_COPY[block.id]) setValues(block.settings, { label: HEADER_NAV_COPY[block.id] });
    const copy = HEADER_CARD_COPY[block.id];
    if (copy) setValues(block.settings, { badge: copy[0], title: copy[1], category: copy[2], description: copy[3] });
  }
  setValues(footer.settings ?? (footer.settings = {}), {
    title: "AIdreamcapes",
    logoAlt: "Logo AIdreamcapes pour la création de photos et vidéos IA",
    companyName: "AIdreamcapes.eu",
    body: "Importez vos photos, choisissez un flux photo ou vidéo, vérifiez le coût en crédits et téléchargez vos créations privées.",
    tagline: "Vidéos IA, portraits, séries photo et albums privés avec un coût en crédits clairement indiqué",
    bottomLine: "Les crédits, projets photo et vidéo IA, albums privés et paiements restent dans votre compte.",
    socialBody: "AIdreamcapes vous aide à créer des vidéos, portraits, images de profil et albums thématiques à partir de vos propres photos.",
    socialHeading: "Pourquoi ça marche",
    companyHeading: "AIdreamcapes",
    productHeading: "Découvrir",
    supportHeading: "Assistance",
    copyright: "© 2026 AIdreamcapes.eu. Tous droits réservés."
  });
  for (const block of footer.blocks ?? []) if (FOOTER_LABELS[block.id]) setValues(block.settings, { label: FOOTER_LABELS[block.id] });
  settings.seo ??= {};
  settings.seo.pages ??= {};
  settings.seo.pages.site_aidreamcapes_xby_home = {
    ...(settings.seo.pages.site_aidreamcapes_xby_home ?? {}),
    ...HOME_SEO,
    canonicalPath: "/",
    index: true,
    follow: true,
    robots: { index: true, follow: true }
  };
  delete settings.seo.pages.site_dreamshoot_home;
  if (settings.saveTheDateNavigation && typeof settings.saveTheDateNavigation === "object") {
    settings.saveTheDateNavigation.menuLabel = "Annonces Save the Date";
    for (const group of settings.saveTheDateNavigation.groups ?? []) {
      group.label = group.slug === "love-wedding" ? "Amour et mariage" : group.slug === "seasonal-holidays" ? "Fêtes saisonnières" : group.label;
      for (const item of group.items ?? []) if (SAVE_DATE_LABELS[item.slug]) item.label = SAVE_DATE_LABELS[item.slug];
    }
  }
  applySaasSectionsCopy(settings.saasSettingsCurrent, { logoUrl: header.settings.logoImageUrl, supportEmail: footer.settings.contactEmail });
  return settings;
}

export { HOME_SEO };
