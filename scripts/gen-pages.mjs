/* Generates one HTML entry per page from src/template.html + pages.config.mjs,
   plus robots.txt and sitemap.xml. Run before `vite build` (see package.json). */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SITE_URL, pages } from "../pages.config.mjs";

const root = process.cwd();
const template = readFileSync(join(root, "src/template.html"), "utf8");
const homeTemplate = readFileSync(join(root, "src/home.html"), "utf8");
const compressorTemplate = readFileSync(join(root, "src/compressor.html"), "utf8");
const bgTemplate = readFileSync(join(root, "src/bgremove.html"), "utf8");
const resizeTemplate = readFileSync(join(root, "src/resize.html"), "utf8");
const topdfTemplate = readFileSync(join(root, "src/topdf.html"), "utf8");
const pdftkTemplate = readFileSync(join(root, "src/pdftk.html"), "utf8");

const FMT = { jpg: "JPG", png: "PNG", webp: "WebP", avif: "AVIF" };
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pathFor = (slug) => (slug === "index" ? "/" : `/${slug}`);
const canonical = (slug) => SITE_URL + pathFor(slug);

function copyFor(p) {
  const toU = FMT[p.to];
  if (p.generic) {
    return {
      title: "Image Converter — HEIC, PNG, JPG, WebP & AVIF | Tools by Note Hoard",
      description:
        "Free online image converter. Convert HEIC, PNG, JPG, WebP and AVIF right in your browser — 100% private, no uploads, no sign-up. From Note Hoard.",
      h1: "Image Converter",
      intro:
        "Convert HEIC, PNG, JPG, WebP & AVIF in seconds — right in your browser. Your photos never leave your device.",
      breadcrumb: "Image Converter",
    };
  }
  const from = p.from;
  return {
    title: `${from} to ${toU} Converter — Free & Private | Tools by Note Hoard`,
    description: `Convert ${from} to ${toU} online for free. Fast, private, browser-based — no uploads, no watermarks, no sign-up. Batch convert and download as a ZIP. From Note Hoard.`,
    h1: `${from} to ${toU} Converter`,
    intro: `Convert ${from} images to ${toU} instantly, right in your browser. Free, unlimited and 100% private — your files never leave your device.`,
    breadcrumb: `${from} to ${toU}`,
  };
}

function faqFor(p) {
  const toU = FMT[p.to];
  if (p.generic) {
    return [
      ["Is this image converter free?", "Yes — completely free, with no limits, watermarks, or sign-up."],
      ["Are my images uploaded to a server?", "No. Every conversion runs entirely in your browser on your own device. Your images never leave your computer or phone."],
      ["What formats can I convert?", "Convert between HEIC, PNG, JPG, WebP and AVIF, and read GIF, BMP and TIFF. Just pick your output format."],
      ["Can I convert many images at once?", "Yes. Add as many as you like and download them individually or all together as a ZIP."],
      ["Does it work on iPhone and Android?", "Yes — it runs in any modern browser, including mobile Safari and Chrome."],
    ];
  }
  const from = p.from;
  const faq = [
    [`Is this ${from} to ${toU} converter free?`, "Yes — completely free, with no limits, watermarks, or sign-up required."],
    ["Are my files uploaded anywhere?", `No. Your ${from} files are converted to ${toU} right inside your browser — they never leave your device.`],
    [`How do I convert ${from} to ${toU}?`, `Drag your ${from} files into the box above (or tap Browse), and they'll be converted to ${toU} automatically. Download each one, or all at once as a ZIP.`],
    ["Does it work on mobile?", "Yes — it works in any modern browser on desktop, iPhone and Android."],
  ];
  if (from === "HEIC") {
    faq.push([
      "Why won't my iPhone HEIC photos open on other devices?",
      "iPhones save photos as HEIC to save space, but many apps and websites only accept JPG or PNG. Converting them here fixes that — privately, with no upload.",
    ]);
  }
  return faq;
}

function faqHtml(faq) {
  return faq
    .map(
      ([q, a]) =>
        `<details class="faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`
    )
    .join("\n      ");
}

function jsonLd(p, c, faq) {
  const blocks = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: c.h1,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any (web browser)",
      url: canonical(p.slug),
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "Note Hoard", url: "https://notehoard.com" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];
  const json = JSON.stringify(blocks).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function renderHome(p) {
  const title = "Tools by Note Hoard — Free, private browser tools";
  const description =
    "Free, private browser tools from Note Hoard. Convert HEIC, PNG, JPG, WebP & AVIF and more — 100% in your browser, with no uploads, no ads and no sign-up.";
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Tools by Note Hoard",
      url: SITE_URL,
      publisher: { "@type": "Organization", name: "Note Hoard", url: "https://notehoard.com" },
    },
  ];
  const json = JSON.stringify(ld).replace(/</g, "\\u003c");
  return homeTemplate
    .replaceAll("{{TITLE}}", esc(title))
    .replaceAll("{{DESCRIPTION}}", esc(description))
    .replaceAll("{{CANONICAL}}", canonical(p.slug))
    .replaceAll("{{OG_IMAGE}}", SITE_URL + "/assets/logo-main.png")
    .replace("{{JSONLD}}", `<script type="application/ld+json">${json}</script>`);
}

function renderTool(p) {
  const c = copyFor(p);
  const faq = faqFor(p);
  return template
    .replaceAll("{{TITLE}}", esc(c.title))
    .replaceAll("{{DESCRIPTION}}", esc(c.description))
    .replaceAll("{{H1}}", esc(c.h1))
    .replaceAll("{{INTRO}}", esc(c.intro))
    .replaceAll("{{BREADCRUMB}}", esc(c.breadcrumb))
    .replaceAll("{{CANONICAL}}", canonical(p.slug))
    .replaceAll("{{OG_IMAGE}}", SITE_URL + "/assets/logo-main.png")
    .replaceAll("{{FORMAT}}", p.to)
    .replace("{{FAQ}}", faqHtml(faq))
    .replace("{{JSONLD}}", jsonLd(p, c, faq));
}

function compressorCopy(p) {
  if (!p.target) {
    return {
      title: "Image Compressor — Shrink JPG, PNG & WebP | Tools by Note Hoard",
      description:
        "Free online image compressor. Reduce JPG, PNG and WebP file size right in your browser — 100% private, no uploads, no sign-up. Batch compress and download as a ZIP.",
      h1: "Image Compressor",
      intro:
        "Shrink JPG, PNG and WebP images right in your browser. Smaller files, same great quality — your photos never leave your device.",
      breadcrumb: "Image Compressor",
    };
  }
  const t = p.target;
  return {
    title: `Compress ${t} — Free & Private | Tools by Note Hoard`,
    description: `Compress ${t} images online for free. Reduce file size right in your browser — no uploads, no watermarks, no sign-up. Batch compress and download as a ZIP. From Note Hoard.`,
    h1: `Compress ${t}`,
    intro: `Make your ${t} files smaller, right in your browser. Fast, private and unlimited — your images never leave your device.`,
    breadcrumb: `Compress ${t}`,
  };
}

function compressorFaq(p) {
  const t = p.target;
  if (!t) {
    return [
      ["Is this image compressor free?", "Yes — completely free, with no limits, watermarks, or sign-up."],
      ["Are my images uploaded to a server?", "No. Compression runs entirely in your browser on your own device. Your images never leave your computer or phone."],
      ["Will compressing reduce the quality?", "JPG and WebP use a quality slider you control, so you choose the balance of size and quality. PNG files are optimized losslessly — smaller with no change to quality at all."],
      ["How much smaller will my files get?", "It depends on the image, but JPG and WebP photos often shrink by 40–70%. You'll see the exact savings for each file."],
      ["Can I compress many images at once?", "Yes. Add as many as you like and download them individually or all together as a ZIP."],
    ];
  }
  const faq = [
    [`Is this ${t} compressor free?`, "Yes — completely free, with no limits, watermarks, or sign-up required."],
    ["Are my files uploaded anywhere?", `No. Your ${t} files are compressed right inside your browser — they never leave your device.`],
  ];
  faq.push(
    t === "PNG"
      ? ["Will it reduce the quality?", "No — PNG files are optimized losslessly, so they get smaller with no change to image quality."]
      : [`Will compressing my ${t} reduce quality?`, `You control it with a quality slider, so you choose the balance between file size and quality.`]
  );
  faq.push(["Does it work on mobile?", "Yes — it works in any modern browser on desktop, iPhone and Android."]);
  return faq;
}

function renderCompressor(p) {
  const c = compressorCopy(p);
  const faq = compressorFaq(p);
  return compressorTemplate
    .replaceAll("{{TITLE}}", esc(c.title))
    .replaceAll("{{DESCRIPTION}}", esc(c.description))
    .replaceAll("{{H1}}", esc(c.h1))
    .replaceAll("{{INTRO}}", esc(c.intro))
    .replaceAll("{{BREADCRUMB}}", esc(c.breadcrumb))
    .replaceAll("{{CANONICAL}}", canonical(p.slug))
    .replaceAll("{{OG_IMAGE}}", SITE_URL + "/assets/logo-main.png")
    .replace("{{FAQ}}", faqHtml(faq))
    .replace("{{JSONLD}}", jsonLd(p, c, faq));
}

function bgCopy(p) {
  const h1 =
    p.slug === "remove-background-from-image" ? "Remove Background from Image"
    : p.slug === "remove-bg" ? "Remove Background (Remove BG)"
    : "Background Remover";
  return {
    title: `${h1} — Free & Private | Tools by Note Hoard`,
    description:
      "Free online background remover. Erase image backgrounds in your browser with on-device AI — no uploads, no watermarks, no sign-up. Download transparent PNGs. From Note Hoard.",
    h1,
    intro:
      "Remove the background from any image, right in your browser. Free, unlimited and 100% private — your photos never leave your device.",
    breadcrumb: h1,
  };
}

function bgFaq() {
  return [
    ["Is the background remover free?", "Yes — completely free, with no limits, watermarks, or sign-up."],
    ["Are my images uploaded to a server?", "No. The AI model runs entirely in your browser on your own device — your images never leave your computer or phone."],
    ["What do I get back?", "A PNG with a transparent background. You can also drop the subject onto a white or custom-color background before downloading."],
    ["Does it work on people, products and animals?", "Yes — it's a general-purpose model that handles people, products, animals and most clear subjects. Very fine details like wispy hair may not be perfect."],
    ["Why is there a one-time download?", "The AI model (~45MB) downloads once on first use, then it's cached so later images are instant. Nothing about your images is ever sent anywhere."],
  ];
}

function renderBg(p) {
  const c = bgCopy(p);
  const faq = bgFaq();
  return bgTemplate
    .replaceAll("{{TITLE}}", esc(c.title))
    .replaceAll("{{DESCRIPTION}}", esc(c.description))
    .replaceAll("{{H1}}", esc(c.h1))
    .replaceAll("{{INTRO}}", esc(c.intro))
    .replaceAll("{{BREADCRUMB}}", esc(c.breadcrumb))
    .replaceAll("{{CANONICAL}}", canonical(p.slug))
    .replaceAll("{{OG_IMAGE}}", SITE_URL + "/assets/logo-main.png")
    .replace("{{FAQ}}", faqHtml(faq))
    .replace("{{JSONLD}}", jsonLd(p, c, faq));
}

function resizeCopy(p) {
  if (p.slug === "resize-image") return {
    title: "Resize Image — Free & Private | Tools by Note Hoard",
    description: "Resize images online for free. Scale by pixels, percentage or social presets in your browser — high quality, batch, no uploads, no sign-up. From Note Hoard.",
    h1: "Resize Image", breadcrumb: "Resize Image",
    intro: "Resize images to any size or social preset, right in your browser. Batch, high-quality and 100% private — your photos never leave your device.",
  };
  if (p.slug === "crop-image") return {
    title: "Crop Image — Free & Private | Tools by Note Hoard",
    description: "Crop images online for free. Drag to frame any aspect ratio in your browser — no uploads, no watermarks, no sign-up. From Note Hoard.",
    h1: "Crop Image", breadcrumb: "Crop Image",
    intro: "Crop images to any aspect ratio, right in your browser. Drag to frame the perfect shot — free, private and instant.",
  };
  return {
    title: "Image Resizer & Cropper — Free & Private | Tools by Note Hoard",
    description: "Free online image resizer and cropper. Resize by pixels, percentage or social presets, or crop to any aspect ratio — all in your browser, no uploads, no sign-up. From Note Hoard.",
    h1: "Resize & Crop", breadcrumb: "Resize & Crop",
    intro: "Resize and crop your images right in your browser — by exact size, percentage, or a social preset. Free, batch and 100% private.",
  };
}

function resizeFaq() {
  return [
    ["Is this tool free?", "Yes — completely free, with no limits, watermarks, or sign-up."],
    ["Are my images uploaded to a server?", "No. Resizing and cropping happen entirely in your browser — your images never leave your device."],
    ["Will resizing blur my images?", "No — it uses a high-quality Lanczos resampler (the kind pro tools use), so downscaled images stay sharp."],
    ["Which social media sizes are included?", "Presets for Instagram (square, portrait, story/reel), YouTube thumbnails, LinkedIn, Pinterest and X."],
    ["Can I resize many images at once?", "Yes — drop a whole batch into Resize and download them individually or as a ZIP. Crop works one image at a time."],
  ];
}

function renderResize(p) {
  const c = resizeCopy(p);
  const faq = resizeFaq();
  return resizeTemplate
    .replaceAll("{{TITLE}}", esc(c.title))
    .replaceAll("{{DESCRIPTION}}", esc(c.description))
    .replaceAll("{{H1}}", esc(c.h1))
    .replaceAll("{{INTRO}}", esc(c.intro))
    .replaceAll("{{BREADCRUMB}}", esc(c.breadcrumb))
    .replaceAll("{{CANONICAL}}", canonical(p.slug))
    .replaceAll("{{OG_IMAGE}}", SITE_URL + "/assets/logo-main.png")
    .replaceAll("{{TAB}}", p.tab === "crop" ? "crop" : "resize")
    .replace("{{FAQ}}", faqHtml(faq))
    .replace("{{JSONLD}}", jsonLd(p, c, faq));
}

function topdfCopy(p) {
  if (p.from) {
    const t = p.from;
    return {
      title: `${t} to PDF — Free & Private | Tools by Note Hoard`,
      description: `Convert ${t} to PDF online for free. Combine ${t} images into a single PDF in your browser — reorder pages, no uploads, no sign-up. From Note Hoard.`,
      h1: `${t} to PDF`, breadcrumb: `${t} to PDF`,
      intro: `Combine ${t} images into a single PDF, right in your browser. Reorder pages, set the size, and download — free, private and instant.`,
    };
  }
  return {
    title: "Images to PDF — Free & Private | Tools by Note Hoard",
    description: "Free online images-to-PDF converter. Combine JPG, PNG, WebP and HEIC images into one PDF in your browser — reorder pages, no uploads, no sign-up. From Note Hoard.",
    h1: "Images to PDF", breadcrumb: "Images to PDF",
    intro: "Combine JPG, PNG, WebP or HEIC images into a single PDF, right in your browser. Reorder the pages, set the size, and download — free and 100% private.",
  };
}

function topdfFaq() {
  return [
    ["Is this tool free?", "Yes — completely free, with no limits, watermarks, or sign-up."],
    ["Are my images uploaded to a server?", "No. The PDF is built entirely in your browser — your images never leave your device."],
    ["Can I reorder the pages?", "Yes — use the up/down buttons on each image to set the page order, and remove any you don't want."],
    ["What image formats can I use?", "JPG, PNG, WebP and HEIC (iPhone photos), plus GIF and BMP."],
    ["Can I choose the page size?", "Yes — fit each page to its image, or use A4 / US Letter with an orientation and margin."],
  ];
}

function renderTopdf(p) {
  const c = topdfCopy(p);
  const faq = topdfFaq();
  return topdfTemplate
    .replaceAll("{{TITLE}}", esc(c.title))
    .replaceAll("{{DESCRIPTION}}", esc(c.description))
    .replaceAll("{{H1}}", esc(c.h1))
    .replaceAll("{{INTRO}}", esc(c.intro))
    .replaceAll("{{BREADCRUMB}}", esc(c.breadcrumb))
    .replaceAll("{{CANONICAL}}", canonical(p.slug))
    .replaceAll("{{OG_IMAGE}}", SITE_URL + "/assets/logo-main.png")
    .replace("{{FAQ}}", faqHtml(faq))
    .replace("{{JSONLD}}", jsonLd(p, c, faq));
}

function pdftkCopy(p) {
  const map = {
    "merge-pdf": ["Merge PDF", "Combine multiple PDFs into one, right in your browser. Reorder the files, then download — free, private and instant."],
    "split-pdf": ["Split PDF", "Extract pages or split a PDF into separate files, right in your browser. Free, private and instant."],
    "rotate-pdf": ["Rotate PDF", "Rotate PDF pages 90°, 180° or 270°, right in your browser. Free, private and instant."],
    "compress-pdf": ["Compress PDF", "Make PDFs smaller, right in your browser. Free and private — your files never leave your device."],
  };
  if (map[p.slug]) {
    const [h1, intro] = map[p.slug];
    return {
      title: `${h1} — Free & Private | Tools by Note Hoard`,
      description: `${h1} online for free in your browser — no uploads, no watermarks, no sign-up. From Note Hoard.`,
      h1, breadcrumb: h1, intro,
    };
  }
  return {
    title: "PDF Toolkit — Merge, Split, Rotate & Compress | Tools by Note Hoard",
    description: "Free online PDF toolkit. Merge, split, rotate and compress PDF files in your browser — no uploads, no watermarks, no sign-up. From Note Hoard.",
    h1: "PDF Toolkit", breadcrumb: "PDF Toolkit",
    intro: "Merge, split, rotate and compress PDFs right in your browser. Free, unlimited and 100% private — your files never leave your device.",
  };
}

function pdftkFaq() {
  return [
    ["Is this PDF toolkit free?", "Yes — completely free, with no limits, watermarks, or sign-up."],
    ["Are my PDFs uploaded to a server?", "No. Everything runs entirely in your browser — your PDFs never leave your device."],
    ["What can I do with it?", "Merge several PDFs into one, extract or split pages, rotate pages, and compress PDFs to a smaller size."],
    ["How does compression work?", "Lossless mode re-saves the PDF efficiently and keeps text selectable. Strong mode re-renders pages to images — much smaller for scans, but text becomes non-selectable."],
    ["Is there a file-size or page limit?", "No hard limit — it's bounded only by your device's memory, since everything runs locally."],
  ];
}

function renderPdftk(p) {
  const c = pdftkCopy(p);
  const faq = pdftkFaq();
  return pdftkTemplate
    .replaceAll("{{TITLE}}", esc(c.title))
    .replaceAll("{{DESCRIPTION}}", esc(c.description))
    .replaceAll("{{H1}}", esc(c.h1))
    .replaceAll("{{INTRO}}", esc(c.intro))
    .replaceAll("{{BREADCRUMB}}", esc(c.breadcrumb))
    .replaceAll("{{CANONICAL}}", canonical(p.slug))
    .replaceAll("{{OG_IMAGE}}", SITE_URL + "/assets/logo-main.png")
    .replaceAll("{{TAB}}", p.tab || "merge")
    .replace("{{FAQ}}", faqHtml(faq))
    .replace("{{JSONLD}}", jsonLd(p, c, faq));
}

let count = 0;
for (const p of pages) {
  const html =
    p.type === "home" ? renderHome(p)
    : p.type === "compressor" ? renderCompressor(p)
    : p.type === "bgremove" ? renderBg(p)
    : p.type === "resize" ? renderResize(p)
    : p.type === "topdf" ? renderTopdf(p)
    : p.type === "pdftk" ? renderPdftk(p)
    : renderTool(p);
  const file = p.slug === "index" ? "index.html" : `${p.slug}.html`;
  writeFileSync(join(root, file), html);
  count++;
}

/* 404 page (also a Vite entry) */
const notFound = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page not found — Tools by Note Hoard</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" href="/assets/logo-main.png" />
  <link rel="stylesheet" href="/src/styles.css" />
  <script src="/theme-init.js"></script>
</head>
<body>
  <main class="notfound">
    <h1>404</h1>
    <p>We couldn't find that page. The tool you're after might have moved.</p>
    <a class="btn btn-primary" href="/">Back to the tools</a>
  </main>
</body>
</html>
`;
writeFileSync(join(root, "404.html"), notFound);

/* robots.txt + sitemap.xml */
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(root, "public/robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
);
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  pages
    .map((p) => `  <url><loc>${canonical(p.slug)}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n") +
  `\n</urlset>\n`;
writeFileSync(join(root, "public/sitemap.xml"), sitemap);

console.log(`gen-pages: wrote ${count} pages + 404.html, robots.txt, sitemap.xml`);
