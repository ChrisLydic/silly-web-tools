/* ===========================================================================
   Tools by Note Hoard — PDF Toolkit
   100% client-side. Merge / Split / Rotate / Compress PDFs.
   - pdf-lib: merge, split, rotate, lossless re-save.
   - pdf.js:  "strong" compress (re-renders pages to images, great for scans).
   Everything happens in the browser — files never leave your device.
   =========================================================================== */
import { toast } from "./shell.js";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const $ = (s) => document.querySelector(s);

let _pl, _pj, _zip;
const ensurePdfLib = () => (_pl ??= import("pdf-lib"));
const ensureJSZip = () => (_zip ??= import("jszip"));
const ensurePdfjs = async () => {
  if (!_pj) { const m = await import("pdfjs-dist"); m.GlobalWorkerOptions.workerSrc = pdfWorkerUrl; _pj = m; }
  return _pj;
};

const SVG = {
  up: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  down: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  x: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  check: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  alert: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  pdf: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
};

const isPdf = (f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
const baseName = (n) => { const i = n.lastIndexOf("."); return i > 0 ? n.slice(0, i) : n; };
function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function triggerDownload(url, filename) {
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
function dl(bytes, filename, type = "application/pdf") {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}
function parseRange(str, total) {
  if (!str || /^\s*all\s*$/i.test(str)) return [...Array(total).keys()];
  const set = new Set();
  for (const part of str.split(",")) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    let a = +m[1], b = m[2] ? +m[2] : a;
    if (a > b) [a, b] = [b, a];
    for (let i = a; i <= b; i++) if (i >= 1 && i <= total) set.add(i - 1);
  }
  return [...set].sort((x, y) => x - y);
}
async function loadDoc(file) {
  const { PDFDocument } = await ensurePdfLib();
  return PDFDocument.load(await file.arrayBuffer());
}

const state = { tab: "merge", merge: [], split: null, splitN: 0, rotate: null, rotateN: 0, rotateAngle: 90, compress: [], busy: false };

function setBusy(btn, on, label) {
  if (!btn) return;
  if (on) { btn._orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span><span>${label || "Working…"}</span>`; }
  else { btn.innerHTML = btn._orig || btn.innerHTML; btn.disabled = false; }
}

/* ================================================================ Merge */
function renderMerge() {
  const wrap = $("#mergeList");
  wrap.innerHTML = state.merge.map((it, i) => `
    <div class="filerow" data-id="${it.id}">
      <span class="filerow__idx">${i + 1}</span>
      <span class="filerow__name">${escapeHtml(it.file.name)}</span>
      <span class="filerow__size">${fmtBytes(it.file.size)}</span>
      <span class="filerow__bar">
        <button class="thumb__btn" data-act="up" ${i === 0 ? "disabled" : ""} aria-label="Up">${SVG.up}</button>
        <button class="thumb__btn" data-act="down" ${i === state.merge.length - 1 ? "disabled" : ""} aria-label="Down">${SVG.down}</button>
        <button class="thumb__btn" data-act="remove" aria-label="Remove">${SVG.x}</button>
      </span>
    </div>`).join("");
  $("#mergeRun").disabled = state.merge.length < 2;
  $("#mergeListWrap").classList.toggle("hidden", state.merge.length === 0);
}
async function mergeRun() {
  if (state.merge.length < 2) return;
  const btn = $("#mergeRun"); setBusy(btn, true, "Merging…");
  try {
    const { PDFDocument } = await ensurePdfLib();
    const out = await PDFDocument.create();
    for (const it of state.merge) {
      const src = await loadDoc(it.file);
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }
    dl(await out.save(), "merged.pdf");
  } catch (e) { console.error(e); alert("Couldn't merge those PDFs."); }
  finally { setBusy(btn, false); }
}

/* ================================================================ Split */
async function setSplit(file) {
  if (!file || !isPdf(file)) return;
  state.split = file;
  $("#splitInfo").textContent = "Reading…";
  $("#splitEditor").classList.remove("hidden");
  $("#splitDropWrap").classList.add("hidden");
  try { state.splitN = (await loadDoc(file)).getPageCount(); $("#splitInfo").textContent = `${file.name} · ${state.splitN} pages`; }
  catch (e) { console.error(e); $("#splitInfo").textContent = "Couldn't read this PDF."; }
}
async function splitExtract() {
  if (!state.split) return;
  const idx = parseRange($("#splitRange").value, state.splitN);
  if (!idx.length) { alert("Enter page numbers like 1-3, 5"); return; }
  const btn = $("#splitExtract"); setBusy(btn, true, "Extracting…");
  try {
    const { PDFDocument } = await ensurePdfLib();
    const src = await loadDoc(state.split);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, idx);
    pages.forEach((p) => out.addPage(p));
    dl(await out.save(), `${baseName(state.split.name)}-extract.pdf`);
  } catch (e) { console.error(e); alert("Couldn't extract those pages."); }
  finally { setBusy(btn, false); }
}
async function splitAll() {
  if (!state.split) return;
  const btn = $("#splitAll"); setBusy(btn, true, "Splitting…");
  try {
    const { PDFDocument } = await ensurePdfLib();
    const { default: JSZip } = await ensureJSZip();
    const src = await loadDoc(state.split);
    const n = src.getPageCount();
    const zip = new JSZip();
    for (let i = 0; i < n; i++) {
      const out = await PDFDocument.create();
      const [pg] = await out.copyPages(src, [i]);
      out.addPage(pg);
      zip.file(`page-${i + 1}.pdf`, await out.save());
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${baseName(state.split.name)}-pages.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 6000);
  } catch (e) { console.error(e); alert("Couldn't split this PDF."); }
  finally { setBusy(btn, false); }
}

/* =============================================================== Rotate */
async function setRotate(file) {
  if (!file || !isPdf(file)) return;
  state.rotate = file;
  $("#rotateInfo").textContent = "Reading…";
  $("#rotateEditor").classList.remove("hidden");
  $("#rotateDropWrap").classList.add("hidden");
  try { state.rotateN = (await loadDoc(file)).getPageCount(); $("#rotateInfo").textContent = `${file.name} · ${state.rotateN} pages`; }
  catch (e) { console.error(e); $("#rotateInfo").textContent = "Couldn't read this PDF."; }
}
async function rotateRun() {
  if (!state.rotate) return;
  const idx = parseRange($("#rotateRange").value, state.rotateN);
  if (!idx.length) { alert("Enter pages like 1-3, 5 (or 'all')"); return; }
  const btn = $("#rotateRun"); setBusy(btn, true, "Rotating…");
  try {
    const { PDFDocument, degrees } = await ensurePdfLib();
    const src = await loadDoc(state.rotate);
    const set = new Set(idx);
    src.getPages().forEach((pg, i) => {
      if (!set.has(i)) return;
      const cur = pg.getRotation().angle || 0;
      pg.setRotation(degrees((cur + state.rotateAngle) % 360));
    });
    dl(await src.save(), `${baseName(state.rotate.name)}-rotated.pdf`);
  } catch (e) { console.error(e); alert("Couldn't rotate this PDF."); }
  finally { setBusy(btn, false); }
}

/* ============================================================= Compress */
const LEVELS = { less: { scale: 2.0, q: 0.82 }, medium: { scale: 1.5, q: 0.7 }, more: { scale: 1.0, q: 0.6 } };
function renderCompress() {
  const wrap = $("#compressList");
  wrap.innerHTML = state.compress.map((it) => {
    let right;
    if (it.status === "pending") right = `<span class="row__status"><span class="spinner"></span></span>`;
    else if (it.status === "error") right = `<span class="row__status error">${SVG.alert}<span class="label">Failed</span></span>`;
    else if (it.status === "done") right = `<span class="row__status done">${SVG.check}<span class="label">Done</span></span><a class="btn btn-ghost btn-sm" href="${it.url}" download="${escapeHtml(it.outName)}">Download</a>`;
    else right = "";
    let meta;
    if (it.status === "done") { const pct = Math.round((1 - it.outSize / it.file.size) * 100); meta = `<span class="conv-chip ${pct > 0 ? "saved" : ""}">${pct > 0 ? "−" + pct + "%" : "no gain"}</span><span class="row__size">${fmtBytes(it.file.size)} → ${fmtBytes(it.outSize)}</span>`; }
    else if (it.status === "error") meta = `<span class="row__size" style="color:var(--error)">${escapeHtml(it.error || "Failed")}</span>`;
    else meta = `<span class="row__size">${fmtBytes(it.file.size)}</span>`;
    return `<div class="row"><div class="row__thumb">${SVG.pdf}</div><div class="row__info"><div class="row__name">${escapeHtml(it.file.name)}</div><div class="row__meta">${meta}</div></div>${right}</div>`;
  }).join("");
  $("#compressListWrap").classList.toggle("hidden", state.compress.length === 0);
  $("#compressRun").disabled = state.compress.length === 0 || state.busy;
}
async function compressLossless(file) {
  const src = await loadDoc(file);
  return src.save({ useObjectStreams: true });
}
async function compressStrong(file) {
  const { PDFDocument } = await ensurePdfLib();
  const pdfjs = await ensurePdfjs();
  const { scale, q } = LEVELS[$("#compressLevel").value] || LEVELS.medium;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const out = await PDFDocument.create();
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const p = out.addPage([canvas.width, canvas.height]);
    p.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
    page.cleanup();
  }
  return out.save();
}
async function compressRun() {
  if (!state.compress.length || state.busy) return;
  state.busy = true;
  const activeBtn = $("#compressMode").querySelector("button.active");
  const mode = activeBtn ? activeBtn.dataset.mode : "lossless";
  const btn = $("#compressRun"); setBusy(btn, true, "Compressing…");
  for (const it of state.compress) {
    if (it.url) URL.revokeObjectURL(it.url);
    it.status = "pending"; it.url = null;
  }
  renderCompress();
  for (const it of state.compress) {
    try {
      const bytes = mode === "strong" ? await compressStrong(it.file) : await compressLossless(it.file);
      const blob = new Blob([bytes], { type: "application/pdf" });
      // never hand back a bigger file
      if (blob.size >= it.file.size && mode !== "strong") { it.outSize = it.file.size; it.url = URL.createObjectURL(it.file); }
      else { it.outSize = blob.size; it.url = URL.createObjectURL(blob); }
      it.outName = `${baseName(it.file.name)}-compressed.pdf`;
      it.status = "done";
    } catch (e) { console.error(e); it.error = e && e.message; it.status = "error"; }
    renderCompress();
  }
  state.busy = false;
  setBusy(btn, false);
  renderCompress();
}

/* ---------------------------------------------------- generic dropzone */
function wireDrop(dz, input, onFiles, multiple) {
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", () => { onFiles([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "dragleave" && dz.contains(e.relatedTarget)) return; dz.classList.remove("dragover"); }));
  dz.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) onFiles([...e.dataTransfer.files]); });
}

function setTab(t) {
  state.tab = t;
  ["merge", "split", "rotate", "compress"].forEach((m) => {
    $("#tab-" + m).classList.toggle("active", m === t);
    $("#panel-" + m).classList.toggle("hidden", m !== t);
  });
}

function init() {
  ["merge", "split", "rotate", "compress"].forEach((m) => $("#tab-" + m).addEventListener("click", () => setTab(m)));
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  // Merge
  wireDrop($("#mergeDrop"), $("#mergeInput"), (files) => {
    const pdfs = files.filter(isPdf);
    if (!pdfs.length) { if (files.length) toast("Add a PDF file."); return; }
    pdfs.forEach((f) => state.merge.push({ id: (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()), file: f }));
    renderMerge();
  });
  $("#mergeList").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const id = b.closest(".filerow").dataset.id;
    const i = state.merge.findIndex((x) => x.id === id);
    if (b.dataset.act === "remove") state.merge.splice(i, 1);
    else { const j = i + (b.dataset.act === "up" ? -1 : 1); if (j >= 0 && j < state.merge.length) [state.merge[i], state.merge[j]] = [state.merge[j], state.merge[i]]; }
    renderMerge();
  });
  $("#mergeRun").addEventListener("click", mergeRun);

  // Split
  wireDrop($("#splitDrop"), $("#splitInput"), (files) => { const f = files.find(isPdf); if (!f) { if (files.length) toast("Add a PDF file."); return; } setSplit(f); });
  $("#splitExtract").addEventListener("click", splitExtract);
  $("#splitAll").addEventListener("click", splitAll);
  $("#splitReset").addEventListener("click", () => { state.split = null; $("#splitEditor").classList.add("hidden"); $("#splitDropWrap").classList.remove("hidden"); });

  // Rotate
  wireDrop($("#rotateDrop"), $("#rotateInput"), (files) => { const f = files.find(isPdf); if (!f) { if (files.length) toast("Add a PDF file."); return; } setRotate(f); });
  $("#rotateAngle").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-angle]"); if (!b) return;
    state.rotateAngle = +b.dataset.angle;
    $("#rotateAngle").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
  });
  $("#rotateRun").addEventListener("click", rotateRun);
  $("#rotateReset").addEventListener("click", () => { state.rotate = null; $("#rotateEditor").classList.add("hidden"); $("#rotateDropWrap").classList.remove("hidden"); });

  // Compress
  wireDrop($("#compressDrop"), $("#compressInput"), (files) => {
    const pdfs = files.filter(isPdf);
    if (!pdfs.length) { if (files.length) toast("Add a PDF file."); return; }
    pdfs.forEach((f) => state.compress.push({ id: (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()), file: f, status: "idle" }));
    renderCompress();
  });
  $("#compressMode").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mode]"); if (!b) return;
    $("#compressMode").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    $("#compressLevelWrap").classList.toggle("hidden", b.dataset.mode !== "strong");
  });
  $("#compressRun").addEventListener("click", compressRun);

  const dt = document.body.dataset.defaultTab;
  setTab(["merge", "split", "rotate", "compress"].includes(dt) ? dt : "merge");
}

document.addEventListener("DOMContentLoaded", init);
