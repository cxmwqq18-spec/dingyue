import { existsSync } from "node:fs";

const assetRoot = "/assets/sites/site_aidreamcapes/ecommerce-main-image-v1/ecommerce-main-image";

function image(file, alt, width = 1200, height = 1500, loading = "lazy", fetchPriority = "low") {
  return {
    src: `${assetRoot}/${file}`,
    alt,
    width,
    height,
    loading,
    fetchPriority,
    sizes: "(max-width: 760px) 92vw, (max-width: 1200px) 46vw, 620px"
  };
}

export function aidreamcapesEcommerceMainImageContent() {
  const productImage = image(
    "source-input.webp",
    "Unbranded ceramic travel mug on a neutral surface for a product reference",
    1880,
    3344,
    "eager",
    "high"
  );
  const outputImage = image(
    "hero-output.webp",
    "Clean ecommerce main image of a matte ceramic travel mug on a neutral studio background",
    3344,
    1880,
    "eager",
    "auto"
  );

  const examples = [
    ["Front-facing product shot", "Keep the product large, clear, and easy to recognize.", "example-01.webp", "Front-facing product image of a matte ceramic travel mug with a clear silhouette"],
    ["Soft grounded shadow", "Give the mug a natural place to sit without hiding its shape.", "example-02.webp", "Ceramic travel mug with a soft grounded shadow on a clean studio surface"],
    ["Three-quarter view", "Use another angle to show the handle and ceramic finish.", "example-03.webp", "Three-quarter product view showing the travel mug handle and ceramic finish"],
    ["Material detail", "Move closer when the surface or opening helps shoppers decide.", "example-04.webp", "Close view of the travel mug rim and matte ceramic surface"],
    ["Bundle presentation", "Show the mug with its matching lid accessory when the set matters.", "example-05.webp", "Bundle image showing the travel mug with its matching lid accessory"],
    ["Scale cue", "Add a hand only when it helps explain the everyday size.", "example-06.webp", "Hand-held scale reference for an unbranded ceramic travel mug"],
    ["Square-ready crop", "Leave enough room to adapt the image for a store listing.", "example-07.webp", "Square-ready product crop of a matte ceramic travel mug on a neutral background"]
  ].map(([title, body, file, alt], index) => {
    const dimensions = [[3344, 1880], [3344, 1880], [3344, 1880], [1880, 1880], [3344, 1880], [1880, 3344], [1880, 1880]][index];
    return { title, body, image: image(file, alt, ...dimensions) };
  });

  return {
    subject: "matte ceramic travel mug",
    layoutVariant: "ecommerce-main-image-detail",
    schema: {
      applicationName: "Aidreamcapes Ecommerce Main Image Generator",
      applicationSubCategory: "Product image creation",
      serviceType: "AI product image creation"
    },
    seo: {
      title: "AI Ecommerce Main Image Generator | Aidreamcapes",
      description: "Create a clean ecommerce main image from one product reference. Keep the product clear, centered, and ready for Shopify, marketplace, and DTC pages with Aidreamcapes.",
      keywords: "AI ecommerce images, ecommerce main image generator, product listing image generator, AI product photography, Shopify product images, marketplace product images, product hero image",
      canonicalPath: "/ai-image-generation/ecommerce-main-image",
      canonical: "https://aidreamcapes.com/ai-image-generation/ecommerce-main-image",
      twitterDescription: "Create clean ecommerce main images from one product photo with Aidreamcapes.",
      ogImage: `${assetRoot}/og.webp`,
      ogImageAlt: "Product photo turned into a clear ecommerce main image for an online store"
    },
    hero: {
      eyebrow: "For your online store",
      title: "Create ecommerce main images that put the product first.",
      body: "Turn one clear product photo into a clean main image for your online store. Choose a simple background, show the right size, and keep the product easy to see.",
      primaryCta: "Start creating",
      primaryCtaHref: "/app/create?tool_id=image_generator",
      secondaryCta: "View examples",
      secondaryCtaHref: "#examples",
      availabilityNote: "Use product photos you own or have permission to use. Look over every result before you put it in your store.",
      rightsCopy: "Before you publish, compare the shape, color, finish, and visible details with the original photo.",
      imageNote: "reference → store image",
      productLabel: "Original product photo",
      outputLabel: "Image for your store",
      productImage,
      outputImage
    },
    proof: {
      eyebrow: "Make the first image easier to understand",
      title: "What a good product image should show",
      intro: "The first image should answer the shopper's first questions quickly: What is it, what does it look like, and can I trust what I see?",
      cards: [
        { title: "Show the product first", body: "Make the item the clearest thing in the image." },
        { title: "Keep the details clear", body: "Show the shape, colors, materials, and important features accurately." },
        { title: "Show a natural size", body: "Add context only when it helps shoppers understand how big the product is." },
        { title: "Leave room to adjust", body: "Make an image that is easy to resize for your store or marketplace." }
      ]
    },
    workflow: {
      eyebrow: "A simple way to get started",
      title: "From product photo to an image for your store",
      intro: "A quick review helps you turn the first result into an image you can feel good about using in your store.",
      steps: [
        { title: "Choose a product photo", body: "Upload a clear photo that you own or have permission to use." },
        { title: "Choose the look", body: "Pick the background, lighting, framing, and style you want." },
        { title: "Keep the product accurate", body: "Make sure the shape, color, finish, and labels match the original photo." },
        { title: "Check the result", body: "Look for odd edges, shadows, size, or extra details that do not belong." },
        { title: "Choose the final image", body: "Choose the version that fits your store or marketplace." }
      ]
    },
    directions: {
      eyebrow: "Ways to show your product",
      title: "Choose the right way to show your product",
      intro: "Use one product photo to plan a clear main image, close-up, size example, or simple everyday scene.",
      cards: [
        { title: "Simple product photo", body: "Place the product on a simple background so shoppers can recognize it quickly." },
        { title: "Soft shadow", body: "Add a gentle shadow to make the product feel naturally placed." },
        { title: "Close-up detail", body: "Show a useful feature up close when it helps answer a shopper's question." },
        { title: "Everyday use", body: "Show the product in use only when the scene helps explain its size or purpose." }
      ]
    },
    examples: {
      eyebrow: "Product examples",
      title: "See simple ways to show your product",
      intro: "Explore clear product photos, close-up details, everyday scenes, and flexible versions for your online store.",
      items: examples
    },
    formats: {
      eyebrow: "Use it where customers shop",
      title: "Where you can use the image",
      intro: "Create one clear product image, then adjust it for the place where customers will see it.",
      items: [
        { title: "Marketplace listings", body: "Use a clear product image and check the latest rules for the marketplace." },
        { title: "Shopify product pages", body: "Create a consistent first image for each product page." },
        { title: "Online store homepages", body: "Place a clear product image near the top of your store or landing page." },
        { title: "Product catalogs", body: "Keep the same look across a group of products." }
      ]
    },
    checklist: {
      eyebrow: "Before you start",
      title: "Get the product details ready",
      intro: "A good result starts with the right product information and a clear place to use the image.",
      items: [
        "Use a product photo you own or have permission to use.",
        "Make sure the shape, colors, size, and included accessories are correct.",
        "Check the labels, logos, edges, reflections, and shadows before publishing.",
        "Read the latest image rules for the marketplace or store where you will use it."
      ]
    },
    faq: {
      eyebrow: "Helpful answers",
      title: "Frequently asked questions",
      intro: "Use these answers as a quick guide before you add a product image to your store.",
      items: [
        { question: "What is an ecommerce main image?", answer: "It is the first product image shoppers see in a listing or product page. It should make the item clear, recognizable, and easy to understand." },
        { question: "Can I use my existing product photo?", answer: "Yes. Use a clear product photo that you own or have permission to use." },
        { question: "Will the product stay accurate?", answer: "It can help keep the shape, color, material, and visible details close to your photo, but check every result before publishing." },
        { question: "Will it meet every marketplace's image rules?", answer: "Use the result as a starting point and check the latest image rules for the marketplace or store where you will use it." },
        { question: "Can I make different image shapes?", answer: "Yes. Ask for a square, vertical, or horizontal layout when your store or marketplace needs a different shape." },
        { question: "What should I have ready?", answer: "Have one clear product photo, accurate product information, and any brand or labeling rules that must stay unchanged." }
      ]
    },
    finalCta: {
      eyebrow: "Ready to make your product clearer",
      title: "Create your next product image",
      body: "Start with one product photo and make your store's first impression clearer.",
      cta: "Start creating",
      ctaHref: "/app/create?tool_id=image_generator",
      microcopy: "Compare every result with the original product and the latest rules for the place where you will use it."
    }
  };
}

export function validateAidreamcapesEcommerceMainImageContent({ requireAssets = false } = {}) {
  const content = aidreamcapesEcommerceMainImageContent();
  if (content.examples.items.length !== 7) throw new Error("Ecommerce Main Image requires seven example images.");
  if (content.faq.items.length !== 6) throw new Error("Ecommerce Main Image requires six FAQ items.");
  if (!content.seo.canonicalPath.startsWith("/ai-image-generation/")) throw new Error("Ecommerce Main Image canonical path is outside the image directory.");
  if (requireAssets) {
    const images = [content.hero.productImage, content.hero.outputImage, ...content.examples.items.map((item) => item.image)];
    for (const item of images) if (!existsSync(`public${item.src}`)) throw new Error(`Missing Ecommerce Main Image asset: ${item.src}`);
  }
  return content;
}
