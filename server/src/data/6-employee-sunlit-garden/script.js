const bgMusic = "";
const localMusic = "../music/music.mp3";

const screenOrder = ["cover", "wish", "highlight", "final"];
const recorderScreenAliases = {
  cover: "cover",
  name: "wish",
  imprint: "highlight",
  compass: "final",
  wish: "final",
  message: "final",
  final: "final"
};
const fallbackScreenAliases = {
  name: "wish",
  imprint: "highlight",
  compass: "highlight",
  message: "final"
};
const paletteByScreen = {
  cover: ["#9fdcc8", "#f5d767", "#ffffff", "#f47f6b"],
  wish: ["#bcebd8", "#fff6bf", "#f8a694", "#7fcbb6"],
  highlight: ["#f47f6b", "#f5d767", "#9fdcc8", "#ffffff"],
  final: ["#fff8cf", "#8ed9c2", "#ffad9a", "#c4e8f7"]
};

const app = document.querySelector(".card-app");
const canvas = document.getElementById("fxCanvas");
const ctx = canvas.getContext("2d");
const screens = [...document.querySelectorAll(".screen")];
const dots = [...document.querySelectorAll(".dot")];
const musicToggle = document.querySelector(".music-toggle");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width = 0;
let height = 0;
let dpr = 1;
let activeScreen = "cover";
let audio = null;
let dust = [];
let petals = [];
let ribbons = [];
let bursts = [];
let finaleTimer = null;
let touchStartY = 0;
let wheelLocked = false;
const isRecording = new URLSearchParams(window.location.search).has("recording");

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

function makeDust(fromTop = false) {
  const colors = palette();
  return {
    x: random(0, width),
    y: fromTop ? random(-80, -10) : random(0, height),
    radius: random(0.7, 2.2),
    speed: random(0.08, 0.28),
    drift: random(-0.12, 0.12),
    alpha: random(0.12, 0.34),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makePetal(fromTop = false) {
  const colors = palette();
  return {
    x: random(width * 0.04, width * 0.96),
    y: fromTop ? random(-110, -20) : random(-height * 0.1, height),
    vy: random(0.28, 0.78),
    vx: random(-0.16, 0.16),
    size: random(7, 15),
    angle: random(0, Math.PI * 2),
    spin: random(-0.024, 0.024),
    alpha: random(0.22, 0.58),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeRibbon(fromSide = false) {
  const colors = palette();
  return {
    x: fromSide ? random(-140, -20) : random(-40, width),
    y: random(height * 0.18, height * 0.82),
    length: random(58, 118),
    speed: random(0.06, 0.16),
    wave: random(8, 20),
    alpha: random(0.06, 0.15),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function resetEffects() {
  dust = Array.from({ length: reduceMotion ? 12 : 34 }, () => makeDust());
  petals = Array.from({ length: reduceMotion ? 4 : 16 }, () => makePetal());
  ribbons = Array.from({ length: reduceMotion ? 2 : 7 }, () => makeRibbon());
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

function stopFinale() {
  if (finaleTimer) {
    clearInterval(finaleTimer);
    finaleTimer = null;
  }
  bursts = [];
}

function launchBloom() {
  const colors = palette();
  const cx = random(width * 0.22, width * 0.78);
  const cy = random(height * 0.16, height * 0.44);
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18;
    bursts.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * random(0.7, 1.9),
      vy: Math.sin(angle) * random(0.7, 1.9),
      size: random(5, 10),
      alpha: 0.82,
      color: colors[Math.floor(random(0, colors.length))]
    });
  }
}

function startFinale() {
  stopFinale();
  if (reduceMotion) return;
  launchBloom();
  finaleTimer = window.setInterval(launchBloom, 1400);
}

function updateDots() {
  dots.forEach((dot) => {
    dot.classList.toggle("is-active", dot.dataset.jump === activeScreen);
  });
}

function normalizeScreenName(name) {
  if (screenOrder.includes(name)) return name;
  if (isRecording && recorderScreenAliases[name]) return recorderScreenAliases[name];
  return fallbackScreenAliases[name] || name;
}

function showScreen(name) {
  const targetName = normalizeScreenName(name);
  const currentIndex = screenOrder.indexOf(activeScreen);
  const nextIndex = screenOrder.indexOf(targetName);
  if (nextIndex < 0 || targetName === activeScreen) return;

  app.dataset.direction = nextIndex > currentIndex ? "next" : "prev";
  activeScreen = targetName;
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === targetName);
  });
  updateDots();
  resetEffects();

  if (targetName !== "cover") tryPlayMusic();
  if (targetName === "final") startFinale();
  else stopFinale();
}

function moveScreen(direction) {
  const currentIndex = screenOrder.indexOf(activeScreen);
  const nextIndex = Math.max(0, Math.min(screenOrder.length - 1, currentIndex + direction));
  if (nextIndex !== currentIndex) showScreen(screenOrder[nextIndex]);
}

function drawDust(particle) {
  ctx.save();
  ctx.globalAlpha = particle.alpha;
  ctx.fillStyle = particle.color;
  ctx.shadowBlur = 12;
  ctx.shadowColor = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPetal(petal) {
  ctx.save();
  ctx.translate(petal.x, petal.y);
  ctx.rotate(petal.angle);
  ctx.globalAlpha = petal.alpha;
  ctx.fillStyle = petal.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, petal.size * 0.46, petal.size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRibbon(ribbon, time) {
  ctx.save();
  ctx.globalAlpha = ribbon.alpha;
  ctx.strokeStyle = ribbon.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const wave = Math.sin(time * 0.001 + ribbon.x * 0.01) * ribbon.wave;
  ctx.moveTo(ribbon.x, ribbon.y);
  ctx.bezierCurveTo(
    ribbon.x + ribbon.length * 0.32,
    ribbon.y - wave,
    ribbon.x + ribbon.length * 0.64,
    ribbon.y + wave,
    ribbon.x + ribbon.length,
    ribbon.y - wave * 0.35
  );
  ctx.stroke();
  ctx.restore();
}

function drawBurst(spark) {
  ctx.save();
  ctx.globalAlpha = spark.alpha;
  ctx.fillStyle = spark.color;
  ctx.beginPath();
  ctx.ellipse(spark.x, spark.y, spark.size * 0.36, spark.size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function updateEffects(time) {
  dust.forEach((particle) => {
    particle.y += particle.speed;
    particle.x += particle.drift + Math.sin((particle.y + time * 0.02) * 0.01) * 0.04;
    if (particle.y > height + 14) Object.assign(particle, makeDust(true), { y: -10 });
    drawDust(particle);
  });

  if (activeScreen === "highlight" || activeScreen === "final") {
    petals.forEach((petal) => {
      petal.y += petal.vy;
      petal.x += petal.vx + Math.sin(time * 0.001 + petal.y * 0.02) * 0.18;
      petal.angle += petal.spin;
      if (petal.y > height + 28) Object.assign(petal, makePetal(true), { y: -18 });
      drawPetal(petal);
    });
  }

  ribbons.forEach((ribbon) => {
    ribbon.x += ribbon.speed;
    if (ribbon.x > width + ribbon.length) Object.assign(ribbon, makeRibbon(true), { x: -ribbon.length });
    drawRibbon(ribbon, time);
  });

  bursts = bursts.filter((spark) => spark.alpha > 0.04);
  bursts.forEach((spark) => {
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vy += 0.01;
    spark.alpha *= 0.965;
    drawBurst(spark);
  });
}

function tick(time) {
  ctx.clearRect(0, 0, width, height);
  updateEffects(time);
  requestAnimationFrame(tick);
}

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.next));
});

dots.forEach((dot) => {
  dot.addEventListener("click", () => showScreen(dot.dataset.jump));
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
  if (Math.abs(diff) < 64) return;
  moveScreen(diff > 0 ? 1 : -1);
}, { passive: true });

document.addEventListener("wheel", (event) => {
  if (wheelLocked || Math.abs(event.deltaY) < 46) return;
  wheelLocked = true;
  moveScreen(event.deltaY > 0 ? 1 : -1);
  window.setTimeout(() => { wheelLocked = false; }, 740);
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
var totalPages = 4;
var totalDuration = 26000;
var autoPlayInterval = 6500;
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
