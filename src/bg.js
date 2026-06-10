/* ===========================================================================
   Tools by Note Hoard — Background Remover
   100% client-side via @imgly/background-removal (AGPL). Model + ONNX runtime
   are self-hosted under /imgly/ — no third-party requests at runtime.
   The cutout is computed once per image; changing the background just
   re-composites from the stored transparent result (no model re-run).
   =========================================================================== */
import { toast } from "./shell.js";

const $ = (s) => document.querySelector(s);

let _imgly, _jszip;
const ensureImgly = () => (_imgly ??= import("@imgly/background-removal"));
const ensureJSZip = () => (_jszip ??= import("jszip"));

const IMGLY_CONFIG = {
  publicPath: new URL("/imgly/", location.origin).href,
  model: "small",
  output: { format: "image/png" },
};

const state = { items: [], bg: "transparent", color: "#ffffff", runId: 0, modelReady: false };

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
const accepts = (f) => /image\/(jpeg|png|webp)/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);

function setModelLoading(show, pct) {
  const el = $("#modelLoading");
  if (!el) return;
  el.classList.toggle("hidden", !show);
  const bar = $("#modelBar");
  if (bar && pct != null) bar.style.width = Math.max(4, Math.round(pct * 100)) + "%";
}

function onProgress(_key, current, total) {
  if (state.modelReady) return;
  if (total) setModelLoading(true, current / total);
}

async function removeOne(file) {
  const { removeBackground } = await ensureImgly();
  return await removeBackground(file, { ...IMGLY_CONFIG, progress: (k, c, t) => onProgress(k, c, t) });
}

async function composite(cutoutBlob) {
  if (state.bg === "transparent") return cutoutBlob;
  const bmp = await createImageBitmap(cutoutBlob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = state.bg === "white" ? "#ffffff" : state.color;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0);
  if (bmp.close) bmp.close();
  return await new Promise((r) => c.toBlob(r, "image/png"));
}

async function runAll() {
  const runId = ++state.runId;
  for (const it of state.items) {
    if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    it.outUrl = null; it.blob = null; it.cutout = null; it.error = null; it.status = "pending";
  }
  render();
  for (const it of state.items) {
    if (runId !== state.runId) return;
    try {
      if (!state.modelReady) setModelLoading(true, 0);
      const cutout = await removeOne(it.file);
      state.modelReady = true;
      setModelLoading(false);
      if (runId !== state.runId) return;
      it.cutout = cutout;
      it.blob = await composite(cutout);
      it.outName = baseName(it.file.name) + ".png";
      it.outUrl = URL.createObjectURL(it.blob);
      it.status = "done";
    } catch (err) {
      console.error(err);
      it.error = (err && err.message) ? err.message : "Couldn't remove background";
      it.status = "error";
      setModelLoading(false);
    }
    render();
  }
}

async function recomposite() {
  for (const it of state.items) {
    if (!it.cutout) continue;
    try {
      if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      it.blob = await composite(it.cutout);
      it.outUrl = URL.createObjectURL(it.blob);
    } catch (err) {
      console.error(err);
      it.error = (err && err.message) ? err.message : "Failed";
      it.status = "error";
    }
  }
  render();
}

function render() {
  const results = $("#results");
  const list = $("#resultsList");
  if (!state.items.length) { results.classList.add("hidden"); list.innerHTML = ""; return; }
  results.classList.remove("hidden");
  const done = state.items.filter((i) => i.status === "done");
  $("#resultsTitle").textContent =
    done.length === state.items.length
      ? `${done.length} ${done.length === 1 ? "image" : "images"} done`
      : `Removing background from ${state.items.length} ${state.items.length === 1 ? "image" : "images"}…`;
  $("#downloadAll").disabled = done.length === 0;
  list.innerHTML = state.items.map(rowHTML).join("");
}

function rowHTML(it) {
  const thumb =
    it.status === "done" && it.outUrl
      ? `<div class="row__thumb alpha"><img src="${it.outUrl}" alt=""></div>`
      : `<div class="row__thumb">${SVG.image}</div>`;
  let meta;
  if (it.status === "error") {
    meta = `<span class="row__size" style="color:var(--error)">${escapeHtml(it.error)}</span>`;
  } else {
    meta = `<span class="conv-chip">PNG</span><span class="row__size">${it.status === "done" ? fmtBytes(it.blob.size) : "…"}</span>`;
  }
  let action;
  if (it.status === "pending") {
    action = `<span class="row__status"><span class="spinner"></span></span>`;
  } else if (it.status === "error") {
    action = `<span class="row__status error">${SVG.alert}<span class="label">Failed</span></span>`;
  } else {
    action = `<span class="row__status done">${SVG.check}<span class="label">Done</span></span>
      <a class="btn btn-ghost btn-sm" href="${it.outUrl}" download="${escapeHtml(it.outName)}">${SVG.download}<span>Download</span></a>`;
  }
  return `<div class="row">${thumb}
    <div class="row__info"><div class="row__name">${escapeHtml(it.file.name)}</div><div class="row__meta">${meta}</div></div>
    ${action}</div>`;
}

function addFiles(fileList) {
  const ok = [...fileList].filter(accepts);
  if (!ok.length) {
    if (fileList && fileList.length) toast("Add a JPG, PNG or WebP image.");
    return;
  }
  for (const f of ok) {
    state.items.push({
      id: (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()),
      file: f, status: "pending", cutout: null, blob: null, outUrl: null, outName: null, error: null,
    });
  }
  runAll();
}

async function downloadAll() {
  const done = state.items.filter((i) => i.status === "done");
  if (!done.length) return;
  const btn = $("#downloadAll");
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span><span>Zipping…</span>`;
  try {
    const { default: JSZip } = await ensureJSZip();
    const zip = new JSZip();
    const seen = new Map();
    for (const it of done) {
      let n = it.outName;
      if (seen.has(n)) { const k = seen.get(n) + 1; seen.set(n, k); n = `${baseName(it.outName)}-${k}.png`; }
      else seen.set(n, 1);
      zip.file(n, it.blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "backgrounds-removed.zip");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) {
    console.error(e);
    alert("Sorry — could not build the ZIP. You can still download files individually.");
  } finally {
    btn.innerHTML = orig;
    btn.disabled = false;
  }
}

function initBg() {
  const dz = $("#dropzone");
  if (!dz) return;
  const input = $("#fileInput");
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === "dragleave" && dz.contains(e.relatedTarget)) return;
    dz.classList.remove("dragover");
  }));
  dz.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  const bgOpts = $("#bgOptions");
  if (bgOpts) {
    bgOpts.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-bg]");
      if (!b) return;
      state.bg = b.dataset.bg;
      bgOpts.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      $("#bgColor").classList.toggle("hidden", state.bg !== "color");
      if (state.items.length) recomposite();
    });
  }
  const colorInput = $("#bgColor");
  if (colorInput) {
    colorInput.addEventListener("input", () => {
      state.color = colorInput.value;
      state.bg = "color";
      $("#bgOptions").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x.dataset.bg === "color"));
      if (state.items.length) recomposite();
    });
  }

  $("#downloadAll").addEventListener("click", downloadAll);
}

document.addEventListener("DOMContentLoaded", initBg);
