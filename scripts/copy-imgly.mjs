/* Self-host the @imgly/background-removal assets.
   The data package ships every model + runtime (~356MB). We copy only what the
   background remover actually uses: the smallest model + the CPU ONNX runtimes,
   plus resources.json, into public/imgly/ (served same-origin, no CDN at runtime).
   Pinned to @imgly/background-removal(-data) 1.4.5 — model keys: small | medium. */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dataDir = join(root, "node_modules/@imgly/background-removal-data/dist");
const outDir = join(root, "public/imgly");
const manifest = join(dataDir, "resources.json");

if (!existsSync(manifest)) {
  console.error("[copy-imgly] @imgly/background-removal-data not found — run `npm install` first.");
  process.exit(1);
}

const resources = JSON.parse(readFileSync(manifest, "utf8"));

// Ship the small model (≈42MB) + the CPU ORT runtimes it may pick. (WebGPU/jsep
// + threaded variants are omitted; the tool runs single-threaded CPU, so no
// cross-origin-isolation headers are required.)
const KEYS = [
  "/models/small",
  "/onnxruntime-web/ort-wasm.wasm",
  "/onnxruntime-web/ort-wasm-threaded.wasm",
  "/onnxruntime-web/ort-wasm-simd.wasm",
  "/onnxruntime-web/ort-wasm-simd-threaded.wasm",
];

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "resources.json"), JSON.stringify(resources));

let files = 0;
let bytes = 0;
for (const key of KEYS) {
  const entry = resources[key];
  if (!entry) {
    console.warn(`[copy-imgly] key missing from resources.json: ${key}`);
    continue;
  }
  for (const chunk of entry.chunks) {
    copyFileSync(join(dataDir, chunk.hash), join(outDir, chunk.hash));
    files++;
    bytes += chunk.offsets[1] - chunk.offsets[0];
  }
}
console.log(
  `[copy-imgly] copied ${files} chunks (${(bytes / 1048576).toFixed(1)}MB) + resources.json -> public/imgly`
);
