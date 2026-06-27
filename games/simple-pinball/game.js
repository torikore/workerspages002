const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const wrap = document.getElementById("canvas-wrap");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const overlayBtn = document.getElementById("overlay-btn");
const scoreEl = document.getElementById("score");
const ballsEl = document.getElementById("balls");

const W = 400;
const H = 600;

const GRAVITY = 0.08;
const FRICTION = 0.998;
const BALL_R = 8;

let score = 0;
let ballsLeft = 3;
let gameState = "ready";
let ball = null;
let flippers = [];
let bumpers = [];
let walls = [];
let launchPower = 0;
let launching = false;

const keys = new Set();
const touch = { left: false, right: false, launch: false };

function createBall(inLauncher = true) {
  if (inLauncher) {
    return { x: 368, y: 520, vx: 0, vy: 0, active: false };
  }
  return { x: 368, y: 520, vx: 0, vy: 0, active: true };
}

function setupTable() {
  bumpers = [
    { x: 200, y: 120, r: 22, score: 100, color: "#ff6b6b" },
    { x: 120, y: 180, r: 18, score: 50, color: "#48dbfb" },
    { x: 280, y: 180, r: 18, score: 50, color: "#48dbfb" },
    { x: 200, y: 220, r: 16, score: 30, color: "#feca57" },
  ];

  flippers = [
    { x: 130, y: 520, len: 56, rest: 0.55, active: -0.35, angle: 0.55, side: "left" },
    { x: 270, y: 520, len: 56, rest: Math.PI - 0.55, active: Math.PI + 0.35, angle: Math.PI - 0.55, side: "right" },
  ];

  walls = [
    { x1: 20, y1: 20, x2: 380, y2: 20 },
    { x1: 20, y1: 20, x2: 20, y2: 580 },
    { x1: 20, y1: 580, x2: 160, y2: 580 },
    { x1: 240, y1: 580, x2: 340, y2: 580 },
    { x1: 340, y1: 580, x2: 380, y2: 540 },
    { x1: 380, y1: 540, x2: 380, y2: 20 },
    { x1: 340, y1: 580, x2: 380, y2: 580 },
    { x1: 340, y1: 400, x2: 380, y2: 400 },
    { x1: 340, y1: 400, x2: 340, y2: 580 },
    { x1: 20, y1: 300, x2: 80, y2: 300 },
    { x1: 80, y1: 300, x2: 80, y2: 400 },
    { x1: 80, y1: 400, x2: 160, y2: 480 },
    { x1: 160, y1: 480, x2: 160, y2: 580 },
  ];
}

function flipperLine(f) {
  return {
    x1: f.x,
    y1: f.y,
    x2: f.x + Math.cos(f.angle) * f.len,
    y2: f.y + Math.sin(f.angle) * f.len,
  };
}

function updateFlippers() {
  const leftOn = keys.has("z") || keys.has("arrowleft") || touch.left;
  const rightOn = keys.has("x") || keys.has("arrowright") || touch.right;

  for (const f of flippers) {
    const target = (f.side === "left" ? leftOn : rightOn) ? f.active : f.rest;
    f.angle += (target - f.angle) * 0.35;
    f.moving = Math.abs(target - f.angle) > 0.02;
  }
}

function launchBall() {
  if (!ball || ball.active || gameState !== "playing") return;
  launchPower = Math.min(launchPower + 2.5, 18);
  launching = true;
}

function releaseLaunch() {
  if (!ball || ball.active || !launching) return;
  ball.vy = -launchPower;
  ball.vx = -1.5;
  ball.active = true;
  launching = false;
  launchPower = 0;
}

function circleLineCollision(bx, by, br, wall) {
  const { x1, y1, x2, y2 } = wall;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return null;

  let t = ((bx - x1) * dx + (by - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const distX = bx - cx;
  const distY = by - cy;
  const dist = Math.hypot(distX, distY);

  if (dist >= br) return null;

  const nx = distX / dist;
  const ny = distY / dist;
  return { nx, ny, depth: br - dist, cx, cy };
}

function resolveBallWall(collision, ballObj, extraBounce = 1) {
  const dot = ballObj.vx * collision.nx + ballObj.vy * collision.ny;
  if (dot > 0) return;
  ballObj.vx -= (1 + extraBounce) * dot * collision.nx;
  ballObj.vy -= (1 + extraBounce) * dot * collision.ny;
  ballObj.x += collision.nx * collision.depth;
  ballObj.y += collision.ny * collision.depth;
}

function updateBall() {
  if (!ball || !ball.active) return;

  ball.vy += GRAVITY;
  ball.vx *= FRICTION;
  ball.vy *= FRICTION;
  ball.x += ball.vx;
  ball.y += ball.vy;

  for (const wall of walls) {
    const hit = circleLineCollision(ball.x, ball.y, BALL_R, wall);
    if (hit) resolveBallWall(hit, ball, 0.6);
  }

  for (const f of flippers) {
    const line = flipperLine(f);
    const hit = circleLineCollision(ball.x, ball.y, BALL_R, line);
    if (hit) {
      const boost = f.moving ? 4 : 1.2;
      resolveBallWall(hit, ball, boost);
    }
  }

  for (const bumper of bumpers) {
    const dx = ball.x - bumper.x;
    const dy = ball.y - bumper.y;
    const dist = Math.hypot(dx, dy);
    const minDist = BALL_R + bumper.r;
    if (dist < minDist && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = bumper.x + nx * minDist;
      ball.y = bumper.y + ny * minDist;
      const speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = nx * Math.max(speed, 6);
      ball.vy = ny * Math.max(speed, 6);
      score += bumper.score;
      bumper.flash = 12;
      updateHud();
    }
  }

  if (ball.y > H + 20) {
    loseBall();
  }

  ball.x = Math.max(BALL_R, Math.min(W - BALL_R, ball.x));
}

function loseBall() {
  ballsLeft -= 1;
  updateHud();
  if (ballsLeft <= 0) {
    endGame();
    return;
  }
  ball = createBall(true);
}

function updateHud() {
  scoreEl.textContent = `スコア: ${score}`;
  ballsEl.textContent = `ボール: ${ballsLeft}`;
}

function endGame() {
  gameState = "over";
  showOverlay("ゲームオーバー", `スコア: ${score}`, "もう一度");
}

function showOverlay(title, msg, btn) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlayBtn.textContent = btn;
  overlay.classList.add("is-visible");
}

function hideOverlay() {
  overlay.classList.remove("is-visible");
}

function startGame() {
  score = 0;
  ballsLeft = 3;
  gameState = "playing";
  setupTable();
  ball = createBall(true);
  launchPower = 0;
  launching = false;
  updateHud();
  hideOverlay();
}

function drawTable() {
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#2121de";
  ctx.lineWidth = 3;
  for (const wall of walls) {
    ctx.beginPath();
    ctx.moveTo(wall.x1, wall.y1);
    ctx.lineTo(wall.x2, wall.y2);
    ctx.stroke();
  }

  for (const bumper of bumpers) {
    ctx.fillStyle = bumper.flash > 0 ? "#fff" : bumper.color;
    if (bumper.flash > 0) bumper.flash -= 1;
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, bumper.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  for (const f of flippers) {
    const line = flipperLine(f);
    ctx.strokeStyle = "#feca57";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();
    ctx.fillStyle = "#e67e22";
    ctx.beginPath();
    ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (ball) {
    if (!ball.active) {
      ctx.fillStyle = "#555";
      ctx.fillRect(345, 400, 30, 180);
      ctx.fillStyle = "#feca57";
      ctx.fillRect(350, 560 - launchPower * 4, 20, 8 + launchPower * 2);
    }

    ctx.fillStyle = "#eee";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function tick() {
  if (gameState === "playing") {
    updateFlippers();
    if (keys.has(" ") || touch.launch) {
      launchBall();
    } else if (launching) {
      releaseLaunch();
    }
    updateBall();
  }
  render();
  requestAnimationFrame(tick);
}

function render() {
  ctx.save();
  ctx.scale(dpr, dpr);
  drawTable();
  ctx.restore();
}

let dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
}

window.addEventListener("keydown", (e) => {
  if ([" ", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key === " ") keys.add(" ");
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
  if (e.key === " ") {
    keys.delete(" ");
    if (launching) releaseLaunch();
  }
});

for (const btn of document.querySelectorAll(".touch-btn")) {
  const action = btn.dataset.action;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    touch[action] = true;
    btn.classList.add("is-active");
  });
  const release = () => {
    touch[action] = false;
    btn.classList.remove("is-active");
    if (action === "launch" && launching) releaseLaunch();
  };
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("pointerleave", release);
}

overlayBtn.addEventListener("click", () => {
  if (gameState === "ready") {
    hideOverlay();
    gameState = "playing";
    setupTable();
    ball = createBall(true);
    updateHud();
  } else if (gameState === "over") {
    startGame();
  }
});

setupTable();
updateHud();
resize();
showOverlay("シンプルピンボール", "Space / 発射ボタン長押しでボールを打ち出そう！", "スタート");
gameState = "ready";
new ResizeObserver(resize).observe(wrap);
requestAnimationFrame(tick);
