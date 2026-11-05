// Menu mobile
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("nav");
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});
nav
  .querySelectorAll("a")
  .forEach((a) =>
    a.addEventListener("click", () => nav.classList.remove("open")),
  );

// Reveal saat scroll
const targets = document.querySelectorAll(
  ".section, .lab-card, .cta, .trio > div",
);
targets.forEach((el) => el.classList.add("reveal"));
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 },
);
targets.forEach((el) => io.observe(el));

// Model 3D: hentikan auto-rotate di tab yang tidak aktif (hemat performa)
document.addEventListener("visibilitychange", () => {
  document.querySelectorAll("model-viewer").forEach((m) => {
    m.autoRotate = !document.hidden;
  });
});
