import assert from 'node:assert/strict';

/** Only the requested layout setting and three exact English descriptions change. */
export function aidreamcapesHomeCampaignLayoutFields(content) {
  const data = content.sections.v2_main.settings.data;
  const index = data.homeExperience.blocks.findIndex(block => block.after === 'audience');
  assert(index >= 0 && data.benefits.length === 6 && data.more_sections[0].items.length === 6);
  assert.equal(data.ugc.formats[0].t, 'URL to Video');
  assert.equal(data.ugc.formats[1].t, 'Image to Video');
  assert.equal(data.ugc.formats[3].t, 'AI Video');
  const prefix = '/sections/v2_main/settings/data';
  return [
    { path: `${prefix}/homeExperience/blocks/${index}/presentation/contentLayout`, value: 'benefits-workflow' },
    { path: `${prefix}/ugc/formats/0/d`, value: 'Turn product URL into AI video for ads, social media and product demonstrations.upload photos and choose your creative direction create product video without arranging a shoot.' },
    { path: `${prefix}/ugc/formats/1/d`, value: 'Create AI videos from a single product photo. Add a description to guide the scene and movement, then generate product for ads, social posts and launches without a camera crew.' },
    { path: `${prefix}/ugc/formats/3/d`, value: 'Create product videos with AI presenters and generated. Choose a scene, refine your brief, compare shot versions and assemble a video for your product page or social channels.' },
    { path: '/contentContract/sourceRevision', value: 'aidreamcapes-home-campaign-layout-en-20261017' }
  ];
}
