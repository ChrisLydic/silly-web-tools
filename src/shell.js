/* Shared shell for every page: self-hosted fonts + theme toggle + mobile menu.
   Imported (for side effects) by app.js and bg.js. */
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
// Free OFL fallback for the proprietary TAYBea display font (which is not in the repo).
import "@fontsource/alegreya/400.css";
import "@fontsource/alegreya/700.css";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("nh-theme", theme); } catch {}
}

function initShell() {
  const toggle = document.querySelector("#themeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }
  const menu = document.querySelector("#mobileMenu");
  const burger = document.querySelector("#hamburger");
  if (menu && burger) {
    burger.addEventListener("click", () => menu.classList.toggle("open"));
    menu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => menu.classList.remove("open")));
  }
  const yr = document.querySelector("#year");
  if (yr) yr.textContent = new Date().getFullYear();
}

// Lightweight transient toast, shared by every tool (e.g. unsupported files).
export function toast(message, type = "error") {
  let host = document.getElementById("nh-toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "nh-toasts";
    host.className = "nh-toasts";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "nh-toast nh-toast--" + type;
  el.setAttribute("role", "status");
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 3800);
}

document.addEventListener("DOMContentLoaded", initShell);
