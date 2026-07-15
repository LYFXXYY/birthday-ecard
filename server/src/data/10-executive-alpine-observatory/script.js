const bgMusic = "";
const localMusic = "../music/music.mp3";

const screenOrder = ["cover", "name", "imprint", "compass", "wish", "message", "final"];
const paletteByScreen = {
  cover: ["#fbfdfb", "#8fc6e8", "#517c6c", "#c6a25a"],
  name: ["#d9eef7", "#ffffff", "#8fc6e8", "#c6a25a"],
  imprint: ["#d9e1e3", "#8fc6e8", "#517c6c", "#ffffff"],
  compass: ["#fbfdfb", "#8fc6e8", "#c6a25a", "#517c6c"],
  wish: ["#ffffff", "#d9eef7", "#8fc6e8", "#517c6c"],
  message: ["#fbfdfb", "#c6a25a", "#8fc6e8", "#ffffff"],
  final: ["#ffffff", "#d9eef7", "#8fc6e8", "#c6a25a"]
};

const app = document.querySelector(".card-app");
const canvas = document.getElementById("fxCanvas");
const ctx = canvas.getContext("2d");
const screens = [...document.querySelectorAll(".screen")];
const segments = [...document.querySelectorAll(".progress-segment")];
const musicToggle = document.querySelector(".music-toggle");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width = 0;
let height = 0;
let dpr = 1;
let activeScreen = "cover";
let audio = null;
let particles = [];
let contours = [];
let rings = [];
let touchStartY = 0;
let wheelLocked = false;

function random(min, max) {
  return min + Math.random() * (max - min);
}

function palette() {
  return paletteByScreen[activeScreen] || paletteByScreen.cover;
}

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function makeParticle(fromTop = false) {
  const colors = palette();
  return {
    x: random(0, width),
    y: fromTop ? random(-80, -12) : random(0, height),
    radius: random(0.6, 2.2),
    speed: random(0.06, 0.2),
    drift: random(-0.09, 0.09),
    alpha: random(0.08, 0.26),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeContour(fromSide = false) {
  const colors = palette();
  return {
    x: fromSide ? random(-160, -24) : random(-40, width),
    y: random(height * 0.12, height * 0.8),
    length: random(84, 190),
    speed: random(0.06, 0.16),
    wave: random(5, 16),
    alpha: random(0.05, 0.14),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function resetEffects() {
  particles = Array.from({ length: reduceMotion ? 10 : 34 }, () => makeParticle());
  contours = Array.from({ length: reduceMotion ? 2 : 9 }, () => makeContour());
  rings = [];
}

function updateMusicButton() {
  musicToggle.classList.toggle("is-paused", !audio || audio.paused);
}

function setupMusic() {
  const source = bgMusic && !bgMusic.includes("{{") ? bgMusic : localMusic;
  audio = new Audio(source);
  audio.loop = true;
  audio.preload = "auto";
  updateMusicButton();

  musicToggle.addEventListener("click", async () => {
    if (!audio) return;
    if (audio.paused) await audio.play().catch(() => {});
    else audio.pause();
    updateMusicButton();
  });

  document.addEventListener("WeixinJSBridgeReady", () => {
    if (audio && activeScreen !== "cover") audio.play().catch(() => {});
    updateMusicButton();
  });
}

async function tryPlayMusic() {
  if (!audio) return;
  await audio.play().catch(() => {});
  updateMusicButton();
}

function updateProgress() {
  segments.forEach((segment) => {
    segment.classList.toggle("is-active", segment.dataset.jump === activeScreen);
  });
}

function showScreen(name) {
  const currentIndex = screenOrder.indexOf(activeScreen);
  const nextIndex = screenOrder.indexOf(name);
  if (nextIndex < 0 || name === activeScreen) return;

  app.dataset.direction = nextIndex > currentIndex ? "next" : "prev";
  activeScreen = name;
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === name);
  });
  updateProgress();
  resetEffects();

  if (name !== "cover") tryPlayMusic();
}

function moveScreen(direction) {
  const currentIndex = screenOrder.indexOf(activeScreen);
  const nextIndex = Math.max(0, Math.min(screenOrder.length - 1, currentIndex + direction));
  if (nextIndex !== currentIndex) showScreen(screenOrder[nextIndex]);
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = particle.alpha;
  ctx.fillStyle = particle.color;
  ctx.shadowBlur = 11;
  ctx.shadowColor = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawContour(contour, time) {
  ctx.save();
  ctx.globalAlpha = contour.alpha;
  ctx.strokeStyle = contour.color;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  const wave = Math.sin(time * 0.001 + contour.x * 0.01) * contour.wave;
  ctx.moveTo(contour.x, contour.y);
  ctx.bezierCurveTo(
    contour.x + contour.length * 0.28,
    contour.y - wave,
    contour.x + contour.length * 0.62,
    contour.y + wave,
    contour.x + contour.length,
    contour.y - wave * 0.3
  );
  ctx.stroke();
  ctx.restore();
}

function drawFinalRings(time) {
  if (activeScreen !== "final" || reduceMotion) return;
  const colors = palette();
  const cx = width * 0.5;
  const cy = height * 0.34;
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = colors[3];
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i += 1) {
    const radius = 48 + i * 35 + Math.sin(time * 0.001 + i) * 7;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function updateEffects(time) {
  particles.forEach((particle) => {
    particle.y += particle.speed;
    particle.x += particle.drift + Math.sin((particle.y + time * 0.02) * 0.01) * 0.025;
    if (particle.y > height + 14) Object.assign(particle, makeParticle(true), { y: -10 });
    drawParticle(particle);
  });

  contours.forEach((contour) => {
    contour.x += contour.speed;
    if (contour.x > width + contour.length) Object.assign(contour, makeContour(true), { x: -contour.length });
    drawContour(contour, time);
  });

  drawFinalRings(time);
}

function tick(time) {
  ctx.clearRect(0, 0, width, height);
  updateEffects(time);
  requestAnimationFrame(tick);
}

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.next));
});

segments.forEach((segment) => {
  segment.addEventListener("click", () => showScreen(segment.dataset.jump));
});

window.addEventListener("resize", () => {
  resizeCanvas();
  resetEffects();
});

document.addEventListener("touchstart", (event) => {
  touchStartY = event.changedTouches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", (event) => {
  const diff = touchStartY - event.changedTouches[0].clientY;
  if (Math.abs(diff) < 68) return;
  moveScreen(diff > 0 ? 1 : -1);
}, { passive: true });

document.addEventListener("wheel", (event) => {
  if (wheelLocked || Math.abs(event.deltaY) < 48) return;
  wheelLocked = true;
  moveScreen(event.deltaY > 0 ? 1 : -1);
  window.setTimeout(() => { wheelLocked = false; }, 760);
}, { passive: true });

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") moveScreen(1);
  if (event.key === "ArrowUp" || event.key === "PageUp") moveScreen(-1);
});

window.CARD_SCREEN_ORDER = screenOrder;
window.showScreen = showScreen;
window.stopAutoPlay = stopAutoPlay;
window.startAutoPlaySequence = startAutoPlaySequence;

// ========================================================
//  逗号断行：以逗号/分号为界换行，移除标点
// ========================================================
function formatBlessingText() {
  var selectors = "h1, h2, h3, .hero-copy, .message-text, .signatureCopy, "
    + ".support-note, .year-note, .lead, .note, "
    + ".copy-panel > p:not(.eyebrow):not(.meta-line):not(.progress-tag):not(.sig-company), "
    + ".copy-block > p:not(.eyebrow):not(.meta-line):not(.progress-tag):not(.sig-company), "
    + ".copy-stack > p:not(.eyebrow):not(.meta-line):not(.progress-tag):not(.sig-company)";

  document.querySelectorAll(selectors).forEach(function(el) {
    if (el.dataset.formatted === "true") return;
    if (el.querySelector("*")) return;

    var text = el.textContent.trim();
    if (!text) return;

    var parts = text.split(/[，；]/).map(function(s) { return s.trim(); }).filter(Boolean);

    if (parts.length > 1) {
      el.textContent = "";
      parts.forEach(function(part) {
        var span = document.createElement("span");
        span.className = "comma-line";
        span.style.display = "block";
        span.textContent = part.replace(/[。]+$/, "");
        el.appendChild(span);
      });
      el.dataset.formatted = "true";
    } else {
      el.textContent = text.replace(/[。]+$/, "");
      el.dataset.formatted = "true";
    }
  });
}

// ===== 自动播放状态 =====
var autoPlayTimer = null;
var totalPages = 7;
var totalDuration = 26000;
var autoPlayInterval = 3714;
var isAutoPlaying = false;

function startAutoPlaySequence() {
  if (isAutoPlaying) return;
  isAutoPlaying = true;
  autoPlayTimer = setInterval(function() {
    var currentIndex = screenOrder.indexOf(activeScreen);
    if (currentIndex < screenOrder.length - 1) {
      moveScreen(1);
    } else {
      stopAutoPlay();
    }
  }, autoPlayInterval);
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
  isAutoPlaying = false;
}

setTimeout(startAutoPlaySequence, 500);

document.addEventListener("DOMContentLoaded", formatBlessingText);
formatBlessingText();

resizeCanvas();
resetEffects();
setupMusic();
tick(0);
