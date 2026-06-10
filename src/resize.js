/* ===========================================================================
   Tools by Note Hoard — Resize & Crop
   100% client-side. Two modes:
   - Resize: batch, high-quality (Pica / Lanczos), by preset / dimensions / %.
   - Crop:   interactive per-image selection (Cropper.js) with aspect presets.
   Both keep the source format (JPG/PNG/WebP) and never leave the browser.
   =========================================================================== */
import { toast } from "./shell.js";
import pica from "pica";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

const $ = (s) => document.querySelector(s);
const picaInst = pica();

let _jszip;
const ensureJSZip = () => (_jszip ??= import("jszip"));

const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const EXT = { jpg: "jpg", png: "png", webp: "webp" };

const PRESETS = [
  { id: "ig-square", label: "Instagram square — 1080×1080", w: 1080, h: 1080 },
  { id: "ig-portrait", label: "Instagram portrait — 1080×1350", w: 1080, h: 1350 },
  { id: "ig-story", label: "Instagram story / Reel — 1080×1920", w: 1080, h: 1920 },
  { id: "yt-thumb", label: "YouTube thumbnail — 1280×720", w: 1280, h: 720 },
  { id: "li-square", label: "LinkedIn — 1200×1200", w: 1200, h: 1200 },
  { id: "pin", label: "Pinterest pin — 1000×1500", w: 1000, h: 1500 },
  { id: "x-landscape", label: "X / Twitter — 1600×900", w: 1600, h: 900 },
];

const state = {
  mode: "resize",
  items: [],
  runId: 0,
  rmode: "preset",
  preset: PRESETS[0],
  width: 1080,
  height: 1080,
  lockAspect: true,
  percent: 50,
  fit: "cover",
  noUpscale: true,
  quality: 90,
  cropAspect: NaN,
  cropFile: null,
};

const SVG = {
  image: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
  check: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  alert: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  download: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
};

const baseName = (n) => { const i = n.lastIndexOf("."); return i > 0 ? n.slice(0, i) : n; };
function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
const accepts = (f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name);
function outFmt(file) {
  const n = file.name.toLowerCase();
  if (/png/.test(file.type) || /\.png$/.test(n)) return "png";
  if (/webp/.test(file.type) || /\.webp$/.test(n)) return "webp";
  if (/jpe?g/.test(file.type) || /\.jpe?g$/.test(n)) return "jpg";
  return "png";
}
async function toBitmap(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); }
  catch { return await createImageBitmap(blob); }
}
const canvasToBlob = (canvas, type, quality) =>
  new Promise((res) => canvas.toBlob((b) => res(b), type, quality));

/* ----------------------------------------------------- Resize geometry */
function computeResize(sw, sh) {
  if (state.rmode === "percent") {
    let s = state.percent / 100;
    if (state.noUpscale && s > 1) s = 1;
    return { sx: 0, sy: 0, scw: sw, sch: sh, dw: Math.max(1, Math.round(sw * s)), dh: Math.max(1, Math.round(sh * s)) };
  }

  let tw, th;
  if (state.rmode === "preset") { tw = state.preset.w; th = state.preset.h; }
  else {
    if (state.lockAspect && !(state.width && state.height)) {
      if (state.width) { let s = state.width / sw; if (state.noUpscale && s > 1) s = 1; return { sx: 0, sy: 0, scw: sw, sch: sh, dw: Math.round(sw * s), dh: Math.round(sh * s) }; }
      let s = (state.height || sh) / sh; if (state.noUpscale && s > 1) s = 1;
      return { sx: 0, sy: 0, scw: sw, sch: sh, dw: Math.round(sw * s), dh: Math.round(sh * s) };
    }
    tw = state.width || sw; th = state.height || sh;
  }

  if (state.fit === "stretch") {
    let dw = tw, dh = th;
    if (state.noUpscale) { dw = Math.min(dw, sw); dh = Math.min(dh, sh); }
    return { sx: 0, sy: 0, scw: sw, sch: sh, dw, dh };
  }
  if (state.fit === "contain") {
    let s = Math.min(tw / sw, th / sh);
    if (state.noUpscale && s > 1) s = 1;
    return { sx: 0, sy: 0, scw: sw, sch: sh, dw: Math.max(1, Math.round(sw * s)), dh: Math.max(1, Math.round(sh * s)) };
  }
  // cover — crop source to target aspect (centered), then resize
  const ta = tw / th, sa = sw / sh;
  let scw, sch;
  if (sa > ta) { sch = sh; scw = Math.round(sh * ta); } else { scw = sw; sch = Math.round(sw / ta); }
  const sx = Math.round((sw - scw) / 2), sy = Math.round((sh - sch) / 2);
  let dw = tw, dh = th;
  if (state.noUpscale && tw > scw) { dw = scw; dh = sch; }
  return { sx, sy, scw, sch, dw, dh };
}

async function resizeOne(file) {
  const bmp = await toBitmap(file);
  const ow = bmp.width, oh = bmp.height;
  const { sx, sy, scw, sch, dw, dh } = computeResize(ow, oh);
  const from = document.createElement("canvas");
  from.width = scw; from.height = sch;
  from.getContext("2d").drawImage(bmp, sx, sy, scw, sch, 0, 0, scw, sch);
  if (bmp.close) bmp.close();
  const to = document.createElement("canvas");
  to.width = dw; to.height = dh;
  await picaInst.resize(from, to, { quality: 3, alpha: true });
  const fmt = outFmt(file);
  let blob;
  if (fmt === "jpg") {
    const flat = document.createElement("canvas");
    flat.width = dw; flat.height = dh;
    const fc = flat.getContext("2d");
    fc.fillStyle = "#ffffff"; fc.fillRect(0, 0, dw, dh);
    fc.drawImage(to, 0, 0);
    blob = await canvasToBlob(flat, "image/jpeg", state.quality / 100);
  } else {
    blob = await canvasToBlob(to, MIME[fmt], fmt === "webp" ? state.quality / 100 : undefined);
  }
  return { blob, ow, oh, dw, dh };
}

async function runAll() {
  const runId = ++state.runId;
  for (const it of state.items) {
    if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    it.outUrl = null; it.blob = null; it.error = null; it.status = "pending";
  }
  render();
  for (const it of state.items) {
    if (runId !== state.runId) return;
    try {
      const r = await resizeOne(it.file);
      if (runId !== state.runId) return;
      it.blob = r.blob; it.ow = r.ow; it.oh = r.oh; it.dw = r.dw; it.dh = r.dh;
      it.outName = `${baseName(it.file.name)}-${r.dw}x${r.dh}.${outFmt(it.file)}`;
      it.outUrl = URL.createObjectURL(r.blob);
      it.status = "done";
    } catch (err) {
      console.error(err);
      it.error = (err && err.message) ? err.message : "Resize failed";
      it.status = "error";
    }
    render();
  }
}

function render() {
  const results = $("#results");
  const list = $("#resultsList");
  if (!state.items.length) { results.classList.add("hidden"); list.innerHTML = ""; return; }
  results.classList.remove("hidden");
  const done = state.items.filter((i) => i.status === "done");
  $("#resultsTitle").textContent =
    done.length === state.items.length
      ? `${done.length} ${done.length === 1 ? "image" : "images"} resized`
      : `Resizing ${state.items.length} ${state.items.length === 1 ? "image" : "images"}…`;
  $("#downloadAll").disabled = done.length === 0;
  list.innerHTML = state.items.map(rowHTML).join("");
}

function rowHTML(it) {
  const thumb = it.status === "done" && it.outUrl
    ? `<img class="row__thumb" src="${it.outUrl}" alt="" loading="lazy">`
    : `<div class="row__thumb">${SVG.image}</div>`;
  let meta;
  if (it.status === "error") {
    meta = `<span class="row__size" style="color:var(--error)">${escapeHtml(it.error)}</span>`;
  } else if (it.status === "done") {
    meta = `<span class="conv-chip">${it.ow}×${it.oh} → ${it.dw}×${it.dh}</span><span class="row__size">${fmtBytes(it.blob.size)}</span>`;
  } else {
    meta = `<span class="row__size">…</span>`;
  }
  let action;
  if (it.status === "pending") action = `<span class="row__status"><span class="spinner"></span></span>`;
  else if (it.status === "error") action = `<span class="row__status error">${SVG.alert}<span class="label">Failed</span></span>`;
  else action = `<span class="row__status done">${SVG.check}<span class="label">Done</span></span>
      <a class="btn btn-ghost btn-sm" href="${it.outUrl}" download="${escapeHtml(it.outName)}">${SVG.download}<span>Download</span></a>`;
  return `<div class="row">${thumb}<div class="row__info"><div class="row__name">${escapeHtml(it.file.name)}</div><div class="row__meta">${meta}</div></div>${action}</div>`;
}

function addFiles(fileList) {
  const ok = [...fileList].filter(accepts);
  if (!ok.length) {
    if (fileList && fileList.length) toast("Add an image (JPG, PNG, WebP, GIF or BMP).");
    return;
  }
  for (const f of ok) {
    state.items.push({ id: (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()), file: f, status: "pending", blob: null, outUrl: null, outName: null, error: null });
  }
  runAll();
}

async function downloadAll() {
  const done = state.items.filter((i) => i.status === "done");
  if (!done.length) return;
  const btn = $("#downloadAll"); const orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span><span>Zipping…</span>`;
  try {
    const { default: JSZip } = await ensureJSZip();
    const zip = new JSZip(); const seen = new Map();
    for (const it of done) {
      let n = it.outName;
      if (seen.has(n)) { const k = seen.get(n) + 1; seen.set(n, k); n = `${baseName(it.outName)}-${k}.${outFmt(it.file)}`; }
      else seen.set(n, 1);
      zip.file(n, it.blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "resized-images.zip");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) { console.error(e); alert("Sorry — could not build the ZIP."); }
  finally { btn.innerHTML = orig; btn.disabled = false; }
}

/* --------------------------------------------------------------- Crop */
let cropper = null;
function loadCropImage(file) {
  if (!file) return;
  if (!accepts(file)) { toast("That file isn't a supported image."); return; }
  const img = $("#cropImage");
  if (cropper) { cropper.destroy(); cropper = null; }
  if (img.src && img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  state.cropFile = file;
  img.src = URL.createObjectURL(file);
  $("#cropDropWrap").classList.add("hidden");
  $("#cropEditor").classList.remove("hidden");
  img.onload = () => {
    cropper = new Cropper(img, { viewMode: 1, autoCropArea: 1, background: false, aspectRatio: state.cropAspect });
  };
}
function downloadCrop() {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({ maxWidth: 8192, maxHeight: 8192 });
  if (!canvas) { alert("Couldn't generate the crop — try a different selection."); return; }
  const fmt = outFmt(state.cropFile);
  const finish = (blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${baseName(state.cropFile.name)}-cropped.${EXT[fmt]}`);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  if (fmt === "jpg") {
    const f = document.createElement("canvas");
    f.width = canvas.width; f.height = canvas.height;
    const c = f.getContext("2d");
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, f.width, f.height); c.drawImage(canvas, 0, 0);
    f.toBlob(finish, "image/jpeg", 0.92);
  } else {
    canvas.toBlob(finish, MIME[fmt], fmt === "webp" ? 0.92 : undefined);
  }
}

/* --------------------------------------------------------------- Init */
function setTab(m) {
  state.mode = m;
  $("#tabResize").classList.toggle("active", m === "resize");
  $("#tabCrop").classList.toggle("active", m === "crop");
  $("#resizePanel").classList.toggle("hidden", m !== "resize");
  $("#cropPanel").classList.toggle("hidden", m !== "crop");
}

function showRmodeGroups() {
  $("#group-preset").classList.toggle("hidden", state.rmode !== "preset");
  $("#group-dimensions").classList.toggle("hidden", state.rmode !== "dimensions");
  $("#group-percent").classList.toggle("hidden", state.rmode !== "percent");
  $("#group-fit").classList.toggle("hidden", state.rmode === "percent");
}

function initResize() {
  const dz = $("#dropzone"), input = $("#fileInput");
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "dragleave" && dz.contains(e.relatedTarget)) return; dz.classList.remove("dragover"); }));
  dz.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

  $("#rmodeSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-rmode]"); if (!b) return;
    state.rmode = b.dataset.rmode;
    $("#rmodeSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    showRmodeGroups();
    if (state.items.length) runAll();
  });

  const presetSel = $("#presetSelect");
  PRESETS.forEach((p) => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.label; presetSel.appendChild(o); });
  presetSel.addEventListener("change", () => { state.preset = PRESETS.find((p) => p.id === presetSel.value) || PRESETS[0]; if (state.items.length) runAll(); });

  const wEl = $("#widthInput"), hEl = $("#heightInput");
  wEl.addEventListener("change", () => { state.width = parseInt(wEl.value, 10) || 0; if (state.items.length) runAll(); });
  hEl.addEventListener("change", () => { state.height = parseInt(hEl.value, 10) || 0; if (state.items.length) runAll(); });
  $("#lockAspect").addEventListener("change", (e) => { state.lockAspect = e.target.checked; if (state.items.length) runAll(); });

  const pr = $("#percentRange");
  pr.addEventListener("input", () => { state.percent = +pr.value; $("#percentVal").textContent = pr.value + "%"; });
  pr.addEventListener("change", () => { if (state.items.length) runAll(); });

  $("#fitSelect").addEventListener("change", (e) => { state.fit = e.target.value; if (state.items.length) runAll(); });
  $("#noUpscale").addEventListener("change", (e) => { state.noUpscale = e.target.checked; if (state.items.length) runAll(); });

  const q = $("#quality-range");
  if (q) { state.quality = +q.value; q.addEventListener("input", () => { state.quality = +q.value; $("#quality-val").textContent = q.value; }); q.addEventListener("change", () => { if (state.items.length) runAll(); }); }

  $("#downloadAll").addEventListener("click", downloadAll);
  showRmodeGroups();
}

function initCrop() {
  const drop = $("#cropDrop"), input = $("#cropInput");
  drop.addEventListener("click", () => input.click());
  input.addEventListener("change", () => { loadCropImage(input.files[0]); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "dragleave" && drop.contains(e.relatedTarget)) return; drop.classList.remove("dragover"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) loadCropImage(e.dataTransfer.files[0]); });

  $("#aspectSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-aspect]"); if (!b) return;
    $("#aspectSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    const a = b.dataset.aspect;
    if (a === "free") state.cropAspect = NaN;
    else { const [w, h] = a.split(":").map(Number); state.cropAspect = w / h; }
    if (cropper) cropper.setAspectRatio(state.cropAspect);
  });

  $("#cropDownload").addEventListener("click", downloadCrop);
  $("#cropReset").addEventListener("click", () => {
    if (cropper) { cropper.destroy(); cropper = null; }
    const img = $("#cropImage");
    if (img.src && img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    state.cropFile = null;
    $("#cropEditor").classList.add("hidden");
    $("#cropDropWrap").classList.remove("hidden");
  });

  // prevent the page from hijacking drops outside the zones
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
}

function init() {
  $("#tabResize").addEventListener("click", () => setTab("resize"));
  $("#tabCrop").addEventListener("click", () => setTab("crop"));
  initResize();
  initCrop();
  setTab(document.body.dataset.defaultTab === "crop" ? "crop" : "resize");
}

document.addEventListener("DOMContentLoaded", init);
