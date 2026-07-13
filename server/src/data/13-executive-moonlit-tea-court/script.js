const bgMusic = "{{music_url}}";
const localMusic = "../music/music.mp3";

const screenOrder = ["cover", "name", "imprint", "compass", "wish", "message", "final"];
const paletteByScreen = {
  cover: ["#f2efe5", "#9db9aa", "#31485d", "#c18b4d"],
  name: ["#d5dbd2", "#f2efe5", "#9db9aa", "#c18b4d"],
  imprint: ["#31485d", "#9db9aa", "#f2efe5", "#c18b4d"],
  compass: ["#f2efe5", "#9db9aa", "#31485d", "#d5dbd2"],
  wish: ["#d5dbd2", "#f2efe5", "#c18b4d", "#9db9aa"],
  message: ["#f2efe5", "#9db9aa", "#31485d", "#c18b4d"],
  final: ["#f2efe5", "#c18b4d", "#9db9aa", "#31485d"]
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
let motes = [];
let ripples = [];
let steamLines = [];
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

function makeMote(fromTop = false) {
  const colors = palette();
  return {
    x: random(0, width),
    y: fromTop ? random(-90, -12) : random(0, height),
    radius: random(0.6, 2.2),
    speed: random(0.04, 0.16),
    drift: random(-0.08, 0.08),
    alpha: random(0.08, 0.24),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeRipple() {
  const colors = palette();
  return {
    x: random(width * 0.2, width * 0.82),
    y: random(height * 0.25, height * 0.78),
    radius: random(18, 82),
    growth: random(0.045, 0.13),
    alpha: random(0.05, 0.14),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeSteamLine(fromBottom = false) {
  const colors = palette();
  return {
    x: random(width * 0.12, width * 0.88),
    y: fromBottom ? random(height + 24, height + 90) : random(height * 0.18, height * 0.86),
    length: random(54, 130),
    speed: random(0.08, 0.22),
    phase: random(0, Math.PI * 2),
    alpha: random(0.05, 0.13),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function resetEffects() {
  motes = Array.from({ length: reduceMotion ? 10 : 34 }, () => makeMote());
  ripples = Array.from({ length: reduceMotion ? 2 : 8 }, () => makeRipple());
  steamLines = Array.from({ length: reduceMotion ? 2 : 9 }, () => makeSteamLine());
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

function drawMote(mote) {
  ctx.save();
  ctx.globalAlpha = mote.alpha;
  ctx.fillStyle = mote.color;
  ctx.shadowBlur = 10;
  ctx.shadowColor = mote.color;
  ctx.beginPath();
  ctx.arc(mote.x, mote.y, mote.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRipple(ripple) {
  ctx.save();
  ctx.globalAlpha = ripple.alpha;
  ctx.strokeStyle = ripple.color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(ripple.x, ripple.y, ripple.radius * 1.55, ripple.radius * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSteamLine(line, time) {
  const lift = Math.sin(time * 0.001 + line.phase) * 7;
  ctx.save();
  ctx.globalAlpha = line.alpha;
  ctx.strokeStyle = line.color;
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  ctx.moveTo(line.x, line.y);
  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    const x = line.x + Math.sin(line.phase + t * Math.PI * 2 + time * 0.0008) * 12;
    const y = line.y - line.length * t + lift * t;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawFinalHalo(time) {
  if (activeScreen !== "final" || reduceMotion) return;
  const colors = palette();
  const cx = width * 0.5;
  const cy = height * 0.34;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const radius = 44 + i * 30 + Math.sin(time * 0.001 + i) * 7;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function updateEffects(time) {
  motes.forEach((mote) => {
    mote.y += mote.speed;
    mote.x += mote.drift + Math.sin((mote.y + time * 0.02) * 0.012) * 0.025;
    if (mote.y > height + 12) Object.assign(mote, makeMote(true), { y: -8 });
    drawMote(mote);
  });

  ripples.forEach((ripple) => {
    ripple.radius += ripple.growth;
    ripple.alpha *= 0.997;
    if (ripple.radius > 120 || ripple.alpha < 0.035) Object.assign(ripple, makeRipple());
    drawRipple(ripple);
  });

  steamLines.forEach((line) => {
    line.y -= line.speed;
    if (line.y < -line.length) Object.assign(line, makeSteamLine(true), { y: height + line.length });
    drawSteamLine(line, time);
  });

  drawFinalHalo(time);
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
