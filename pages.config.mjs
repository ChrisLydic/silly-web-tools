// Site config + the list of pages to generate.
// Change SITE_URL to your real domain before deploying (used for canonical URLs,
// Open Graph tags, robots.txt and sitemap.xml).
export const SITE_URL = "https://tools.notehoard.com";

// `to` must be one of: jpg | png | webp | avif  (the preselected output format).
// `from` is for SEO copy only — every page still accepts any supported input.
export const pages = [
  { slug: "index", type: "home" },
  { slug: "image-converter", generic: true, to: "jpg" },
  { slug: "image-compressor", type: "compressor" },
  { slug: "compress-jpg", type: "compressor", target: "JPG" },
  { slug: "compress-png", type: "compressor", target: "PNG" },
  { slug: "compress-webp", type: "compressor", target: "WebP" },
  { slug: "background-remover", type: "bgremove" },
  { slug: "remove-background-from-image", type: "bgremove" },
  { slug: "remove-bg", type: "bgremove" },
  { slug: "image-resizer", type: "resize", tab: "resize" },
  { slug: "resize-image", type: "resize", tab: "resize" },
  { slug: "crop-image", type: "resize", tab: "crop" },
  { slug: "images-to-pdf", type: "topdf" },
  { slug: "jpg-to-pdf", type: "topdf", from: "JPG" },
  { slug: "png-to-pdf", type: "topdf", from: "PNG" },
  { slug: "pdf-toolkit", type: "pdftk", tab: "merge" },
  { slug: "merge-pdf", type: "pdftk", tab: "merge" },
  { slug: "split-pdf", type: "pdftk", tab: "split" },
  { slug: "rotate-pdf", type: "pdftk", tab: "rotate" },
  { slug: "compress-pdf", type: "pdftk", tab: "compress" },
  { slug: "heic-to-jpg", from: "HEIC", to: "jpg" },
  { slug: "heic-to-png", from: "HEIC", to: "png" },
  { slug: "heic-to-webp", from: "HEIC", to: "webp" },
  { slug: "png-to-jpg", from: "PNG", to: "jpg" },
  { slug: "jpg-to-png", from: "JPG", to: "png" },
  { slug: "jpg-to-webp", from: "JPG", to: "webp" },
  { slug: "webp-to-jpg", from: "WebP", to: "jpg" },
  { slug: "webp-to-png", from: "WebP", to: "png" },
  { slug: "png-to-webp", from: "PNG", to: "webp" },
  { slug: "jpg-to-avif", from: "JPG", to: "avif" },
];
