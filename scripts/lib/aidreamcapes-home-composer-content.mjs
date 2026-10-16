import assert from 'node:assert/strict';

/** Page-owned English copy for the homepage form and the two matching workflows. */
export function aidreamcapesHomeComposerFields(content) {
  const data = content.sections.v2_main.settings.data;
  const pickerIndex = data.homeExperience.blocks.findIndex(block => block.after === 'picker');
  assert(pickerIndex >= 0 && data.more_sections[0]?.items.length === 6);
  const steps = [
    { t: 'Add your product assets', d: 'Upload a clear product photo or import a public product page. Review the photos, features and product details you want to use, so your video starts with information about your own product.' },
    { t: 'Choose a scene and presenter', d: 'Browse scene templates for product demonstrations, close-ups and presenter introductions. Preview the creative direction and choose an available AI presenter when your video needs someone to explain the product.' },
    { t: 'Write your product brief', d: 'Describe who the product is for, what it does and the message you want viewers to remember. Set an available aspect ratio and duration to suit your product page or social channel.' },
    { t: 'Save your draft and refine the storyboard', d: 'Save an editable draft in your Library, then generate its storyboard. Review the sequence and refine the visuals and dialogue for each shot before you decide which shots to create.' },
    { t: 'Generate shots and assemble your video', d: 'Review the credit estimate and generate the shots you choose. Compare versions, select your preferred clips and assemble them into a video. Check any supported captions alongside the visuals and dialogue.' },
    { t: 'Review and download', d: 'Watch the assembled video and check the product details, spoken words and overall presentation. When the result is ready, download the finished file for your product page, campaign or social media channel.' }
  ];
  const descriptions = [
    'Add your own product photo or import a public product page.',
    'Preview a scene and choose an available presenter where needed.',
    'Describe your product, audience and the message you want to share.',
    'Save to your Library and refine each shot before generating.',
    'Compare generated versions and assemble your selected clips.',
    'Check the complete video, then download the finished file.'
  ];
  const prefix = '/sections/v2_main/settings/data';
  return [
    { path: prefix + '/ugc/paras', value: [data.ugc.paras[0]] },
    { path: prefix + '/ugc/composer', value: {
      label: 'Try your product video brief',
      tabs: [{ label: 'AI Video Agent', view: 'home' }, { label: 'AI Video', view: 'video' }, { label: 'AI Image', view: 'images' }],
      promptLabel: 'Your creative brief', placeholder: 'Describe your product and the story you want to tell…',
      productLabel: 'Product', productHint: 'Add a product name or a key detail to your brief.', productPlaceholder: 'For example: a navy insulated travel mug',
      sceneLabel: 'Scene', scenes: [{ value: 'presenter_showcase', label: 'AI presenter' }, { value: 'process_demo', label: 'Product demo' }, { value: 'texture_closeup', label: 'Product close-up' }],
      modelLabel: 'Model options', modelHint: 'Choose from the available models in your workspace. You can review supported settings and the credit estimate before generating.',
      aspectLabel: 'Format', aspects: [{ value: '9:16', label: '9:16' }, { value: '1:1', label: '1:1' }, { value: '16:9', label: '16:9' }],
      durationLabel: 'Length', durations: [{ value: '6', label: '6s' }, { value: '10', label: '10s' }, { value: '15', label: '15s' }, { value: '30', label: '30s' }],
      submitLabel: 'Continue in workspace', note: 'Prepare your brief here, then continue in your workspace to add your own product photos and review your creation settings.'
    } },
    { path: prefix + '/ugc/formats', value: [
      { t: 'URL to Video', d: 'Turn a public product URL into an AI video brief for ads, social media and product demonstrations. Review the imported photos and details, choose your creative direction and create a product video without arranging a shoot.' },
      { t: 'Image to Video', d: 'Create AI videos from a single product photo. Add a description to guide the scene and movement, then generate dynamic product visuals for ads, social posts and launches without a camera crew.' },
      { t: 'Text to Video', d: 'Turn a written idea into an AI video. Describe your product, audience and key message, then refine an editable storyboard before generating the shots you choose for your campaign.' },
      { t: 'AI Video', d: 'Create product videos with AI presenters and generated scenes in one workspace. Choose a scene, refine your brief, compare shot versions and assemble a video for your product page or social channels.' }
    ] },
    { path: prefix + '/more_sections/0/items', value: steps },
    { path: prefix + `/homeExperience/blocks/${pickerIndex}/presentation/steps`, value: steps.map((step, i) => ({ number: String(i + 1).padStart(2, '0'), title: step.t, description: descriptions[i] })) },
    { path: '/contentContract/sourceRevision', value: 'aidreamcapes-home-composer-en-20261017' }
  ];
}
