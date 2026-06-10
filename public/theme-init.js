/* Sets the theme before first paint to avoid a flash. Classic script (no inline,
   so the page can keep a strict, inline-script-free Content-Security-Policy). */
(function () {
  try {
    var t = localStorage.getItem("nh-theme");
    if (t !== "light" && t !== "dark") {
      t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
