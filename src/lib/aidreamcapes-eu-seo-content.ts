export type AidreamcapesEuSeoSeed = {
  label: string;
  title: string;
  description: string;
  keywords: string;
  h2: string;
  subject: string;
  scene: string;
};

type AidreamcapesEuSeoContent = Omit<AidreamcapesEuSeoSeed, "subject" | "scene"> & {
  slug: string;
  explicit: true;
  canonicalPath: string;
  h3: string[];
  intro: string;
  details: string[];
  useCases: string[];
  workflow: string[];
  internalLinks: Array<{ label: string; href: string }>;
  ctaLabel: string;
  ctaHref: string;
  faqItems: Array<[string, string]>;
};

export type AidreamcapesEuRouteSeo = {
  title: string;
  description: string;
};

const SAVE_THE_DATE_SEO: Record<string, AidreamcapesEuRouteSeo> = {
  "/ai-save-the-date/save-the-date": { title: "Vidéo d’annonce de date avec l’IA | Aidreamcapes", description: "Créez une vidéo d’annonce de date avec l’IA à partir de vos photos de couple et partagez un message clair avec vos proches." },
  "/ai-save-the-date/wedding-invitation": { title: "Vidéo d’invitation de mariage avec l’IA | Aidreamcapes", description: "Créez une vidéo d’invitation de mariage avec l’IA à partir de vos photos, de la date et des détails de votre cérémonie." },
  "/ai-save-the-date/valentines-day": { title: "Vidéo de Saint-Valentin avec l’IA | Aidreamcapes", description: "Créez une vidéo romantique de Saint-Valentin avec l’IA à partir de vos photos de couple et partagez-la avec la personne aimée." },
  "/ai-save-the-date/engagement": { title: "Vidéo d’annonce de fiançailles avec l’IA | Aidreamcapes", description: "Créez une vidéo d’annonce de fiançailles avec l’IA à partir de vos photos de couple et préparez un message personnel à partager." },
  "/ai-save-the-date/proposal": { title: "Vidéo de demande en mariage avec l’IA | Aidreamcapes", description: "Créez une vidéo de demande en mariage avec l’IA à partir de vos photos et composez une annonce personnelle et mémorable." },
  "/ai-save-the-date/christmas": { title: "Vidéo de Noël avec l’IA | Aidreamcapes", description: "Créez une vidéo de Noël avec l’IA à partir de vos photos et partagez vos vœux dans une ambiance chaleureuse et festive." },
  "/ai-save-the-date/thanksgiving": { title: "Vidéo de Thanksgiving avec l’IA | Aidreamcapes", description: "Créez une vidéo de Thanksgiving avec l’IA à partir de vos photos et partagez un message chaleureux avec vos proches." },
  "/ai-save-the-date/new-year": { title: "Vidéo du Nouvel An avec l’IA | Aidreamcapes", description: "Créez une vidéo du Nouvel An avec l’IA à partir de vos photos et envoyez vos vœux dans un format personnel et élégant." },
  "/ai-save-the-date/mothers-day": { title: "Vidéo de fête des Mères avec l’IA | Aidreamcapes", description: "Créez une vidéo de fête des Mères avec l’IA à partir de vos photos et préparez un message touchant à partager." },
  "/ai-save-the-date/fathers-day": { title: "Vidéo de fête des Pères avec l’IA | Aidreamcapes", description: "Créez une vidéo de fête des Pères avec l’IA à partir de vos photos et partagez un message personnel avec votre famille." },
  "/ai-save-the-date/halloween": { title: "Vidéo d’Halloween avec l’IA | Aidreamcapes", description: "Créez une vidéo d’Halloween avec l’IA à partir de vos photos et partagez une annonce originale dans une ambiance de fête." },
  "/ai-save-the-date/wedding-ceremony": { title: "Vidéo de cérémonie de mariage avec l’IA | Aidreamcapes", description: "Créez une vidéo de cérémonie de mariage avec l’IA à partir de vos photos et préparez un message élégant pour vos invités." },
  "/ai-save-the-date/wedding-anniversary": { title: "Vidéo d’anniversaire de mariage avec l’IA | Aidreamcapes", description: "Créez une vidéo d’anniversaire de mariage avec l’IA à partir de vos photos et célébrez votre histoire avec vos proches." },
  "/ai-save-the-date/easter": { title: "Vidéo de Pâques avec l’IA | Aidreamcapes", description: "Créez une vidéo de Pâques avec l’IA à partir de vos photos et partagez un message lumineux pour cette célébration." }
};

const SEEDS: Record<string, AidreamcapesEuSeoSeed> = {
  avatar: {
    label: "Avatar professionnel",
    title: "Avatar professionnel IA | Aidreamcapes",
    description: "Créez un avatar professionnel avec l’IA : portrait naturel, style éditorial et cadrage adapté aux profils, communautés et projets personnels sur Aidreamcapes.",
    keywords: "avatar IA, portrait professionnel, photo de profil IA, avatar réaliste, Aidreamcapes",
    h2: "Avatar professionnel créé avec l’IA",
    subject: "un avatar adulte réaliste pour profil professionnel ou communauté",
    scene: "studio graphique aux formes douces, expression directe et cadrage tête-épaules"
  },
  "background-changer": {
    label: "Changer l’arrière-plan",
    title: "Changer l’arrière-plan avec l’IA | Aidreamcapes",
    description: "Remplacez l’arrière-plan d’un portrait ou d’un produit avec l’IA en conservant une lumière, une perspective et des contours naturels dans votre image finale.",
    keywords: "changer arrière-plan IA, remplacement de fond, retouche photo IA, arrière-plan portrait, Aidreamcapes",
    h2: "Changer l’arrière-plan d’une image",
    subject: "un sujet adulte ou un objet intégré naturellement dans un nouvel environnement",
    scene: "bibliothèque, serre, café, toit urbain ou plage selon l’intention visuelle"
  },
  "background-remover": {
    label: "Suppression d’arrière-plan",
    title: "Supprimer un fond avec l’IA | Aidreamcapes",
    description: "Supprimez l’arrière-plan d’un portrait, d’un produit ou d’un objet avec une silhouette nette, des contours propres et une présentation prête pour votre projet.",
    keywords: "supprimer arrière-plan IA, détourage photo, fond transparent, détourage produit, Aidreamcapes",
    h2: "Supprimer un arrière-plan proprement",
    subject: "un portrait adulte, un accessoire ou un produit détouré avec précision",
    scene: "fond neutre de studio avec séparation claire du sujet et de sa silhouette"
  },
  bikini: {
    label: "Bikini éditorial",
    title: "Photos de bikini IA : plage et vacances | Aidreamcapes",
    description: "Créez des photos de bikini adultes dans un style mode et vacances : plage, piscine, côte et bien-être, avec des poses naturelles et non explicites.",
    keywords: "photos bikini IA, photo plage adulte, mode balnéaire IA, portrait vacances, Aidreamcapes",
    h2: "Bikini éditorial pour plage et vacances",
    subject: "un adulte en tenue balnéaire dans un contexte de mode, de plage ou de bien-être",
    scene: "plage corallienne, piscine d’hôtel, promenade maritime ou terrasse face à la mer"
  },
  "black-friday": {
    label: "Vendredi noir",
    title: "Images du Vendredi noir créées avec l’IA | Aidreamcapes",
    description: "Préparez des visuels du Vendredi noir avec l’IA : portraits de campagne, produits et compositions commerciales variées pour bannières, réseaux sociaux et annonces.",
    keywords: "images du Vendredi noir IA, visuel promotionnel, photo campagne commerciale, bannière e-commerce, Aidreamcapes",
    h2: "Visuels du Vendredi noir pour campagne commerciale",
    subject: "un visuel adulte ou produit conçu pour une campagne promotionnelle sans texte intégré",
    scene: "studio blanc, vitrine sombre, table de produit ou décor de campagne aux contrastes nets"
  },
  boudoir: {
    label: "Boudoir éditorial",
    title: "Photos boudoir adultes avec l’IA | Aidreamcapes",
    description: "Créez des portraits boudoir adultes à l’éclairage doux : matières satinées, intérieur intime et poses élégantes, dans une direction artistique non explicite.",
    keywords: "photo boudoir IA, portrait intime adulte, style satin, lumière intérieure, Aidreamcapes",
    h2: "Boudoir éditorial à lumière douce",
    subject: "un adulte dans un portrait intime, élégant et non explicite",
    scene: "chambre d’hôtel, rideau en lin, fauteuil velours ou lumière matinale près d’une fenêtre"
  },
  cannes: {
    label: "Cannes et Riviera",
    title: "Photos de Cannes et de la Riviera avec l’IA | Aidreamcapes",
    description: "Imaginez des portraits IA inspirés de Cannes et de la Riviera : tapis rouge, Croisette, lumière méditerranéenne et élégance de festival sans logos visibles.",
    keywords: "photos Cannes IA, portrait Riviera, tapis rouge IA, festival cinéma, Aidreamcapes",
    h2: "Portraits de Cannes et de la Riviera",
    subject: "un adulte dans une scène élégante inspirée de Cannes et de la Côte d’Azur",
    scene: "Croisette au coucher du soleil, hôtel Art déco, port méditerranéen ou escalier de festival"
  },
  "christmas-photo": {
    label: "Photos de Noël",
    title: "Photos de Noël avec l’IA | Aidreamcapes",
    description: "Créez des photos de Noël avec l’IA pour cartes, vœux et albums privés : intérieurs chaleureux, scènes d’hiver et détails festifs aux styles variés.",
    keywords: "photos de Noël IA, portrait de Noël, carte de vœux photo, album de fêtes, Aidreamcapes",
    h2: "Photos de Noël pour cartes et souvenirs",
    subject: "un adulte ou un petit groupe d’adultes dans une scène de Noël chaleureuse",
    scene: "salon éclairé par le sapin, marché d’hiver, cuisine festive ou promenade enneigée"
  },
  "color-correction": {
    label: "Correction des couleurs",
    title: "Correction des couleurs photo avec l’IA | Aidreamcapes",
    description: "Rééquilibrez les couleurs d’une photo avec l’IA : tons de peau naturels, contraste maîtrisé et ambiance cohérente pour portraits, voyages et scènes urbaines.",
    keywords: "correction couleurs IA, étalonnage photo, améliorer couleurs photo, tons de peau, Aidreamcapes",
    h2: "Correction colorimétrique naturelle",
    subject: "une photo adulte, de voyage ou d’intérieur dont la palette doit retrouver son équilibre",
    scene: "portrait près d’une fenêtre, rue colorée, paysage de lac ou intérieur aux matières visibles"
  },
  cyberpunk: {
    label: "Cyberpunk",
    title: "Portrait cyberpunk avec l’IA | Aidreamcapes",
    description: "Créez des portraits cyberpunk avec l’IA : néons, pluie, architecture futuriste et ambiance nocturne pour des images originales, lisibles et cinématographiques.",
    keywords: "portrait cyberpunk IA, photo néon, ville futuriste, portrait nocturne, Aidreamcapes",
    h2: "Portrait cyberpunk dans une ville néon",
    subject: "un adulte dans un portrait futuriste aux détails urbains reconnaissables",
    scene: "ruelle sous la pluie, passerelle vitrée, métro nocturne ou toit entre enseignes abstraites"
  },
  "edit-by-prompt": {
    label: "Modifier avec une consigne",
    title: "Modifier une photo avec une consigne IA | Aidreamcapes",
    description: "Transformez une photo avec une consigne créative : changez un décor, une tenue, une lumière ou un objet tout en gardant une géométrie et une scène cohérentes.",
    keywords: "modifier photo avec IA, édition par consigne, retouche générative, transformation photo, Aidreamcapes",
    h2: "Modifier une image avec une consigne claire",
    subject: "un adulte, un objet ou un décor transformé par une instruction visuelle précise",
    scene: "jardin botanique, atelier, terrasse côtière, musée ou rue pluvieuse selon la consigne"
  },
  "estilo-y-fantasia": {
    label: "Style et fantasy",
    title: "Photos style et fantasy avec l’IA | Aidreamcapes",
    description: "Créez des photos style et fantasy avec l’IA : portraits de voyage, univers cinématographiques et décors imaginaires pour vos projets créatifs privés.",
    keywords: "photo style fantasy IA, portrait cinématographique, décor imaginaire, photo voyage créative, Aidreamcapes",
    h2: "Photos style et fantasy pour projets créatifs",
    subject: "un adulte dans un portrait créatif où le style, le décor et l’expression restent lisibles",
    scene: "ville futuriste, forêt brumeuse, côte lumineuse, galerie contemporaine ou décor de voyage imaginaire"
  },
  "engagement-photo": {
    label: "Photos de fiançailles",
    title: "Photos de fiançailles IA : couple et annonce | Aidreamcapes",
    description: "Créez des photos de fiançailles avec l’IA pour annonce, séance de couple ou souvenir : gestes naturels, lieux romantiques et styles éditoriaux variés.",
    keywords: "photos de fiançailles IA, photo couple, annonce engagement, portrait romantique, Aidreamcapes",
    h2: "Photos de fiançailles pour couple et annonce",
    subject: "un couple adulte dans un moment de fiançailles tendre et clairement identifiable",
    scene: "lac au coucher du soleil, jardin fleuri, rue historique ou terrasse méditerranéenne"
  },
  "gala-photo": {
    label: "Photos de gala",
    title: "Photos de gala et tapis rouge avec l’IA | Aidreamcapes",
    description: "Créez des portraits de gala avec l’IA : tenue de soirée, escaliers éclairés, réception et tapis rouge pour des images élégantes sans événement réel suggéré.",
    keywords: "photos de gala IA, portrait tapis rouge, tenue de soirée, portrait événementiel, Aidreamcapes",
    h2: "Portraits de gala et de tapis rouge",
    subject: "un adulte en tenue de soirée dans une scène de gala éditoriale",
    scene: "escalier de théâtre, foyer Art déco, arrivée sur tapis rouge ou salle de réception"
  },
  "hairstyle-generator": {
    label: "Générateur de coiffure",
    title: "Générateur de coiffure IA : coupe et couleur | Aidreamcapes",
    description: "Testez des idées de coiffure avec l’IA : coupe, longueur, frange, couleur et texture dans des portraits de salon variés avant de changer de style.",
    keywords: "générateur coiffure IA, essayer coupe, couleur cheveux IA, idée coiffure, Aidreamcapes",
    h2: "Tester une coupe ou une couleur de cheveux",
    subject: "un adulte dont la coupe, la longueur et la texture des cheveux sont clairement visibles",
    scene: "salon lumineux, studio corail, miroir abstrait, terrasse côtière ou café chaleureux"
  },
  "halloween-photo": {
    label: "Photos d’Halloween",
    title: "Photos d’Halloween adultes avec l’IA | Aidreamcapes",
    description: "Créez des photos d’Halloween adultes avec l’IA : costumes originaux, fête, maquillage créatif et scènes mystérieuses sans gore, violence ni sujet mineur.",
    keywords: "photos Halloween IA, portrait costume adulte, fête Halloween, maquillage créatif, Aidreamcapes",
    h2: "Photos d’Halloween avec costumes originaux",
    subject: "un adulte costumé dans une scène d’Halloween ludique et légèrement mystérieuse",
    scene: "bal masqué, ruelle brumeuse, maison décorée, théâtre abandonné ou fête aux lumières violettes"
  },
  headshot: {
    label: "Portrait professionnel",
    title: "Portrait professionnel IA pour LinkedIn et CV | Aidreamcapes",
    description: "Créez un portrait professionnel avec l’IA pour LinkedIn, CV, équipe ou profil d’entreprise : lumière maîtrisée, expression naturelle et cadrages crédibles.",
    keywords: "portrait professionnel IA, photo LinkedIn, photo CV, headshot entreprise, Aidreamcapes",
    h2: "Portrait professionnel pour profil et équipe",
    subject: "un adulte en portrait professionnel avec visage, regard et tenue clairement lisibles",
    scene: "bureau d’architecte, studio neutre, bibliothèque, hall contemporain ou extérieur urbain"
  },
  holiday: {
    label: "Fêtes et saisons",
    title: "Photos de fêtes et de saisons avec l’IA | Aidreamcapes",
    description: "Créez des photos de fêtes et de saisons avec l’IA : hiver, printemps, célébrations et portraits d’ambiance pour cartes, profils et albums privés.",
    keywords: "photos fêtes saisons IA, portrait saisonnier, image de célébration, album privé, Aidreamcapes",
    h2: "Photos de fêtes et de saisons",
    subject: "un adulte dans une célébration saisonnière avec une ambiance immédiatement lisible",
    scene: "marché d’hiver, jardin printanier, terrasse d’été ou table d’automne en extérieur"
  },
  mafia: {
    label: "Noir mafieux",
    title: "Portraits noir mafieux avec l’IA | Aidreamcapes",
    description: "Imaginez des portraits noir mafieux avec l’IA : costumes, diners rétro, lumière contrastée et ambiance cinéma, sans glorifier la violence ni utiliser de marque.",
    keywords: "portrait mafia IA, style noir cinéma, costume rétro, portrait dramatique, Aidreamcapes",
    h2: "Portrait noir mafieux d’inspiration cinéma",
    subject: "un adulte en costume dans une scène noire rétro inspirée du cinéma",
    scene: "diner des années 1940, bureau sombre, club de jazz ou rue mouillée aux lampadaires"
  },
  "magic-eraser": {
    label: "Gomme magique",
    title: "Gomme magique IA pour effacer un élément | Aidreamcapes",
    description: "Effacez un élément indésirable avec la gomme magique IA : la texture, la perspective et la continuité du décor restent naturelles dans la photo retouchée.",
    keywords: "gomme magique IA, effacer objet photo, retouche photo, supprimer élément, Aidreamcapes",
    h2: "Effacer un élément sans trace visible",
    subject: "une photo du quotidien où un objet ou un détail doit disparaître proprement",
    scene: "rue pavée, cuisine, plage, bureau ou parc avec surfaces et perspectives détaillées"
  },
  "motion-generator": {
    label: "Générateur de mouvement",
    title: "Animation photo avec l’IA | Aidreamcapes",
    description: "Créez des photos de mouvement avec l’IA : danse, sport et gestes spontanés, avec une anatomie lisible et une énergie visuelle variée.",
    keywords: "générateur mouvement IA, photo dynamique, portrait sportif, photo danse, Aidreamcapes",
    h2: "Photos dynamiques de mouvement",
    subject: "un adulte en action avec un geste, une trajectoire et une anatomie clairement lisibles",
    scene: "théâtre vide, plage au lever du jour, toit urbain, salle de sport ou escalier en béton"
  },
  nightlife: {
    label: "Vie nocturne",
    title: "Photos de vie nocturne avec l’IA | Aidreamcapes",
    description: "Créez des portraits de vie nocturne avec l’IA : clubs, concerts, rues éclairées et rencontres urbaines dans des ambiances colorées, naturelles et variées.",
    keywords: "photo vie nocturne IA, portrait soirée, club photo, portrait urbain nuit, Aidreamcapes",
    h2: "Portraits de vie nocturne",
    subject: "un adulte dans un portrait de nuit avec une atmosphère urbaine ou musicale",
    scene: "club de jazz, concert intimiste, bar à cocktails, rue sous la pluie ou rooftop illuminé"
  },
  "old-photo-restoration": {
    label: "Restauration de photos anciennes",
    title: "Restauration de photos anciennes avec l’IA | Aidreamcapes",
    description: "Restaurez une photo ancienne avec l’IA en récupérant les détails et les contrastes tout en conservant le grain, le papier et la tonalité de l’époque.",
    keywords: "restauration photo ancienne IA, réparer vieille photo, coloriser photo, archive familiale, Aidreamcapes",
    h2: "Restauration fidèle de photo ancienne",
    subject: "un portrait, une rue ou une scène familiale ancienne dont les détails doivent être restaurés",
    scene: "marché historique, intérieur d’époque, place méditerranéenne ou atelier ancien"
  },
  "only-fans": {
    label: "Création pour fans adultes",
    title: "Photos pour créateurs adultes avec l’IA | Aidreamcapes",
    description: "Préparez des visuels pour créateurs adultes avec l’IA : portraits, profils et contenus privés élégants, toujours non explicites.",
    keywords: "photos créateur adulte IA, portrait pour fans, contenu privé, visuel profil adulte, Aidreamcapes",
    h2: "Visuels pour créateurs adultes",
    subject: "un créateur adulte dans un portrait éditorial adapté à un profil ou une communauté privée",
    scene: "studio maison, chambre stylisée, scène musicale, bureau créatif ou terrasse au coucher du soleil"
  },
  "photo-enhancer": {
    label: "Amélioration photo",
    title: "Améliorer une photo avec l’IA | Aidreamcapes",
    description: "Améliorez une photo avec l’IA : netteté naturelle, dynamique équilibrée et détails récupérés pour portraits, paysages et objets.",
    keywords: "améliorer photo IA, netteté image, restaurer détails photo, qualité image, Aidreamcapes",
    h2: "Amélioration naturelle de la qualité photo",
    subject: "un portrait, un paysage ou un objet dont les détails et la lumière doivent retrouver leur équilibre",
    scene: "portrait près d’un lac, intérieur architectural, marché ou objet artisanal en lumière naturelle"
  },
  "portrait-photo": {
    label: "Portrait photo",
    title: "Portraits IA : style naturel et éditorial | Aidreamcapes",
    description: "Créez des portraits photo avec l’IA dans des styles naturels, éditoriaux ou cinématographiques : expressions crédibles, lieux variés et cadrages soignés.",
    keywords: "portrait photo IA, portrait naturel, portrait éditorial, photo visage IA, Aidreamcapes",
    h2: "Portrait photo naturel et éditorial",
    subject: "un adulte dans un portrait où le visage, l’expression et le style sont au premier plan",
    scene: "café méditerranéen, montagne, bord de lac, galerie ou intérieur à lumière latérale"
  },
  "portrait-retouch": {
    label: "Retouche de portrait",
    title: "Retouche de portrait IA | Aidreamcapes",
    description: "Retouchez un portrait avec l’IA en préservant l’identité, les traits et la texture de peau : lumière raffinée, corrections discrètes et résultat crédible.",
    keywords: "retouche portrait IA, retouche beauté naturelle, peau réaliste, améliorer portrait, Aidreamcapes",
    h2: "Retouche de portrait sans perdre l’identité",
    subject: "un adulte dont les traits, l’expression et la texture de peau restent authentiques",
    scene: "studio doux, intérieur près d’une fenêtre, café calme ou décor architectural minimal"
  },
  "rich-lifestyle": {
    label: "Art de vivre premium",
    title: "Photos d’art de vivre premium avec l’IA | Aidreamcapes",
    description: "Créez des photos d’art de vivre premium avec l’IA : villa, voyage, gastronomie et moments du quotidien soignés pour profils, campagnes et albums privés.",
    keywords: "art de vivre premium IA, photo luxe, portrait villa, photo voyage éditoriale, Aidreamcapes",
    h2: "Art de vivre premium et quotidien éditorial",
    subject: "un adulte dans une scène d’art de vivre premium, naturelle et sans logo visible",
    scene: "petit-déjeuner en villa, terrasse de Riviera, hôtel design ou salon baigné de lumière"
  },
  "singles-awareness-day": {
    label: "Journée des célibataires",
    title: "Photos Journée des célibataires avec l’IA | Aidreamcapes",
    description: "Créez des portraits pour la Journée des célibataires avec l’IA : confiance, autonomie, amitié et célébration de soi dans des scènes modernes et positives.",
    keywords: "Journée des célibataires photo IA, portrait solo, célébrer soi-même, photo lifestyle, Aidreamcapes",
    h2: "Portraits de célébration de soi",
    subject: "un adulte seul dans une image positive qui exprime confiance et indépendance",
    scene: "course au lever du soleil, galerie d’art, café, toit urbain ou dîner entre amis adultes"
  },
  "social-cards": {
    label: "Cartes pour réseaux sociaux",
    title: "Images pour cartes sociales avec l’IA | Aidreamcapes",
    description: "Créez des images pour cartes sociales avec l’IA : sujet lisible, espace négatif et compositions variées pour posts, campagnes, profils et contenus de créateur.",
    keywords: "cartes réseaux sociaux IA, visuel social media, image avec espace négatif, contenu créateur, Aidreamcapes",
    h2: "Images prêtes pour cartes sociales",
    subject: "un adulte, un objet ou un lieu composé pour rester lisible en miniature",
    scene: "studio coloré, table de produit, côte ouverte, bureau de créateur ou musée contemporain"
  },
  soccer: {
    label: "Football",
    title: "Photos de football et de supporters avec l’IA | Aidreamcapes",
    description: "Créez des photos de football avec l’IA : entraînement, match, tribune et supporters adultes, sans blason, marque, joueur réel ni texte lisible.",
    keywords: "photo football IA, portrait supporter, entraînement football, image stade, Aidreamcapes",
    h2: "Football, match et supporters adultes",
    subject: "un adulte joueur ou supporter dans une scène de football énergique et originale",
    scene: "terrain sous la pluie, tunnel de stade, tribune, futsal ou terrain de quartier"
  },
  "street-style": {
    label: "Style de rue",
    title: "Photos de style urbain avec l’IA | Aidreamcapes",
    description: "Créez des photos de style urbain avec l’IA : silhouettes contemporaines, architecture urbaine, lumière de rue et attitudes naturelles pour profils et éditoriaux.",
    keywords: "style urbain IA, photo mode urbaine, portrait rue, look contemporain, Aidreamcapes",
    h2: "Style urbain et mode contemporaine",
    subject: "un adulte dans une silhouette de mode urbaine avec tenue et attitude lisibles",
    scene: "passage bétonné, marché couvert, façade colorée, quai de gare ou rue au néon"
  },
  "swimsuit": {
    label: "Maillot de bain",
    title: "Photos en maillot de bain avec l’IA | Aidreamcapes",
    description: "Créez des photos adultes en maillot de bain avec l’IA : piscine, côte, spa et activités nautiques dans un style mode, naturel et non explicite.",
    keywords: "photo maillot de bain IA, portrait piscine adulte, mode balnéaire, photo spa, Aidreamcapes",
    h2: "Maillot de bain et escapades balnéaires",
    subject: "un adulte en maillot de bain dans une scène de vacances ou de bien-être non explicite",
    scene: "piscine architecturale, plage de lac, promenade maritime, spa thermal ou terrasse côtière"
  },
  "thanksgiving-photo": {
    label: "Photos de Thanksgiving",
    title: "Photos de Thanksgiving IA | Aidreamcapes",
    description: "Créez des photos de Thanksgiving avec l’IA : cuisine, repas, amitié et promenade d’automne pour cartes, albums privés et souvenirs chaleureux.",
    keywords: "photos Thanksgiving IA, repas automne, souvenir famille adulte, portrait saisonnier, Aidreamcapes",
    h2: "Souvenirs de Thanksgiving",
    subject: "des adultes réunis pour une scène de Thanksgiving chaleureuse et naturelle",
    scene: "cuisine en préparation, table en bois, véranda d’automne, marché local ou promenade en forêt"
  },
  travel: {
    label: "Voyage",
    title: "Photos de voyage avec l’IA | Aidreamcapes",
    description: "Créez des photos de voyage avec l’IA : villes, montagnes, côtes et trajets avec un lieu identifiable, une lumière naturelle et un style documentaire.",
    keywords: "photos de voyage IA, portrait destination, photo vacances, carnet de voyage, Aidreamcapes",
    h2: "Portraits de voyage et destinations",
    subject: "un adulte voyageur dans un portrait documentaire avec un lieu clairement reconnaissable",
    scene: "tramway lisboète, jardin japonais, ferry, désert rouge, canal européen ou sentier volcanique"
  },
  "unblur-image": {
    label: "Rendre une image plus nette",
    title: "Rendre une image plus nette avec l’IA | Aidreamcapes",
    description: "Rendez une image plus nette avec l’IA : détails du sujet, bords naturels et profondeur cohérente pour portraits, mouvement, nature et objets.",
    keywords: "rendre photo nette IA, améliorer mise au point, netteté image, récupérer détails, Aidreamcapes",
    h2: "Récupérer une netteté naturelle",
    subject: "un portrait, un objet ou une scène dont la netteté doit être améliorée sans créer de faux détails",
    scene: "portrait en intérieur, scène sportive, paysage côtier, marché ou objet artisanal détaillé"
  },
  urban: {
    label: "Urbain",
    title: "Photos urbaines avec l’IA | Aidreamcapes",
    description: "Créez des portraits urbains avec l’IA : architecture, métro, rues, lumière de ville et textures de quartier pour des images documentaires originales.",
    keywords: "photo urbaine IA, portrait architecture, style urbain, photo ville, Aidreamcapes",
    h2: "Portraits urbains et architecture",
    subject: "un adulte dans une scène urbaine où l’architecture et le trajet racontent le contexte",
    scene: "place moderniste, sortie de métro, passerelle, café de quartier ou immeuble éclairé"
  },
  "valentines-photo": {
    label: "Photos de Saint-Valentin",
    title: "Photos de Saint-Valentin avec l’IA | Aidreamcapes",
    description: "Créez des photos de Saint-Valentin avec l’IA : couple, cadeau, dîner et moments tendres pour cartes et souvenirs, avec des scènes romantiques variées.",
    keywords: "photos Saint-Valentin IA, photo couple romantique, carte amour, cadeau photo, Aidreamcapes",
    h2: "Photos de Saint-Valentin pour couple et cadeau",
    subject: "un couple adulte dans un moment romantique, tendre et clairement lisible",
    scene: "librairie, promenade au bord de l’eau, atelier de cadeau, café chaleureux ou dîner aux chandelles"
  },
  "virtual-try-on": {
    label: "Essayage virtuel",
    title: "Essayage virtuel de vêtements avec l’IA | Aidreamcapes",
    description: "Testez un look avec l’essayage virtuel IA : vêtements, tissus, silhouettes et contextes de mode variés pour comparer une tenue avant un achat ou une séance.",
    keywords: "essayage virtuel IA, essayer vêtements, look mode IA, visualisation tenue, Aidreamcapes",
    h2: "Tester une tenue avec l’essayage virtuel",
    subject: "un adulte portant une tenue dont la coupe, le tissu et le styling sont crédibles",
    scene: "studio de miroirs, marché méditerranéen, galerie blanche, piste sportive ou rue froide"
  },
  "wedding-photo": {
    label: "Photos de mariage",
    title: "Photos de mariage avec l’IA | Aidreamcapes",
    description: "Créez des photos de mariage avec l’IA : cérémonie, préparatifs et portraits de couple pour moodboards et souvenirs, sans les présenter comme un reportage.",
    keywords: "photos mariage IA, portrait mariés, cérémonie mariage, moodboard mariage, Aidreamcapes",
    h2: "Photos de mariage pour cérémonie et couple",
    subject: "un couple adulte dans une scène de mariage éditoriale avec visages et gestes naturels",
    scene: "jardin de cérémonie, préparation en chambre, salle lumineuse, sortie de mairie ou portrait au voile"
  }
};

// The five category URLs below are public directory landing pages, not image
// theme leaves. Keep their copy separate from SEEDS so they can be indexed and
// localized without changing the 39-theme asset registry.
const DIRECTORY_SEEDS: Record<string, AidreamcapesEuSeoSeed> = {
  "best-themes-presets": {
    label: "Meilleurs thèmes et préréglages",
    title: "Meilleurs thèmes photo IA | Aidreamcapes",
    description: "Comparez les meilleurs thèmes photo IA d’Aidreamcapes : portraits, fêtes, voyages et styles créatifs avant de choisir votre galerie privée.",
    keywords: "meilleurs thèmes photo IA, préréglages photo, galerie photo IA, styles créatifs, Aidreamcapes",
    h2: "Choisir un thème photo adapté à votre projet",
    subject: "une sélection de portraits et de scènes photo organisés par intention visuelle",
    scene: "portraits professionnels, fêtes de saison, voyages, mode et créations cinématographiques"
  },
  professional: {
    label: "Portraits professionnels",
    title: "Portraits professionnels avec l’IA | Aidreamcapes",
    description: "Explorez des portraits professionnels créés avec l’IA pour profils, équipes, CV et projets personnels, avec des styles crédibles et une galerie privée.",
    keywords: "portrait professionnel IA, photo CV, portrait LinkedIn, photo d’équipe, Aidreamcapes",
    h2: "Créer un portrait professionnel avec l’IA",
    subject: "des adultes dans des portraits professionnels aux visages, tenues et expressions lisibles",
    scene: "bureau contemporain, studio neutre, architecture moderne et lumière naturelle"
  },
  "lifestyle-creative": {
    label: "Art de vivre et créations",
    title: "Photos d’art de vivre et créations avec l’IA | Aidreamcapes",
    description: "Découvrez des thèmes photo d’art de vivre et créatifs avec l’IA : voyage, mode, plage, ville et univers originaux pour des galeries privées distinctives.",
    keywords: "photo art de vivre IA, photo créative, portrait voyage, mode IA, galerie privée, Aidreamcapes",
    h2: "Explorer des photos d’art de vivre et créatives",
    subject: "des adultes dans des scènes d’art de vivre, de voyage, de mode et d’expression personnelle",
    scene: "côte lumineuse, rue urbaine, intérieur éditorial, paysage de voyage et décor de vacances"
  },
  magic: {
    label: "Créations magiques",
    title: "Créations photo magiques avec l’IA | Aidreamcapes",
    description: "Explorez des créations photo magiques avec l’IA : mouvement, coiffure, essayage virtuel et transformations visuelles pour des projets créatifs privés.",
    keywords: "création photo IA, générateur de mouvement, coiffure IA, essayage virtuel, Aidreamcapes",
    h2: "Transformer une idée en création photo",
    subject: "des adultes et des portraits transformés par une direction visuelle créative",
    scene: "studio de mode, scène en mouvement, miroir, décor urbain et lumière cinématographique"
  },
  "photo-tools": {
    label: "Outils photo",
    title: "Outils photo IA : retoucher et améliorer | Aidreamcapes",
    description: "Utilisez les outils photo IA d’Aidreamcapes pour détourer, retoucher, améliorer, restaurer ou modifier vos images avant une galerie privée.",
    keywords: "outils photo IA, retouche photo, supprimer arrière-plan, améliorer image, restaurer photo, Aidreamcapes",
    h2: "Préparer et retoucher vos images avec l’IA",
    subject: "des portraits, objets et scènes préparés avec des corrections visuelles ciblées",
    scene: "fond neutre, intérieur lumineux, arrière-plan remplacé, détails restaurés et couleurs équilibrées"
  }
};

function contentFromSeed(seed: AidreamcapesEuSeoSeed, normalized: string, canonicalPath: string): AidreamcapesEuSeoContent {
  const relatedLinks = [
    { label: "Voir tous les thèmes photo", href: "/ai-image-generation" },
    { label: "Consulter les tarifs", href: "/pricing" },
    { label: "Comprendre le fonctionnement", href: "/workflow" }
  ];
  return {
    ...seed,
    slug: normalized,
    explicit: true,
    canonicalPath,
    h3: [`Explorer ${seed.label.toLowerCase()}`, `Idéal pour ${seed.subject.replace(/^un |^une |^des /i, "")}`, "Préparer une galerie privée"],
    intro: `La catégorie « ${seed.label} » présente ${seed.subject} dans des décors tels que ${seed.scene}. La page présente des directions visuelles distinctes avant de lancer une galerie privée.`,
    details: [
      `Cette catégorie rassemble ${seed.subject} avec des compositions lisibles adaptées à différents usages personnels et créatifs.`,
      `Les directions visuelles explorent ${seed.scene}, avec des lumières, matières et cadrages différents d’une image à l’autre.`,
      "Utilisez des photos source nettes dont vous détenez les droits ou l’autorisation, puis vérifiez chaque résultat avant téléchargement."
    ],
    useCases: [`Profils et publications liés à ${seed.label.toLowerCase()}`, "Moodboards et idées de direction artistique", "Albums privés à conserver ou à partager", "Visuels de créateur ou de campagne"],
    workflow: ["Choisir une direction visuelle.", "Importer des photos source autorisées et lisibles.", "Comparer le nombre d’images et les crédits avant de commencer.", "Examiner la galerie privée puis télécharger les favoris."],
    internalLinks: relatedLinks,
    ctaLabel: `Explorer ${seed.label.toLowerCase()}`,
    ctaHref: "/app/create",
    faqItems: [
      [`Que trouve-t-on dans « ${seed.label} » ?`, `Cette catégorie rassemble ${seed.subject} dans des décors tels que ${seed.scene}, avec plusieurs directions destinées à une galerie privée.`],
      [`Quelles photos source utiliser pour ${seed.label.toLowerCase()} ?`, "Utilisez des photos nettes et bien éclairées que vous possédez ou que vous êtes autorisé à utiliser. Évitez les captures, les petits recadrages et les visages non consentants."],
      ["Comment choisir le bon thème ?", "Comparez la scène, le cadrage, le nombre d’images et le coût en crédits avant d’ouvrir le thème qui correspond à votre projet."],
      ["Où retrouver les images terminées ?", "Les résultats restent dans votre espace privé pour être examinés, conservés et téléchargés lorsque la galerie vous convient."]
    ]
  };
}

export const AIDREAMCAPES_EU_THEME_SLUGS = Object.freeze(Object.keys(SEEDS));
export const AIDREAMCAPES_EU_DIRECTORY_SLUGS = Object.freeze([...AIDREAMCAPES_EU_THEME_SLUGS, ...Object.keys(DIRECTORY_SEEDS)]);

export function aidreamcapesEuSeoContent(slug: string): AidreamcapesEuSeoContent | undefined {
  const normalized = slug.trim().toLowerCase();
  const seed = SEEDS[normalized];
  if (!seed) return undefined;
  return contentFromSeed(seed, normalized, `/ai-image-generation/${normalized}`);
}

export function aidreamcapesEuSeoDirectoryContent(slug: string): AidreamcapesEuSeoContent | undefined {
  const normalized = slug.trim().toLowerCase();
  const seed = DIRECTORY_SEEDS[normalized];
  return seed ? contentFromSeed(seed, normalized, `/ai-image-generation/${normalized}`) : undefined;
}

export function aidreamcapesEuSeoContentForSlug(slug: string): AidreamcapesEuSeoContent | undefined {
  return aidreamcapesEuSeoContent(slug) ?? aidreamcapesEuSeoDirectoryContent(slug);
}

export function aidreamcapesEuSeoContentFromPath(path: string): AidreamcapesEuSeoContent | undefined {
  const match = String(path || "").match(/^\/ai-image-generation\/([^/?#]+)/i);
  return match?.[1] ? aidreamcapesEuSeoContentForSlug(match[1]) : undefined;
}

export function aidreamcapesEuSaveTheDateSeoFromPath(path: string | null | undefined): AidreamcapesEuRouteSeo | undefined {
  const normalized = String(path ?? "").split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  return SAVE_THE_DATE_SEO[normalized.toLowerCase()];
}
