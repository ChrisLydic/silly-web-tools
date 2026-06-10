/* ===========================================================================
   Tools by Note Hoard — Image Converter
   100% client-side. Files never leave the browser.

   - JPG / PNG / WebP : native Canvas API (no dependency)
   - HEIC / HEIF in   : heic-to (libheif WASM, bundled), lazy-loaded
   - AVIF out         : Canvas where supported, else @jsquash/avif (libavif WASM)
   - Download all      : JSZip
   All dependencies are bundled & self-hosted — no third-party requests at runtime.
   =========================================================================== */

import { toast } from "./shell.js";

const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };
const EXT = { jpg: "jpg", png: "png", webp: "webp", avif: "avif" };
const VALID = ["jpg", "png", "webp", "avif"];

const state = { format: "jpg", quality: 82, stripMeta: true, items: [], runId: 0 };

// "converter" (change format) or "compressor" (keep format, shrink). Set in init().
let TOOL = "converter";

/* Lazy, code-split, self-hosted libraries (only fetched when first needed). */
let _heic, _avif, _jszip, _oxipng;
const ensureHeic = () => (_heic ??= import("heic-to"));
const ensureAvif = () => (_avif ??= import("@jsquash/avif"));
const ensureJSZip = () => (_jszip ??= import("jszip"));
const ensureOxipng = () => (_oxipng ??= import("@jsquash/oxipng"));

const SVG = {
  image: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
  check: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  alert: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  download: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
};

const $ = (sel) => document.querySelector(sel);

const isHeic = (file) =>
  /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

function srcLabel(file) {
  if (isHeic(file)) return "HEIC";
  const n = file.name.toLowerCase();
  const t = file.type;
  if (/png/.test(t) || /\.png$/.test(n)) return "PNG";
  if (/jpe?g/.test(t) || /\.jpe?g$/.test(n)) return "JPG";
  if (/webp/.test(t) || /\.webp$/.test(n)) return "WebP";
  if (/avif/.test(t) || /\.avif$/.test(n)) return "AVIF";
  if (/gif/.test(t) || /\.gif$/.test(n)) return "GIF";
  if (/bmp/.test(t) || /\.bmp$/.test(n)) return "BMP";
  if (/tiff?/.test(t) || /\.tiff?$/.test(n)) return "TIFF";
  return (n.split(".").pop() || "IMG").toUpperCase();
}

const baseName = (name) => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
};

function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

const sameFormat = (file, fmt) => {
  const lbl = srcLabel(file).toLowerCase();
  return fmt === "jpg" ? lbl === "jpg" : lbl === fmt;
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((res) => canvas.toBlob((b) => res(b), type, quality));

async function toBitmap(blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(blob);
  }
}

async function convert(file, fmt, quality) {
  const heic = isHeic(file);

  if (heic && (fmt === "jpg" || fmt === "png")) {
    const { heicTo } = await ensureHeic();
    return await heicTo({
      blob: file,
      type: MIME[fmt],
      quality: fmt === "jpg" ? quality / 100 : undefined,
    });
  }

  let bitmap;
  if (heic) {
    const { heicTo } = await ensureHeic();
    const png = await heicTo({ blob: file, type: "image/png" });
    bitmap = await toBitmap(png);
  } else {
    bitmap = await toBitmap(file);
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (fmt === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  if (bitmap.close) bitmap.close();

  if (fmt === "avif") {
    let blob = await canvasToBlob(canvas, "image/avif", quality / 100);
    if (!blob || blob.type !== "image/avif") {
      const { encode } = await ensureAvif();
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const buf = await encode(data, { quality: Math.round(quality) });
      blob = new Blob([buf], { type: "image/avif" });
    }
    return blob;
  }

  const blob = await canvasToBlob(canvas, MIME[fmt], quality / 100);
  if (!blob) throw new Error("This browser could not encode " + fmt.toUpperCase());
  return blob;
}

/* ---- Compressor mode: keep the source format, just make it smaller ---- */
function compressorTarget(file) {
  const lbl = srcLabel(file).toLowerCase();
  if (lbl === "jpg") return "jpg";
  if (lbl === "png") return "png";
  if (lbl === "webp") return "webp";
  return null; // unsupported input for the compressor
}

async function compress(file, quality) {
  const fmt = compressorTarget(file);
  if (!fmt) throw new Error("Unsupported file type");

  let out;
  if (fmt === "png") {
    // Lossless PNG optimisation (OxiPNG). Falls back to the original on failure.
    try {
      const { optimise } = await ensureOxipng();
      const buf = await file.arrayBuffer();
      const opt = await optimise(buf, { level: 3 });
      out = new Blob([opt], { type: "image/png" });
    } catch (e) {
      console.error(e);
      out = file;
    }
  } else {
    const bitmap = await toBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (fmt === "jpg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    if (bitmap.close) bitmap.close();
    out = await canvasToBlob(canvas, MIME[fmt], quality / 100);
  }
  if (!out) throw new Error("Could not compress image");
  // Never hand back a larger file than the original.
  return out.size >= file.size ? file : out;
}

async function runAll() {
  const runId = ++state.runId;
  const { format, quality, stripMeta } = state;

  for (const it of state.items) {
    if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    it.outUrl = null;
    it.blob = null;
    it.error = null;
    it.status = "pending";
  }
  render();

  for (const it of state.items) {
    if (runId !== state.runId) return;
    try {
      let blob;
      if (TOOL === "compressor") {
        blob = await compress(it.file, quality);
        it.outName = it.file.name;
      } else if (!stripMeta && sameFormat(it.file, format) && !isHeic(it.file)) {
        blob = it.file;
        it.outName = baseName(it.file.name) + "." + EXT[format];
      } else {
        blob = await convert(it.file, format, quality);
        it.outName = baseName(it.file.name) + "." + EXT[format];
      }
      if (runId !== state.runId) return;
      it.blob = blob;
      it.outUrl = URL.createObjectURL(blob);
      it.status = "done";
    } catch (err) {
      console.error(err);
      it.error = err && err.message ? err.message : "Conversion failed";
      it.status = "error";
    }
    render();
  }
}

function render() {
  const results = $("#results");
  const list = $("#resultsList");
  if (!state.items.length) {
    results.classList.add("hidden");
    list.innerHTML = "";
    return;
  }
  results.classList.remove("hidden");

  const done = state.items.filter((i) => i.status === "done");
  const saved = done.reduce((s, i) => s + Math.max(0, i.file.size - i.blob.size), 0);

  const doneVerb = TOOL === "compressor" ? "compressed" : "converted";
  const ingVerb = TOOL === "compressor" ? "Compressing" : "Converting";
  $("#resultsTitle").textContent =
    done.length === state.items.length
      ? `${done.length} ${done.length === 1 ? "image" : "images"} ${doneVerb}`
      : `${ingVerb} ${state.items.length} ${state.items.length === 1 ? "image" : "images"}…`;
  $("#resultsSaved").textContent = saved > 0 ? `· ${fmtBytes(saved)} saved` : "";
  $("#downloadAll").disabled = done.length === 0;

  list.innerHTML = state.items.map(rowHTML).join("");
}

function rowHTML(it) {
  const thumb =
    it.status === "done" && it.outUrl
      ? `<img class="row__thumb" src="${it.outUrl}" alt="" loading="lazy">`
      : `<div class="row__thumb">${SVG.image}</div>`;

  let meta;
  if (it.status === "error") {
    meta = `<span class="row__size" style="color:var(--error)">${escapeHtml(it.error)}</span>`;
  } else {
    const sizes =
      it.status === "done"
        ? `${fmtBytes(it.file.size)} &nbsp;→&nbsp; ${fmtBytes(it.blob.size)}`
        : fmtBytes(it.file.size);
    let chip;
    if (TOOL === "compressor") {
      if (it.status === "done") {
        const pct = Math.round((1 - it.blob.size / it.file.size) * 100);
        chip = pct > 0
          ? `<span class="conv-chip saved">${it.src} · −${pct}%</span>`
          : `<span class="conv-chip">${it.src} · already optimized</span>`;
      } else {
        chip = `<span class="conv-chip">${it.src}</span>`;
      }
    } else {
      chip = `<span class="conv-chip">${it.src} → ${state.format.toUpperCase()}</span>`;
    }
    meta = `${chip}<span class="row__size">${sizes}</span>`;
  }

  let action;
  if (it.status === "pending") {
    action = `<span class="row__status"><span class="spinner"></span></span>`;
  } else if (it.status === "error") {
    action = `<span class="row__status error">${SVG.alert}<span class="label">Failed</span></span>`;
  } else {
    action = `<span class="row__status done">${SVG.check}<span class="label">Done</span></span>
      <a class="btn btn-ghost btn-sm" href="${it.outUrl}" download="${escapeAttr(it.outName)}">${SVG.download}<span>Download</span></a>`;
  }

  return `<div class="row">${thumb}
      <div class="row__info">
        <div class="row__name">${escapeHtml(it.file.name)}</div>
        <div class="row__meta">${meta}</div>
      </div>${action}</div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const escapeAttr = escapeHtml;

function accepts(f) {
  if (TOOL === "compressor") {
    return /image\/(jpeg|png|webp)/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
  }
  return (
    /^image\//.test(f.type) ||
    isHeic(f) ||
    /\.(heic|heif|jpe?g|png|webp|avif|gif|bmp|tiff?)$/i.test(f.name)
  );
}

function addFiles(fileList) {
  const accepted = [...fileList].filter(accepts);
  if (!accepted.length) {
    if (fileList && fileList.length) toast(TOOL === "compressor" ? "Add a JPG, PNG or WebP image." : "Unsupported file — add an image to convert.");
    return;
  }
  for (const f of accepted) {
    state.items.push({
      id: (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()),
      file: f,
      src: srcLabel(f),
      status: "pending",
      blob: null,
      outUrl: null,
      outName: null,
      error: null,
    });
  }
  runAll();
}

async function downloadAll() {
  const done = state.items.filter((i) => i.status === "done");
  if (!done.length) return;
  const btn = $("#downloadAll");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span><span>Zipping…</span>`;
  try {
    const { default: JSZip } = await ensureJSZip();
    const zip = new JSZip();
    const seen = new Map();
    for (const it of done) {
      let name = it.outName;
      if (seen.has(name)) {
        const n = seen.get(name) + 1;
        seen.set(name, n);
        const ext = it.outName.slice(it.outName.lastIndexOf(".") + 1);
        name = `${baseName(it.outName)}-${n}.${ext}`;
      } else {
        seen.set(name, 1);
      }
      zip.file(name, it.blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "converted-images.zip");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    console.error(err);
    alert("Sorry — could not build the ZIP. You can still download files individually.");
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
}

function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function setFormat(fmt) {
  if (!VALID.includes(fmt)) fmt = "jpg";
  state.format = fmt;
  $("#segmented").querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.fmt === fmt));
  $("#quality").classList.toggle("disabled", fmt === "png");
}

// Converter controls — only wired on pages that actually have the tool.
function initTool() {
  const dz = $("#dropzone");
  if (!dz) return;

  const seg = $("#segmented");
  if (seg) {
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-fmt]");
      if (!btn) return;
      setFormat(btn.dataset.fmt);
      if (state.items.length) runAll();
    });
  }

  const range = $("#quality-range");
  if (range) {
    state.quality = +range.value; // sync to the page's initial slider value
    range.addEventListener("input", () => {
      state.quality = +range.value;
      const v = $("#quality-val");
      if (v) v.textContent = range.value;
    });
    range.addEventListener("change", () => {
      if (!state.items.length) return;
      if (TOOL === "converter" && state.format === "png") return;
      runAll();
    });
  }

  const strip = $("#stripMeta");
  if (strip) {
    strip.addEventListener("change", (e) => {
      state.stripMeta = e.target.checked;
      if (state.items.length) runAll();
    });
  }

  const input = $("#fileInput");
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
  });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });

  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === "dragleave" && dz.contains(e.relatedTarget)) return;
      dz.classList.remove("dragover");
    }));
  dz.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  $("#downloadAll").addEventListener("click", downloadAll);

  if (TOOL === "converter") setFormat(document.body.dataset.defaultFormat || "jpg");
}

function init() {
  TOOL = document.body.dataset.tool === "compressor" ? "compressor" : "converter";
  initTool();
}

document.addEventListener("DOMContentLoaded", init);
