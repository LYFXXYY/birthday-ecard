const bgMusic = "{{music_url}}";
const localMusic = "../music/music.mp3";

const screenOrder = ["cover", "name", "imprint", "compass", "wish", "message", "final"];
const paletteByScreen = {
  cover: ["#fffdf7", "#6fb7d6", "#d7b86a", "#e9796f"],
  name: ["#edf8fb", "#ffffff", "#6fb7d6", "#d7b86a"],
  imprint: ["#dce6e9", "#6fb7d6", "#d7b86a", "#ffffff"],
  compass: ["#fffdf7", "#6fb7d6", "#e9796f", "#d7b86a"],
  wish: ["#ffffff", "#edf8fb", "#6fb7d6", "#d7b86a"],
  message: ["#fffdf7", "#d7b86a", "#6fb7d6", "#ffffff"],
  final: ["#ffffff", "#edf8fb", "#6fb7d6", "#e9796f"]
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
let wakeLines = [];
let glints = [];
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
    radius: random(0.6, 2.1),
    speed: random(0.06, 0.2),
    drift: random(-0.1, 0.1),
    alpha: random(0.08, 0.26),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeWakeLine(fromSide = false) {
  const colors = palette();
  return {
    x: fromSide ? random(-160, -24) : random(-40, width),
    y: random(height * 0.16, height * 0.84),
    length: random(78, 180),
    speed: random(0.08, 0.2),
    slope: random(-0.16, 0.12),
    alpha: random(0.05, 0.15),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeGlint(fromSide = false) {
  const colors = palette();
  return {
    x: fromSide ? random(-120, -20) : random(0, width),
    y: random(height * 0.08, height * 0.72),
    size: random(8, 18),
    speed: random(0.08, 0.18),
    alpha: random(0.08, 0.2),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function resetEffects() {
  particles = Array.from({ length: reduceMotion ? 10 : 32 }, () => makeParticle());
  wakeLines = Array.from({ length: reduceMotion ? 2 : 9 }, () => makeWakeLine());
  glints = Array.from({ length: reduceMotion ? 2 : 8 }, () => makeGlint());
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
  ctx.shadowBlur = 10;
  ctx.shadowColor = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWakeLine(line) {
  ctx.save();
  ctx.globalAlpha = line.alpha;
  const gradient = ctx.createLinearGradient(line.x, line.y, line.x + line.length, line.y + line.length * line.slope);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(0.48, line.color);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(line.x, line.y);
  ctx.lineTo(line.x + line.length, line.y + line.length * line.slope);
  ctx.stroke();
  ctx.restore();
}

function drawGlint(glint, time) {
  ctx.save();
  ctx.translate(glint.x, glint.y);
  ctx.rotate(Math.sin(time * 0.001 + glint.x * 0.01) * 0.5);
  ctx.globalAlpha = glint.alpha;
  ctx.strokeStyle = glint.color;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-glint.size, 0);
  ctx.lineTo(glint.size, 0);
  ctx.moveTo(0, -glint.size * 0.6);
  ctx.lineTo(0, glint.size * 0.6);
  ctx.stroke();
  ctx.restore();
}

function drawFinalHalo(time) {
  if (activeScreen !== "final" || reduceMotion) return;
  const colors = palette();
  const cx = width * 0.5;
  const cy = height * 0.34;
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = colors[2];
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i += 1) {
    const radius = 48 + i * 34 + Math.sin(time * 0.0011 + i) * 8;
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

  wakeLines.forEach((line) => {
    line.x += line.speed;
    line.y += line.speed * line.slope;
    if (line.x > width + line.length) Object.assign(line, makeWakeLine(true), { x: -line.length });
    drawWakeLine(line);
  });

  glints.forEach((glint) => {
    glint.x += glint.speed;
    if (glint.x > width + glint.size) Object.assign(glint, makeGlint(true), { x: -glint.size });
    drawGlint(glint, time);
  });

  drawFinalHalo(time);
}

function tick(time) {
  ctx.clearRect(0, 0, width, height);
  updateEffects(time);
  requestAnimationFrame(tick);
}

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

// ===== 逗号断行 =====
function formatBlessingText() {
  var selectors = "h1, h2, h3, .hero-copy, .message-text, .signature-copy, "
    + ".support-note, .year-note, .lead, .message, .note, "
    + ".copy-panel > p:not(.eyebrow):not(.meta-line):not(.progress-tag):not(.sig-company):not(.sig-date)";

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

// ===== 自动播放 =====
let autoPlayTimer = null;
const totalDuration = 26000;
const autoPlayInterval = totalDuration / screenOrder.length;
let isAutoPlaying = false;

function startAutoPlaySequence() {
  if (isAutoPlaying) return;
  isAutoPlaying = true;

  autoPlayTimer = setInterval(() => {
    const currentIndex = screenOrder.indexOf(activeScreen);
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

window.CARD_SCREEN_ORDER = screenOrder;
window.showScreen = showScreen;
window.startAutoPlaySequence = startAutoPlaySequence;
window.stopAutoPlay = stopAutoPlay;

resizeCanvas();
resetEffects();
document.addEventListener("DOMContentLoaded", formatBlessingText);
formatBlessingText();
setupMusic();
tick(0);
