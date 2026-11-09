// Menu mobile
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("nav");
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});
nav.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }),
);

// Slideshow galeri kegiatan
const carousel = document.querySelector(".activity-carousel");
const track = carousel.querySelector(".activity-track");
const slides = [...track.querySelectorAll(".activity-slide")];
const indicators = carousel.querySelector(".activity-indicators");
const counter = carousel.querySelector(".activity-counter");
const thumbStrip = carousel.querySelector(".activity-thumbs");
const viewport = carousel.querySelector(".activity-viewport");
const playToggle = carousel.querySelector(".activity-play");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let currentSlide = 0;
let autoplayTimer;
let isHovered = false;
let hasFocus = false;
let userPaused = reducedMotion.matches;

function updatePlayToggle() {
  playToggle.setAttribute("aria-pressed", String(userPaused));
  playToggle.setAttribute(
    "aria-label",
    userPaused ? "Mulai slideshow" : "Jeda slideshow",
  );
  playToggle.textContent = userPaused ? "▶" : "Ⅱ";
}

const dots = slides.map((slide, index) => {
  const dot = document.createElement("button");
  dot.type = "button";
  dot.className = "activity-dot";
  dot.setAttribute("aria-label", `Tampilkan foto ${index + 1}`);
  dot.addEventListener("click", () => showSlide(index));
  indicators.append(dot);
  return dot;
});

const thumbs = slides.map((slide, index) => {
  const img = slide.querySelector("img");
  const title = slide.querySelector("h3")?.textContent.trim() ?? "";
  const tag = slide.querySelector("small")?.textContent.trim() ?? "";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "activity-thumb";
  btn.setAttribute("aria-label", `Tampilkan foto ${index + 1}: ${title}`);
  btn.innerHTML = `<img alt="" loading="lazy" decoding="async"><span><b></b><small></small></span>`;
  btn.querySelector("img").src = img.getAttribute("src");
  btn.querySelector("b").textContent = title;
  btn.querySelector("small").textContent = tag;
  btn.addEventListener("click", () => showSlide(index));
  thumbStrip.append(btn);
  return btn;
});

function scrollThumbIntoView() {
  const t = thumbs[currentSlide];
  const left = t.offsetLeft - (thumbStrip.clientWidth - t.offsetWidth) / 2;
  thumbStrip.scrollTo({
    left: Math.max(0, left),
    behavior: reducedMotion.matches ? "auto" : "smooth",
  });
}

function showSlide(index) {
  currentSlide = (index + slides.length) % slides.length;
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === currentSlide;
    slide.setAttribute("aria-hidden", String(!active));
    slide.inert = !active;
    const image = slide.querySelector("img");
    if (active && image) image.loading = "eager";
    dots[slideIndex].setAttribute("aria-current", String(active));
    thumbs[slideIndex].setAttribute("aria-current", String(active));
  });
  scrollThumbIntoView();
  counter.textContent = `${String(currentSlide + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
}

function stopAutoplay() {
  window.clearInterval(autoplayTimer);
  autoplayTimer = undefined;
}

function syncAutoplay() {
  const shouldPlay = !isHovered && !hasFocus && !userPaused && !document.hidden;
  if (shouldPlay && !autoplayTimer) {
    autoplayTimer = window.setInterval(() => showSlide(currentSlide + 1), 4000);
  } else if (!shouldPlay) {
    stopAutoplay();
  }
}

carousel.querySelectorAll("[data-slide-direction]").forEach((button) => {
  button.addEventListener("click", () => {
    showSlide(currentSlide + Number(button.dataset.slideDirection));
  });
});
playToggle.addEventListener("click", () => {
  userPaused = !userPaused;
  updatePlayToggle();
  syncAutoplay();
});
carousel.addEventListener("mouseenter", () => {
  isHovered = true;
  syncAutoplay();
});
carousel.addEventListener("mouseleave", () => {
  isHovered = false;
  syncAutoplay();
});
carousel.addEventListener("focusin", () => {
  hasFocus = true;
  syncAutoplay();
});
carousel.addEventListener("focusout", (event) => {
  if (!carousel.contains(event.relatedTarget)) {
    hasFocus = false;
    syncAutoplay();
  }
});
// Swipe di layar sentuh
let touchStartX = null;
let touchStartY = 0;
viewport.addEventListener(
  "touchstart",
  (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  },
  { passive: true },
);
viewport.addEventListener("touchend", (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  touchStartX = null;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    showSlide(currentSlide + (dx < 0 ? 1 : -1));
  }
});
// Panah keyboard
carousel.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") showSlide(currentSlide + 1);
  if (e.key === "ArrowLeft") showSlide(currentSlide - 1);
});
document.addEventListener("visibilitychange", syncAutoplay);
reducedMotion.addEventListener("change", (event) => {
  userPaused = event.matches;
  updatePlayToggle();
  syncAutoplay();
});
updatePlayToggle();
showSlide(0);
syncAutoplay();

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
