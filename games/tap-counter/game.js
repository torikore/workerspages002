const DURATION_MS = 10000;

const timerEl = document.getElementById("timer");
const countEl = document.getElementById("count");
const tapBtn = document.getElementById("tap-btn");
const startBtn = document.getElementById("start-btn");

let count = 0;
let endTime = 0;
let rafId = null;

function formatTime(ms) {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

function updateTimer() {
  const remaining = endTime - performance.now();
  timerEl.textContent = formatTime(remaining);

  if (remaining > 0) {
    rafId = requestAnimationFrame(updateTimer);
  } else {
    finishGame();
  }
}

function finishGame() {
  tapBtn.disabled = true;
  startBtn.disabled = false;
  startBtn.textContent = "もう一度";
  timerEl.textContent = "0.0";
  cancelAnimationFrame(rafId);
}

function startGame() {
  count = 0;
  countEl.textContent = "0";
  endTime = performance.now() + DURATION_MS;
  tapBtn.disabled = false;
  startBtn.disabled = true;
  startBtn.textContent = "スタート";
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(updateTimer);
}

function onTap() {
  if (tapBtn.disabled) return;
  count += 1;
  countEl.textContent = String(count);
}

tapBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  onTap();
});

startBtn.addEventListener("click", startGame);
