const bgMusic = "{{music_url}}";
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
  cover: ["#c8bddf", "#b63762", "#4e9ea6", "#fff7ee"],
  wish: ["#fff7ee", "#d99755", "#b63762", "#c8bddf"],
  highlight: ["#4e9ea6", "#c8bddf", "#fff7ee", "#b63762"],
  final: ["#fff7ee", "#d99755", "#b63762", "#4e9ea6"]
};

const app = document.querySelector(".card-app");
const canvas = document.getElementById("fxCanvas");
const ctx = canvas.getContext("2d");
const screens = [...document.querySelectorAll(".screen")];
const dots = [...document.querySelectorAll(".dot")];
const musicToggle = document.querySelector(".music-toggle");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isRecording = new URLSearchParams(window.location.search).has("recording");

let width = 0;
let height = 0;
let dpr = 1;
let activeScreen = "cover";
let audio = null;
let raindrops = [];
let glints = [];
let candyDots = [];
let sugarBursts = [];
let finaleTimer = null;
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

function makeRaindrop(fromTop = false) {
  return {
    x: random(0, width),
    y: fromTop ? random(-120, -18) : random(0, height),
    length: random(22, 68),
    speed: random(0.55, 1.45),
    wobble: random(0.006, 0.016),
    alpha: random(0.12, 0.28)
  };
}

function makeGlint(fromSide = false) {
  const colors = palette();
  return {
    x: fromSide ? random(-90, -18) : random(0, width),
    y: random(height * 0.08, height * 0.76),
    length: random(34, 92),
    speed: random(0.08, 0.2),
    tilt: random(-0.35, 0.18),
    alpha: random(0.06, 0.16),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeCandyDot(fromTop = false) {
  const colors = palette();
  return {
    x: random(width * 0.04, width * 0.96),
    y: fromTop ? random(-80, -12) : random(-height * 0.05, height),
    vx: random(-0.12, 0.12),
    vy: random(0.12, 0.42),
    size: random(2.1, 5.6),
    alpha: random(0.14, 0.42),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function resetEffects() {
  raindrops = Array.from({ length: reduceMotion ? 10 : 34 }, () => makeRaindrop());
  glints = Array.from({ length: reduceMotion ? 2 : 8 }, () => makeGlint());
  candyDots = Array.from({ length: reduceMotion ? 5 : 22 }, () => makeCandyDot());
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
  sugarBursts = [];
}

function launchSugarBurst() {
  const colors = palette();
  const cx = random(width * 0.2, width * 0.78);
  const cy = random(height * 0.16, height * 0.42);
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18;
    sugarBursts.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * random(0.5, 1.45),
      vy: Math.sin(angle) * random(0.5, 1.45),
      size: random(2.4, 6.4),
      alpha: 0.68,
      color: colors[Math.floor(random(0, colors.length))]
    });
  }
}

function startFinale() {
  stopFinale();
  if (reduceMotion) return;
  launchSugarBurst();
  finaleTimer = window.setInterval(launchSugarBurst, 1650);
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

function drawRaindrop(drop, time) {
  const x = drop.x + Math.sin(time * drop.wobble + drop.y * 0.018) * 5;
  const gradient = ctx.createLinearGradient(x, drop.y, x + 8, drop.y + drop.length);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(0.35, "rgba(255, 247, 238, 0.62)");
  gradient.addColorStop(1, "rgba(78, 158, 166, 0)");
  ctx.save();
  ctx.globalAlpha = drop.alpha;
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, drop.y);
  ctx.lineTo(x + 8, drop.y + drop.length);
  ctx.stroke();
  ctx.restore();
}

function drawGlint(glint) {
  ctx.save();
  ctx.globalAlpha = glint.alpha;
  const gradient = ctx.createLinearGradient(glint.x, glint.y, glint.x + glint.length, glint.y + glint.length * glint.tilt);
  gradient.addColorStop(0, "rgba(255, 247, 238, 0)");
  gradient.addColorStop(0.5, glint.color);
  gradient.addColorStop(1, "rgba(255, 247, 238, 0)");
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(glint.x, glint.y);
  ctx.lineTo(glint.x + glint.length, glint.y + glint.length * glint.tilt);
  ctx.stroke();
  ctx.restore();
}

function drawCandyDot(dot) {
  ctx.save();
  ctx.globalAlpha = dot.alpha;
  ctx.fillStyle = dot.color;
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function updateEffects(time) {
  raindrops.forEach((drop) => {
    drop.y += drop.speed;
    if (drop.y > height + drop.length) Object.assign(drop, makeRaindrop(true), { y: -drop.length });
    drawRaindrop(drop, time);
  });

  glints.forEach((glint) => {
    glint.x += glint.speed;
    if (glint.x > width + glint.length) Object.assign(glint, makeGlint(true), { x: -glint.length });
    drawGlint(glint);
  });

  if (activeScreen === "highlight" || activeScreen === "final") {
    candyDots.forEach((dot) => {
      dot.y += dot.vy;
      dot.x += dot.vx + Math.sin(time * 0.001 + dot.y * 0.014) * 0.06;
      if (dot.y > height + 14) Object.assign(dot, makeCandyDot(true), { y: -10 });
      drawCandyDot(dot);
    });
  }

  sugarBursts = sugarBursts.filter((spark) => spark.alpha > 0.04);
  sugarBursts.forEach((spark) => {
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vy += 0.006;
    spark.alpha *= 0.966;
    drawCandyDot(spark);
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
