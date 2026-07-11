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
  cover: ["#7bd8f1", "#f071a8", "#b9e96a", "#ffffff"],
  wish: ["#dff7ff", "#a99cff", "#f071a8", "#ffffff"],
  highlight: ["#b9e96a", "#7bd8f1", "#f071a8", "#fffdf8"],
  final: ["#ffffff", "#7bd8f1", "#a99cff", "#f071a8"]
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
let bubbles = [];
let shards = [];
let dotsFx = [];
let bursts = [];
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

function makeBubble(fromBottom = false) {
  const colors = palette();
  return {
    x: random(width * 0.04, width * 0.96),
    y: fromBottom ? random(height + 12, height + 90) : random(0, height),
    radius: random(3, 10),
    speed: random(0.12, 0.34),
    drift: random(-0.12, 0.12),
    alpha: random(0.08, 0.22),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeShard(fromSide = false) {
  const colors = palette();
  return {
    x: fromSide ? random(-160, -24) : random(-40, width),
    y: random(height * 0.12, height * 0.84),
    length: random(64, 160),
    speed: random(0.08, 0.2),
    slope: random(-0.26, 0.18),
    alpha: random(0.05, 0.15),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeDot(fromTop = false) {
  const colors = palette();
  return {
    x: random(0, width),
    y: fromTop ? random(-80, -10) : random(-height * 0.1, height),
    vy: random(0.2, 0.58),
    vx: random(-0.14, 0.14),
    size: random(2.2, 5.8),
    alpha: random(0.16, 0.44),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function resetEffects() {
  bubbles = Array.from({ length: reduceMotion ? 8 : 26 }, () => makeBubble());
  shards = Array.from({ length: reduceMotion ? 2 : 8 }, () => makeShard());
  dotsFx = Array.from({ length: reduceMotion ? 5 : 20 }, () => makeDot());
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

function launchColorPop() {
  const colors = palette();
  const cx = random(width * 0.22, width * 0.78);
  const cy = random(height * 0.15, height * 0.42);
  for (let i = 0; i < 22; i += 1) {
    const angle = (Math.PI * 2 * i) / 22;
    bursts.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * random(0.65, 1.9),
      vy: Math.sin(angle) * random(0.65, 1.9),
      size: random(3, 8),
      alpha: 0.78,
      color: colors[Math.floor(random(0, colors.length))]
    });
  }
}

function startFinale() {
  stopFinale();
  if (reduceMotion) return;
  launchColorPop();
  finaleTimer = window.setInterval(launchColorPop, 1400);
}

function updateDots() {
  dots.forEach((dot) => {
    dot.classList.toggle("is-active", dot.dataset.jump === activeScreen);
  });
}

function normalizeScreenName(name) {
  if (isRecording && recorderScreenAliases[name]) return recorderScreenAliases[name];
  if (screenOrder.includes(name)) return name;
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

function drawBubble(bubble) {
  ctx.save();
  ctx.globalAlpha = bubble.alpha;
  ctx.strokeStyle = bubble.color;
  ctx.lineWidth = 1.2;
  ctx.shadowBlur = 14;
  ctx.shadowColor = bubble.color;
  ctx.beginPath();
  ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawShard(shard) {
  ctx.save();
  ctx.globalAlpha = shard.alpha;
  const gradient = ctx.createLinearGradient(shard.x, shard.y, shard.x + shard.length, shard.y + shard.length * shard.slope);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(0.45, shard.color);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(shard.x, shard.y);
  ctx.lineTo(shard.x + shard.length, shard.y + shard.length * shard.slope);
  ctx.stroke();
  ctx.restore();
}

function drawDot(dot) {
  ctx.save();
  ctx.globalAlpha = dot.alpha;
  ctx.fillStyle = dot.color;
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function updateEffects(time) {
  bubbles.forEach((bubble) => {
    bubble.y -= bubble.speed;
    bubble.x += bubble.drift + Math.sin((bubble.y + time * 0.02) * 0.012) * 0.04;
    if (bubble.y < -20) Object.assign(bubble, makeBubble(true), { y: height + 16 });
    drawBubble(bubble);
  });

  shards.forEach((shard) => {
    shard.x += shard.speed;
    shard.y += shard.speed * shard.slope;
    if (shard.x > width + shard.length) Object.assign(shard, makeShard(true), { x: -shard.length });
    drawShard(shard);
  });

  if (activeScreen === "highlight" || activeScreen === "final") {
    dotsFx.forEach((dot) => {
      dot.y += dot.vy;
      dot.x += dot.vx + Math.sin(time * 0.001 + dot.y * 0.02) * 0.1;
      if (dot.y > height + 16) Object.assign(dot, makeDot(true), { y: -10 });
      drawDot(dot);
    });
  }

  bursts = bursts.filter((spark) => spark.alpha > 0.04);
  bursts.forEach((spark) => {
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vy += 0.008;
    spark.alpha *= 0.966;
    drawDot(spark);
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
