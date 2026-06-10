import { defineConfig } from "vite";
import { resolve } from "node:path";
import { pages } from "./pages.config.mjs";

// One HTML entry per generated page (created by scripts/gen-pages.mjs before build).
const input = {};
for (const p of pages) {
  const name = p.slug === "index" ? "index" : p.slug;
  input[name] = resolve(process.cwd(), `${name}.html`);
}
input["404"] = resolve(process.cwd(), "404.html");

export default defineConfig({
  appType: "mpa",
  // jSquash's multithreaded codecs ship a Web Worker; ES-module workers are
  // required so Rollup can code-split them (avoids the iife build error).
  worker: { format: "es" },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // No inline modulepreload polyfill -> keeps a strict, inline-script-free CSP.
    modulePreload: { polyfill: false },
    rollupOptions: { input },
  },
  // jSquash/heic codecs locate their .wasm via import.meta.url, which Vite's dep
  // optimizer mangles — so exclude them. @imgly is the opposite: it fetches its
  // wasm at runtime from publicPath, and it has CommonJS deps (lodash, ndarray,
  // onnxruntime-web) that MUST be pre-bundled for their named/default exports to
  // resolve in dev — so it must NOT be excluded.
  optimizeDeps: {
    exclude: ["@jsquash/avif", "@jsquash/oxipng", "heic-to"],
  },
});
