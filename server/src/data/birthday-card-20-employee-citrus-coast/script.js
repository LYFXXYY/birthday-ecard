const bgMusic = "{{music_url}}";
const localMusic = "../music/music.mp3";

const screenOrder = ["cover", "wish", "highlight", "final"];
const paletteByScreen = {
  cover: ["#74cbd3", "#ff9f2e", "#f8fff9", "#9edfcf"],
  wish: ["#a8e6e8", "#ffd166", "#ffffff", "#ff9f2e"],
  highlight: ["#ff9f2e", "#74cbd3", "#ffd166", "#f8fff9"],
  final: ["#ffffff", "#74cbd3", "#ffb45c", "#9edfcf"]
};

const app = document.querySelector(".card-app");
const canvas = document.getElementById("fxCanvas");
const ctx = canvas.getContext("2d");
const screens = [...document.querySelectorAll(".screen")];
const musicToggle = document.querySelector(".music-toggle");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width = 0;
let height = 0;
let dpr = 1;
let activeScreen = "cover";
let audio = null;
let bubbles = [];
let ribbons = [];
let confetti = [];
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
    radius: random(2.5, 8.5),
    speed: random(0.16, 0.44),
    drift: random(-0.16, 0.16),
    alpha: random(0.1, 0.26),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeRibbon(fromSide = false) {
  const colors = palette();
  return {
    x: fromSide ? random(-150, -24) : random(-40, width),
    y: random(height * 0.16, height * 0.84),
    length: random(60, 132),
    speed: random(0.08, 0.2),
    wave: random(10, 24),
    alpha: random(0.06, 0.16),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function makeConfetti(fromTop = false) {
  const colors = palette();
  return {
    x: random(0, width),
    y: fromTop ? random(-90, -12) : random(-height * 0.1, height),
    vx: random(-0.18, 0.18),
    vy: random(0.24, 0.66),
    size: random(5, 12),
    angle: random(0, Math.PI * 2),
    spin: random(-0.028, 0.028),
    alpha: random(0.18, 0.48),
    color: colors[Math.floor(random(0, colors.length))]
  };
}

function resetEffects() {
  bubbles = Array.from({ length: reduceMotion ? 10 : 30 }, () => makeBubble());
  ribbons = Array.from({ length: reduceMotion ? 2 : 7 }, () => makeRibbon());
  confetti = Array.from({ length: reduceMotion ? 4 : 16 }, () => makeConfetti());
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

function launchSplash() {
  const colors = palette();
  const cx = random(width * 0.2, width * 0.8);
  const cy = random(height * 0.16, height * 0.43);
  for (let i = 0; i < 20; i += 1) {
    const angle = (Math.PI * 2 * i) / 20;
    bursts.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * random(0.65, 1.85),
      vy: Math.sin(angle) * random(0.65, 1.85),
      size: random(4, 9),
      alpha: 0.78,
      color: colors[Math.floor(random(0, colors.length))]
    });
  }
}

function startFinale() {
  stopFinale();
  if (reduceMotion) return;
  launchSplash();
  finaleTimer = window.setInterval(launchSplash, 1450);
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
  resetEffects();

  if (name !== "cover") tryPlayMusic();
  if (name === "final") startFinale();
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
  ctx.shadowBlur = 10;
  ctx.shadowColor = bubble.color;
  ctx.beginPath();
  ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
  ctx.stroke();
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

function drawConfetti(piece) {
  ctx.save();
  ctx.translate(piece.x, piece.y);
  ctx.rotate(piece.angle);
  ctx.globalAlpha = piece.alpha;
  ctx.fillStyle = piece.color;
  ctx.fillRect(-piece.size * 0.5, -piece.size * 0.18, piece.size, piece.size * 0.36);
  ctx.restore();
}

function drawBurst(spark) {
  ctx.save();
  ctx.globalAlpha = spark.alpha;
  ctx.fillStyle = spark.color;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function updateEffects(time) {
  bubbles.forEach((bubble) => {
    bubble.y -= bubble.speed;
    bubble.x += bubble.drift + Math.sin((bubble.y + time * 0.02) * 0.012) * 0.05;
    if (bubble.y < -20) Object.assign(bubble, makeBubble(true), { y: height + 16 });
    drawBubble(bubble);
  });

  ribbons.forEach((ribbon) => {
    ribbon.x += ribbon.speed;
    if (ribbon.x > width + ribbon.length) Object.assign(ribbon, makeRibbon(true), { x: -ribbon.length });
    drawRibbon(ribbon, time);
  });

  if (activeScreen === "highlight" || activeScreen === "final") {
    confetti.forEach((piece) => {
      piece.y += piece.vy;
      piece.x += piece.vx + Math.sin(time * 0.001 + piece.y * 0.02) * 0.12;
      piece.angle += piece.spin;
      if (piece.y > height + 24) Object.assign(piece, makeConfetti(true), { y: -18 });
      drawConfetti(piece);
    });
  }

  bursts = bursts.filter((spark) => spark.alpha > 0.04);
  bursts.forEach((spark) => {
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vy += 0.008;
    spark.alpha *= 0.966;
    drawBurst(spark);
  });
}

function tick(time) {
  ctx.clearRect(0, 0, width, height);
  updateEffects(time);
  requestAnimationFrame(tick);
}

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
