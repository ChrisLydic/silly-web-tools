# Tools by Note Hoard

Free, **100% client-side** file tools. Files are decoded, processed and zipped
entirely in the visitor's browser — nothing is ever uploaded. The homepage is the
tools hub; current tools are the **Image Converter**, **Image Compressor**, and
**Background Remover**, each with format/use-case-specific SEO landing pages.

> **License:** because the Background Remover uses `@imgly/background-removal`
> (AGPL-3.0), this hub is distributed under **AGPL-3.0**.

> **Brand assets:** the Note Hoard logo (`public/assets/logo-main.png`) is the
> copyrighted work of its owner and is **not** licensed under AGPL — all rights to
> it are reserved. The "Note Hoard" name and branding are likewise reserved. Please
> don't reuse the logo or name in forks or derivative works in a way that implies
> affiliation with, or endorsement by, Note Hoard.

> **Install note:** `@imgly/background-removal` + `-data` are pinned to **1.4.5**
> (the matching, self-hostable npm pair). Run a clean `npm install` so the pin
> applies; `npm run assets` then copies just the small model + CPU ORT runtimes
> (~81MB) into `public/imgly/` — no CDN at runtime.

Built as a static **Vite** multi-page site, all dependencies **self-hosted**
(no third-party requests at runtime), shipped in a hardened **nginx** Docker image.

## How conversion works

| Path | Engine | Loaded |
|------|--------|--------|
| JPG / PNG / WebP | native Canvas API | always (no dependency) |
| HEIC / HEIF input | `heic-to` (libheif → WASM, inlined) | lazily, on first HEIC |
| AVIF output | Canvas where supported, else `@jsquash/avif` (libavif → WASM) | lazily |
| Download all | `JSZip` | lazily |

## Local development

```bash
npm install
npm run dev        # generates pages, starts Vite dev server
npm run build      # generates pages -> dist/
npm run preview    # serve the built dist/ locally
```

`npm run gen` (run automatically by dev/build) creates the per-page HTML,
`robots.txt` and `sitemap.xml` from `src/template.html` + `pages.config.mjs`.

## Adding / editing landing pages

Edit **`pages.config.mjs`** — add an entry like:

```js
{ slug: "tiff-to-jpg", from: "TIFF", to: "jpg" }
```

`slug` becomes the URL (`/tiff-to-jpg`), `to` is the preselected output format
(`jpg|png|webp|avif`), and `from` drives the SEO copy. Title, description, H1,
FAQ, JSON-LD, the sitemap entry and the Vite build input are all generated
automatically. Set **`SITE_URL`** in the same file to your real domain so
canonical URLs, Open Graph tags, `robots.txt` and `sitemap.xml` are correct.

Build & run locally with Docker:

```bash
docker build -t tools-by-note-hoard .
docker run --rm -p 8080:80 tools-by-note-hoard   # http://localhost:8080
```

## Project structure

```
tools-by-note-hoard/
├── pages.config.mjs       # SITE_URL + the list of pages to generate
├── src/
│   ├── template.html      # shared page template ({{TOKENS}})
│   ├── app.js             # conversion engine + interactions
│   └── styles.css         # theming (light/dark) + components
├── public/
│   ├── theme-init.js      # pre-paint theme (no FOUC, CSP-safe)
│   └── assets/            # logo-main.png, fonts
├── scripts/gen-pages.mjs  # template + config -> pages, robots.txt, sitemap.xml
├── vite.config.mjs        # MPA inputs, WASM-safe optimizeDeps
├── Dockerfile             # node build -> nginx runtime
└── nginx.conf             # security headers, caching, clean URLs, wasm MIME
```
