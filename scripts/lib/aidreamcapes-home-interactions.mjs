// Reviewed English copy and action links. Seed input only; public SSR reads LivePage.
import assert from 'node:assert/strict';
import { pickerPresetHref } from '../../src/lib/aidreamcapes-workspace/preset-contract.ts';

const workspace = (view, values = {}) => {
  const query = new URLSearchParams({ view, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
  if (view === 'images') { query.set('tool_id', 'image_generator'); if (!query.has('tool')) query.set('tool', 'custom'); }
  return `/app/create?${query}`;
};
const brief = {
  product: 'Create a product demonstration using my uploaded product photo. Show the product clearly, explain one useful feature using the details I provide, and end with a clear next step.',
  presenter: 'Create a natural AI presenter introduction to my skincare serum. Show the bottle and dropper, use only the product details I provide, and end with an invitation to learn more.',
  details: 'Show close-up views of my product, including the packaging and visible details. Keep the product recognizable from my reference photo and use a clean, focused presentation.',
  launch: 'Introduce my new product with a clear opening, one main product benefit supported by the details I provide, and a short invitation to learn more.',
  image: 'Create a clean product photo using my own reference image. Keep the product shape and color consistent, use soft natural lighting, and place the product in a simple everyday setting.',
  mug: 'Show my insulated travel mug in a parked car as part of a relaxed morning routine. Keep the mug shape and color consistent with my own uploaded product photo.',
  square: 'Create a square product photo for my product page. Use a clean background, clear lighting and a close view of the product details. Keep the product consistent with my reference photo.'
};
const video = (prompt = brief.presenter, values = {}) => workspace('video', { prompt, aspect: '9:16', duration: 15, scene: 'presenter_showcase', ...values });
const agent = (prompt = brief.product, values = {}) => workspace('agent', { prompt, scene: 'process_demo', aspect: '9:16', duration: 15, ...values });
const photo = (prompt = brief.image, values = {}) => workspace('images', { prompt, aspect: '1:1', ...values });
const templates = (category) => workspace('home', { templates: 1, ...(category ? { category } : {}) });
const batch = (prompt, scene = 'presenter_showcase') => workspace('batch', { prompt, scene, aspect: '9:16', duration: 15 });
const library = (filter = 'all') => workspace('library', { filter });

export function improveAidreamcapesHome(current) {
  const next = structuredClone(current);
  const experience = next.homeExperience;
  assert.equal(experience.language, 'en', 'Current English homepage is required');
  const block = kind => { const value = experience.blocks.find(item => item.after === kind); assert(value, `Missing module ${kind}`); return value; };
  const update = (kind, copy, actions, href) => { const target = block(kind); Object.assign(target.copy, copy); target.actions = { ...target.actions, ...actions }; target.href = href; };
  const scenePreset = (label) => {
    const card = current.visual.picker.cards.find(item => item.label === label);
    assert(card, `Current relational scene missing: ${label}`);
    return pickerPresetHref(card, '/');
  };

  update('hero', {
    t001: 'AI product videos and photos, in one workspace',
    t002: 'Start with your product photo.', t003: 'Create the content around it.',
    t004: 'Upload your product, choose a scene and describe what you want to show. Create a product image, prepare an AI presenter video or save a video draft to edit shot by shot.',
    t009: 'Start a product video →', t010: 'Your starting point · A product photo',
    t011: 'Open this video brief →', t015: 'Try another product angle',
    t016: 'Use the same product with a new opening.', t017: 'Refine your brief in the workspace.',
    t018: '01　Add your product', t019: 'Upload your own product photo',
    t020: '02　Choose a starting point', t021: 'Pick a scene and write a short brief',
    t022: '03　Save and edit your draft', t023: 'Review the storyboard before generating shots',
    t024: '04　Review and download', t025: 'Generate clips, assemble and check the result'
  }, {
    product: agent(), templates: templates(), presenters: workspace('actors'), outputs: photo(),
    source: photo(), result: video(), versions: agent(brief.launch),
    step1: agent(), step2: templates(), step3: agent(), step4: library('completed'),
    visualSource: photo(brief.mug, { tool: 'lifestyle-photos' }), visualChoices: templates(),
    visualChoice1: templates('accessories'), visualChoice2: templates('apparel'), visualChoice3: templates('apps'), visualChoice4: templates('beauty-personal-care'),
    visualOption1: templates(), visualOption2: photo(brief.mug), visualCost: photo(brief.mug),
    visualCreate: photo(brief.mug, { tool: 'lifestyle-photos' }), visualResult: photo(brief.mug, { tool: 'lifestyle-photos' }), visualDownload: photo(brief.mug, { tool: 'lifestyle-photos' }),
    visualActor1: workspace('actors'), visualActor2: workspace('actors'), visualActor3: workspace('actors')
  }, agent());

  update('picker', {
    t001: 'Product video scene templates', t002: 'Choose a scene.', t003: 'Make it your product story.',
    t004: 'Browse product close-ups, presenter videos and demonstrations. Choose a card to open that starting point in your workspace, with its creative description ready to adapt to your own product.',
    t006: 'Browse scenes in your workspace', t007: 'Use the category links to open the matching template collection.',
    t009: 'Choose a template', t010: 'Click a product scene to fill your workspace with its creative direction.',
    t012: 'Add your product and refine the brief', t013: 'Upload your own photo, adjust the description and choose the supported video settings.',
    t014: 'Choose a product video template', t015: 'Open workspace →', t020: 'Accessories',
    t021: 'AI presenter · Product introduction', t027: 'Next: upload your product photo', t028: 'The selected scene supplies a starting brief',
    t029: 'Browse all scene templates →'
  }, {
    open: templates(), choose: templates(), edit: agent(), close: workspace('home'), all: templates(), beauty: templates('beauty-personal-care'), clothing: templates('clothing'), tech: templates('tech-electronics'), home: templates('accessories'),
    presenter: video(), earbuds: scenePreset('Stemless Earbud Product Detail'), steamer: scenePreset('Shirt Steamer UGC'), tote: scenePreset('Canvas Tote Product Detail'), cardigan: scenePreset('Cardigan Turn Reel'), fragrance: video('Create a relaxed presenter video introducing my home fragrance product. Use my own product photo, show the packaging clearly and describe only the details I provide.')
  }, templates());

  update('steps', {
    t001: 'Browse AI presenters', t002: 'Browse AI presenters', t003: 'Browse AI presenters',
    t004: 'AI presenter videos for your products', t005: 'Put a presenter', t006: 'behind your product story.',
    t007: 'Browse AI presenters, review the voice information and prepare a script using your own product details. Choose a presenter in the workspace, then return to your video brief to shape the introduction.',
    t008: 'A product introduction to adapt',
    t009: '“Here is a closer look at our serum: the bottle, the dropper and the product details worth knowing.”',
    t010: 'Check presenter voice options →', t011: 'Open the presenter library',
    t012: 'Images show example presenters. Choose an available presenter and supported voice in the workspace.', t013: 'Browse AI presenters →'
  }, { main: workspace('actors'), presenterHome: workspace('actors'), presenterWork: workspace('actors'), presenterOutdoor: workspace('actors'), voice: workspace('actors') }, workspace('actors'));

  update('features', {
    t001: 'AI Video Agent · From brief to editable storyboard', t002: 'Plan your product video.', t003: 'Then build it shot by shot.',
    t004: 'Add product photos and a short brief, then save your draft. Generate its storyboard, refine the visuals and dialogue, then generate selected shots and assemble your video.',
    t005: 'Example storyboard · Use a brief to start your own', t006: '① Add product', t007: '② Plan shots', t008: '③ Build video', t009: '④ Review output',
    t010: 'Shot 01 · Product details', t011: 'Show the product clearly', t012: 'Start from a brief focused on the bottle, packaging and visible details.', t013: 'Use this detail brief →', t014: 'Try a launch brief →',
    t015: 'Shot 02 · Product introduction', t016: 'Explain one useful feature', t017: 'Prepare a presenter introduction using the product facts you provide.', t018: 'Use a presenter brief →', t019: 'Try another opening →',
    t020: 'Shot 03 · Closing message', t021: 'Give viewers a next step', t022: 'Bring the product story together with a clear final message.', t023: 'Use this closing brief →', t024: 'Edit a new brief →',
    t027: 'Save your draft', t028: 'Keep the product brief in your Library', t029: 'Edit the storyboard', t030: 'Refine visuals and dialogue for each shot', t031: 'Generate and assemble', t032: 'Review selected clips before downloading', t033: 'Start an editable video draft →'
  }, {
    product: agent(), storyboard: agent(), assembly: library(), delivery: library('completed'),
    shot1: agent(brief.details, { scene: 'texture_closeup' }), shot1v1: agent(brief.details, { scene: 'texture_closeup' }), shot1v2: agent(brief.launch),
    shot2: agent(brief.presenter, { scene: 'presenter_showcase' }), shot2v1: agent(brief.presenter, { scene: 'presenter_showcase' }), shot2v2: agent(brief.launch, { scene: 'presenter_showcase' }),
    shot3: agent(brief.launch), shot3keep: agent(brief.launch), shot3edit: agent(brief.product)
  }, agent());

  update('audience', {
    t001: 'Batch Drafts · Plan your next product campaign', t002: 'One product brief.', t003: 'Several drafts to refine.',
    t004: 'Choose a scene and write a shared brief, then name 1–10 drafts in Batch Drafts. Save them to your Library, edit each draft and decide which videos to generate.',
    t005: 'Choose the shared scene', t006: 'Write the shared brief', t007: 'Name and save your drafts', t008: 'Open Batch Drafts →',
    t009: 'Saving drafts does not generate videos or use generation credits.',
    t010: 'Three example briefs to try', t011: 'Start with an example', t012: 'Your Library', t013: 'In progress', t014: 'Completed',
    t015: 'Example brief', t016: 'Product details', t017: 'Focus on the bottle and packaging.', t018: 'Start with a clear view of your product.', t019: 'Use this brief →',
    t020: 'Example brief', t021: 'Presenter introduction', t022: 'Introduce the product with a presenter.', t023: 'Use facts from your own product brief.', t024: 'Use this brief →',
    t025: 'Example brief', t026: 'New launch opening', t027: 'Lead with a new product or offer.', t028: 'Try a different first line for the campaign.', t029: 'Use this brief →',
    t030: 'Choose a scene → Write a shared brief → Name and save drafts → Edit them in your Library'
  }, {
    assets: batch(brief.product, 'process_demo'), names: batch(brief.product, 'process_demo'), edit: library('draft'),
    all: library(), inProgress: library('draft'), completed: library('completed'),
    draftDetails: batch(brief.details, 'texture_closeup'), draftPresenter: batch(brief.presenter), draftLaunch: batch(brief.launch), library: library()
  }, batch(brief.product, 'process_demo'));

  update('reviews', {
    t001: 'Product content for social feeds and storefronts', t002: 'Create for the place', t003: 'your product will be seen.',
    t004: 'Start a vertical presenter video for social, a square product image for your store or a new campaign brief. Each example opens the matching workspace with a description you can edit.',
    t005: 'Vertical presenter video · 9:16', t006: 'Start a social video brief →',
    t007: 'Square product image · 1:1', t008: 'Open the product image workspace →',
    t009: 'Product page visuals · 1:1', t010: 'Prepare a clear product detail image →',
    t011: 'Social video brief', t012: 'Product page image', t013: 'New launch brief', t014: 'Batch campaign drafts', t015: 'Brand product image',
    t016: 'Create a product image →', t017: 'Examples show possible creative directions. Upload your own product photos and review generated details before using the content.'
  }, {
    video: video(), image: photo(), productPage: photo(brief.square, { tool: 'white-background' }), social: video(),
    launch: agent(brief.launch), testing: batch(brief.product, 'process_demo'), brand: photo(brief.image, { tool: 'lifestyle-photos' })
  }, photo());

  next.h1 = 'Create AI UGC Videos from Your Product Photos';
  next.lead = 'Turn product photos and a clear brief into AI presenter videos, product demonstrations and store-ready images. Choose a scene, prepare your content in the workspace and review the result before downloading.';
  next.stepsH2 = 'From Product Photo to Finished Content in Three Steps';
  next.stepsLead = 'Add your product, choose a creative direction, then review your images or video before downloading.';
  next.visual.steps.items = [
    { t: 'Add your product photo', d: 'Open the workspace and upload your own product image. Start with a scene template if you already have a look in mind.' },
    { t: 'Choose a scene and write your brief', d: 'Describe the setting and the product details to show. In the image workspace, choose a style and aspect ratio before generating.' },
    { t: 'Review, refine and download', d: 'Check the result against your product photo. Refine the description for another version, then download the content you want to use.' }
  ];
  next.visual.steps.buttonHref = photo(brief.mug, { tool: 'lifestyle-photos' });
  next.visual.steps.credits = 'Shown before generation';
  if (next.maker) next.maker.cta = 'Open image workspace';
  Object.assign(experience.labels, { Download: 'Try this image style →', 'Download video': 'Open video workspace', 'Photoshoot or creator': 'Traditional shoot or creator' });

  next.compareH2 = 'Product Content: A Creator Shoot or an AI Workspace?';
  next.compare = [
    ['Starting point', 'A creator brief, shoot plan and product samples.', 'Your product photos and a short creative brief.'],
    ['Preparation', 'Arrange a creator, location and filming schedule.', 'Choose a scene, presenter where needed and supported format.'],
    ['Script and message', 'Agree the script and details with the creator.', 'Write your brief and refine the dialogue in an editable draft.'],
    ['Production cost', 'Costs depend on the creator, shoot and edit.', 'Choose a credit plan and review the cost before generation.'],
    ['Creative versions', 'Arrange another take or request an edit.', 'Save drafts, adjust the brief and generate the versions you choose.'],
    ['Product details', 'Capture the physical product on camera.', 'Use your own reference photos and check generated details.'],
    ['Presenter and voice', 'Work with the creator and voice recorded on set.', 'Choose an available AI presenter and review supported voice options.'],
    ['Review process', 'Review a rough cut and request changes.', 'Review the storyboard and selected shot versions before assembly.'],
    ['Channel formats', 'Plan framing and edits for each placement.', 'Choose a supported aspect ratio in the video or image workspace.'],
    ['Next campaign', 'Prepare a new brief and schedule more production.', 'Start another brief with your product assets and creative direction.']
  ];
  Object.assign(next.more_sections[0], {
    h2: 'How AI Video Agent Takes Your Brief to a Finished Video',
    lead: 'Start with your own product photo and a short brief. Save an editable draft, shape its storyboard and generate only the shots you choose before assembling and downloading the video.',
    items: [
      { t: 'Add your product assets', d: 'Upload your product photo or import a public product page. Check the product details you want the video to use.' },
      { t: 'Choose a scene and presenter', d: 'Choose a product demonstration, detail close-up or presenter scene. For presenter videos, select an available AI presenter.' },
      { t: 'Write a clear product brief', d: 'Describe the audience, product facts and key message. Choose the supported video format, duration and other available settings.' },
      { t: 'Save a draft and edit its storyboard', d: 'Save the draft to your Library. Generate its storyboard, then refine each shot, including the visuals and dialogue.' },
      { t: 'Generate shots and assemble the video', d: 'Check the credit cost, generate the shots you choose and compare their versions. Assemble your selected clips and review any captions.' },
      { t: 'Review and download', d: 'Check the product details, spoken words and complete video. Download the finished file when it is ready for your product page or social channel.' }
    ]
  });
  return next;
}
