/* ===========================================================================
   Tools by Note Hoard — Images → PDF
   100% client-side. Combines images into a single PDF with pdf-lib.
   Reorder pages, choose page size / orientation / margin / quality.
   HEIC is decoded via heic-to; everything stays in the browser.
   =========================================================================== */
import { toast } from "./shell.js";

const $ = (s) => document.querySelector(s);

let _pdflib, _heic;
const ensurePdfLib = () => (_pdflib ??= import("pdf-lib"));
const ensureHeic = () => (_heic ??= import("heic-to"));

const PAGE = { a4: [595.28, 841.89], letter: [612, 792] };

const state = {
  items: [], // { id, file, url, name }
  opts: { pageSize: "fit", orient: "auto", margin: 0, quality: 85 },
  building: false,
};

const SVG = {
  up: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  down: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  x: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  pdf: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
const isHeic = (f) => /image\/(heic|heif)/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
const accepts = (f) => /^image\//.test(f.type) || isHeic(f) || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name);

async function toBitmap(file) {
  if (isHeic(file)) {
    const { heicTo } = await ensureHeic();
    const png = await heicTo({ blob: file, type: "image/png" });
    return await createImageBitmap(png);
  }
  try { return await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { return await createImageBitmap(file); }
}

async function prepImage(file, quality) {
  const bmp = await toBitmap(file);
  const w = bmp.width, h = bmp.height;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0);
  if (bmp.close) bmp.close();
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", quality / 100));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, w, h };
}

function geometry(w, h, o) {
  if (o.pageSize === "fit") return { pw: w, ph: h, dx: 0, dy: 0, dw: w, dh: h };
  let [pw, ph] = PAGE[o.pageSize] || PAGE.a4;
  const land = o.orient === "landscape" || (o.orient === "auto" && w > h);
  if (land) [pw, ph] = [ph, pw];
  const m = o.margin;
  const s = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h);
  const dw = w * s, dh = h * s;
  return { pw, ph, dx: (pw - dw) / 2, dy: (ph - dh) / 2, dw, dh };
}

/* ------------------------------------------------------------ Rendering */
function render() {
  const wrap = $("#thumbsWrap");
  const grid = $("#thumbs");
  if (!state.items.length) {
    wrap.classList.add("hidden");
    grid.innerHTML = "";
    $("#createPdf").disabled = true;
    return;
  }
  wrap.classList.remove("hidden");
  $("#thumbCount").textContent = `${state.items.length} ${state.items.length === 1 ? "image" : "images"} · ${state.items.length} ${state.items.length === 1 ? "page" : "pages"}`;
  $("#createPdf").disabled = state.building;
  grid.innerHTML = state.items.map((it, i) => `
    <div class="thumb" data-id="${it.id}">
      <div class="thumb__idx">${i + 1}</div>
      <div class="thumb__img"><img src="${it.url}" alt="" loading="lazy"></div>
      <div class="thumb__bar">
        <button class="thumb__btn" data-act="up" aria-label="Move up" ${i === 0 ? "disabled" : ""}>${SVG.up}</button>
        <button class="thumb__btn" data-act="down" aria-label="Move down" ${i === state.items.length - 1 ? "disabled" : ""}>${SVG.down}</button>
        <button class="thumb__btn" data-act="remove" aria-label="Remove">${SVG.x}</button>
      </div>
      <div class="thumb__name">${escapeHtml(it.name)}</div>
    </div>`).join("");
}

function addFiles(fileList) {
  const ok = [...fileList].filter(accepts);
  if (!ok.length) {
    if (fileList && fileList.length) toast("Add an image (JPG, PNG, WebP, HEIC, GIF or BMP).");
    return;
  }
  for (const f of ok) {
    state.items.push({ id: (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()), file: f, url: URL.createObjectURL(f), name: f.name });
  }
  render();
}

function move(id, dir) {
  const i = state.items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.items.length) return;
  [state.items[i], state.items[j]] = [state.items[j], state.items[i]];
  render();
}
function remove(id) {
  const i = state.items.findIndex((x) => x.id === id);
  if (i < 0) return;
  URL.revokeObjectURL(state.items[i].url);
  state.items.splice(i, 1);
  render();
}

async function createPdf() {
  if (!state.items.length || state.building) return;
  state.building = true;
  const btn = $("#createPdf");
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span><span>Building PDF…</span>`;
  try {
    const { PDFDocument } = await ensurePdfLib();
    const doc = await PDFDocument.create();
    for (const it of state.items) {
      const { bytes, w, h } = await prepImage(it.file, state.opts.quality);
      const img = await doc.embedJpg(bytes);
      const g = geometry(w, h, state.opts);
      const page = doc.addPage([g.pw, g.ph]);
      page.drawImage(img, { x: g.dx, y: g.dy, width: g.dw, height: g.dh });
    }
    const out = await doc.save();
    const blob = new Blob([out], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "images.pdf");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    console.error(err);
    alert("Sorry — could not build the PDF. Please check your images and try again.");
  } finally {
    state.building = false;
    btn.innerHTML = orig;
    btn.disabled = state.items.length === 0;
  }
}

/* --------------------------------------------------------------- Options */
function syncOptionGroups() {
  const fit = state.opts.pageSize === "fit";
  $("#grp-orient").classList.toggle("hidden", fit);
  $("#grp-margin").classList.toggle("hidden", fit);
}

function init() {
  const dz = $("#dropzone"), input = $("#fileInput");
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "dragleave" && dz.contains(e.relatedTarget)) return; dz.classList.remove("dragover"); }));
  dz.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  $("#thumbs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const id = b.closest(".thumb").dataset.id;
    if (b.dataset.act === "up") move(id, -1);
    else if (b.dataset.act === "down") move(id, 1);
    else remove(id);
  });
  $("#clearAll").addEventListener("click", () => {
    state.items.forEach((it) => URL.revokeObjectURL(it.url));
    state.items = [];
    render();
  });

  $("#pageSize").addEventListener("change", (e) => { state.opts.pageSize = e.target.value; syncOptionGroups(); });
  $("#orient").addEventListener("change", (e) => { state.opts.orient = e.target.value; });
  $("#margin").addEventListener("change", (e) => { state.opts.margin = +e.target.value; });
  const q = $("#quality-range");
  state.opts.quality = +q.value;
  q.addEventListener("input", () => { state.opts.quality = +q.value; $("#quality-val").textContent = q.value; });

  $("#createPdf").addEventListener("click", createPdf);
  syncOptionGroups();
}

document.addEventListener("DOMContentLoaded", init);
