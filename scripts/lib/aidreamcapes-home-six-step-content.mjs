import assert from 'node:assert/strict';

/** Sparse edits to the current Aidreamcapes homepage relational owner. */
export function aidreamcapesHomeSixStepFields(content) {
  const data = content.sections.v2_main.settings.data;
  const index = data.homeExperience.blocks.findIndex(block => block.after === 'audience');
  assert(index >= 0 && data.benefits.length === 6 && data.more_sections[0].items.length === 6);
  const title = 'AI UGC Video and Image Ads Generator | AivideosUGC';
  const description = 'Turn product URL, image, or prompt into authentic, high-converting UGC video ads in minutes with Ai video agent and Ai actors ,ready-to-use video templates.';
  const prefix = '/sections/v2_main/settings/data';
  const workflow = [
    {t:'Add your product',d:'Upload a product photo or import a public product URL. Review the photos and details you want to use in your AI video.'},
    {t:'Choose a scene and presenter',d:'Preview product scenes and choose an AI presenter when your video needs someone to introduce or demonstrate the product.'},
    {t:'Write your brief and creative direction',d:'Describe your audience, product benefits and creative idea. Choose the tone, scene, aspect ratio and available duration.'},
    {t:'Save your draft and refine the storyboard',d:'Keep an editable draft in your Library. Review the shot sequence, visuals and dialogue before generating your selected shots.'},
    {t:'Generate shots and assemble your video',d:'Check the credit estimate, generate selected shots and compare versions. Assemble your preferred clips and review supported captions.'},
    {t:'Review and download',d:'Preview the finished video and check your product details and voiceover. Download it for ads, social media or your product page.'}
  ];
  const benefits = [
    {t:'Start with your own product',d:'Bring a photo or [product URL](/ai-video-generation/url-to-video). Keep your product details at the heart of the video.',icon:'sparkle'},
    {t:'Find the right scene and voice',d:'Explore product scenes and [AI presenters](/ai-video-generation/ai-actors) to find a style that suits your brand.',icon:'users'},
    {t:'Make your creative idea clear',d:'Give your audience a clear message. Set the benefits, tone and visual direction in one product brief.',icon:'play'},
    {t:'Keep control of the storyboard',d:'Save your draft, then refine each shot and line of dialogue. Your ideas stay editable before generation.',icon:'shield'},
    {t:'Build the version you prefer',d:'Generate the shots you choose, compare alternatives and assemble your preferred clips into one video.',icon:'layers'},
    {t:'Prepare content for your channels',d:'Review your product video before downloading. Reuse your product assets for [AI product images](/ai-image-generation) too.',icon:'refresh'}
  ];
  const visuals = [
    {kind:'product',media:['m01'],label:'Product photo',detail:'Your starting point',preview:'Preview step'},
    {kind:'presenter',media:['m02','m08'],label:'Scene + presenter',detail:'Choose your style',preview:'Preview step'},
    {kind:'brief',media:['m01'],label:'Creative brief',detail:'Introduce the serum to skincare shoppers. Show the bottle and dropper in a calm, clear product demonstration.',preview:'Preview step'},
    {kind:'storyboard',media:['m01','m02','m01'],label:'Editable storyboard',detail:'Product · Presenter · Details',preview:'Preview step'},
    {kind:'assembly',media:['m01','m02','m01'],label:'Selected clips',detail:'Compare · Arrange · Assemble',preview:'Preview step'},
    {kind:'review',media:['m02'],label:'Review your video',detail:'Preview before downloading',preview:'Preview step'}
  ];
  const fields = [
    {path:'/seo/title',value:title},
    {path:'/seo/keywords',value:'AI UGC ads,AI UGC video ads,AI UGC image ads,AI UGC ad Generator,AI Generated UGC ads,AI Actors ads'},
    {path:'/seo/description',value:description},
    {path:'/seo/twitterDescription',value:description},
    {path:`${prefix}/homeExperience/blocks/${index}/presentation/workflowVisuals`,value:visuals},
    {path:`${prefix}/homeExperience/blocks/${index}/copy/t001`,value:'From product to finished content'},
    {path:`${prefix}/benefitsLead`,value:'Bring your product, shape the story and choose the clips you want to share. Keep your creative direction in one workspace.'},
    {path:`${prefix}/more_sections/0/lead`,value:'Follow six clear steps, from your product photo or URL to an editable storyboard and a finished AI product video.'},
    {path:'/contentContract/sourceRevision',value:'aidreamcapes-home-six-step-visuals-en-20261017'}
  ];
  // Titles and descriptions remain owned by their original canonical page fields.
  for(const [i,item] of workflow.entries())for(const key of ['t','d'])fields.push({path:`${prefix}/more_sections/0/items/${i}/${key}`,value:item[key]});
  for(const [i,item] of benefits.entries())for(const key of ['t','d','icon'])fields.push({path:`${prefix}/benefits/${i}/${key}`,value:item[key]});
  const graph = content.seo.jsonLd?.['@graph'];
  assert(Array.isArray(graph));
  const pageIndex = graph.findIndex(node => node['@type'] === 'WebPage');assert(pageIndex>=0);
  fields.push({path:`/seo/jsonLd/@graph/${pageIndex}/name`,value:title},{path:`/seo/jsonLd/@graph/${pageIndex}/description`,value:description});
  return fields;
}
