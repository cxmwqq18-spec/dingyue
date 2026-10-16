// Forward-only seed input for current English homepage presentation. Never a runtime data source.
import assert from 'node:assert/strict';

export function localizeAidreamcapesHomeInteractions(current) {
  const next = structuredClone(current);
  const experience = next.homeExperience;
  assert.equal(experience?.language, 'en');
  const update = (kind, copy) => {
    const block = experience.blocks.find(item => item.after === kind);
    assert(block, `Missing current module: ${kind}`);
    Object.assign(block.copy, { uiClose: 'Close preview', ...copy });
    return block;
  };
  update('hero', {
    t001: 'AI product videos and images', t002: 'Turn product photos', t003: 'into AI videos and images.',
    t004: 'See how a product photo can become a presenter video, a product demonstration or a store image. Preview the examples here, then start with your own product in the workspace.',
    t009: 'Start a product video →', t011: 'Preview example',
    t015: 'Compare the photo and example', t016: 'See the product reference beside an example visual.', t017: 'Use the comparison to plan your own content.'
  });
  const picker = update('picker', {
    t001: 'Product video scene examples', t002: 'Find a product video scene.', t003: 'Preview it before you create.',
    t004: 'Filter the examples by category and choose a scene to explore its creative direction. When you find a useful starting point, use the selected scene to open your workspace with its brief ready to adapt.',
    t006: 'Filter the scene examples', t007: 'Browse product categories here on the page.',
    t009: 'Select a creative direction', t010: 'Choose a card to preview the scene and see the selected example below.',
    t012: 'Continue when you are ready', t013: 'Use the selected scene to open the workspace, then add your own product photo and refine the brief.',
    t014: 'Preview product video scenes', t015: 'Interactive scene preview',
    t018: 'Fashion & accessories', t020: 'Home', t021: 'AI presenter · Product introduction',
    t027: 'Selected scene', t028: 'Preview first, then make it your own', t029: 'Use selected scene →'
  });
  picker.presentation = { ...picker.presentation, sceneCategories: {
    presenter: ['beauty'], earbuds: ['tech'], steamer: ['home'], tote: ['clothing'], cardigan: ['clothing'], fragrance: ['home']
  } };
  update('steps', {
    t001: 'At home', t002: 'At work', t003: 'Outdoors',
    t004: 'AI presenters for product introductions', t005: 'Explore AI presenters.', t006: 'Find a style for your video.',
    t007: 'Select an example portrait to compare presenter styles. A clear product script helps you explain the features and use cases that matter. Continue to the workspace when you are ready to choose an available presenter.',
    t010: 'Voice and language information', t011: 'View details',
    t012: 'These portraits show example styles. Available presenters, voices and languages are listed in the workspace.',
    t013: 'Choose a presenter in the workspace →',
    uiVoiceTitle: 'Choosing a presenter voice',
    uiVoiceDescription: 'A presenter’s voice profile helps you understand the speaking style and supported languages. Match the available voice options to your script and audience.',
    uiVoiceNotice: 'Review the voice information shown for each available presenter in the workspace before choosing.'
  });
  update('features', {
    t001: 'How AI Video Agent works', t002: 'Explore the video storyboard.', t003: 'See how the shots fit together.',
    t004: 'Explore the stages below and compare example shot framing on this page. For your own video, add a product photo and brief, save a draft, generate its storyboard and refine the shots before production.',
    t005: 'Interactive storyboard example', t006: '① Product brief', t007: '② Storyboard', t008: '③ Assemble', t009: '④ Review',
    t013: 'Wider framing', t014: 'Closer framing', t018: 'Wider framing', t019: 'Closer framing', t023: 'Wider framing', t024: 'Closer framing',
    t027: 'Prepare the product brief', t028: 'Start with product facts and a photo',
    t029: 'Preview the shot plan', t030: 'Explore framing and dialogue',
    t031: 'Build your own video', t032: 'Continue in the workspace when ready',
    uiProductStage: 'A clear product photo and a short brief define what the video should show. Bring the product details, audience and main message together before planning your shots.',
    uiAssemblyStage: 'In your own draft, choose the shot versions to keep and assemble them into a video. This preview illustrates how the selected shots form a sequence.',
    uiDeliveryStage: 'Explore an example of the review stage. Check the product details and complete video before downloading your finished content from the workspace.'
  });
  update('audience', {
    t001: 'Batch Drafts for product campaigns', t002: 'Plan several product videos.', t003: 'Start with one clear brief.',
    t004: 'Compare the example briefs below to plan your campaign. In Batch Drafts, choose a scene, write a shared brief and name 1–10 drafts. Save them to your Library and edit each before deciding what to generate.',
    t008: 'Create batch drafts →', t010: 'Preview campaign briefs', t011: 'Example briefs',
    t012: 'All briefs', t013: 'Product focus', t014: 'Presenter stories',
    t019: 'Preview brief →', t024: 'Preview brief →', t029: 'Preview brief →',
    uiUseBrief: 'Create batch drafts with this brief →', uiEmpty: 'Choose another category to explore more example briefs.'
  });
  update('reviews', {
    t001: 'Product content formats', t002: 'Preview product content', t003: 'for different placements.',
    t004: 'Compare a vertical presenter visual, a square product image and product-page imagery. Select a format to explore the example here, then use the creation button to start with your own product.',
    t005: 'Presenter visual · 9:16', t006: 'Preview the vertical format',
    t007: 'Product image · 1:1', t008: 'Preview the square format',
    t009: 'Product page imagery', t010: 'Preview the product detail format',
    t011: 'Vertical social format', t012: 'Product page format', t013: 'Product launch example', t014: 'Campaign image example', t015: 'Brand image example',
    t016: 'Create with this format →'
  });
  Object.assign(experience.labels, {
    'Preview source image': 'Preview source image', 'Preview result': 'Preview example',
    'Close preview': 'Close preview', 'Example selection': 'Example preview',
    'View pricing': 'View plans and credits', Download: 'Preview example',
    'Download video': 'Preview example'
  });
  const hero = experience.blocks.find(item => item.after === 'hero');
  const imageIntent = (tool, prompt, aspect = '1:1') => `/app/create?${new URLSearchParams({ view: 'images', tool_id: 'image_generator', tool, prompt, aspect })}`;
  const lifestyle = imageIntent('lifestyle-photos', 'Place my product in a simple everyday setting with soft natural lighting. Keep its shape and color consistent with my uploaded reference photo.');
  const white = imageIntent('white-background', 'Show my product clearly on a clean white background. Keep the shape, color and visible details consistent with my uploaded reference photo.');
  const detail = imageIntent('custom', 'Create a clear close-up product image that emphasizes the visible details of my uploaded product photo without changing the product design.');
  const social = imageIntent('custom', 'Create a vertical product image for a social post. Give the product a clear visual focus and leave room around it for a short message.', '9:16');
  Object.assign(hero.actions, {
    visualChoice1: lifestyle, visualChoice2: white, visualChoice3: detail, visualChoice4: social,
    visualOption1: lifestyle, visualOption2: imageIntent('custom', 'Create a square product image using my own uploaded product photo. Keep the product details clear and consistent.')
  });
  next.visual.steps.chips = ['Lifestyle', 'White background', 'Product detail', 'Social image'];
  next.visual.steps.options = [['Style', 'Lifestyle'], ['Format', '1:1']];
  const voiceFaq = next.faq.find(item => item.q === 'Can an AI actor use a voice we already recorded?');
  assert(voiceFaq, 'Current voice FAQ must exist');
  voiceFaq.a = 'Custom voice cloning is not currently available. Choose from the presenter voice options listed in the workspace, and review the supported languages before creating your video.';
  return next;
}
