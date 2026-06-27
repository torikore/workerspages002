const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const wrap = document.getElementById("canvas-wrap");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const overlayBtn = document.getElementById("overlay-btn");
const hudCoins = document.getElementById("hud-coins");
const hudLives = document.getElementById("hud-lives");

const TILE = 32;
const GRAVITY = 0.55;
const MOVE_SPEED = 3.2;
const JUMP_FORCE = -11.5;
const THROW_SPEED = 9;

const LEVEL_MAP = [
  "........................................................................................................",
  "........................................................................................................",
  "........................................................................................................",
  "........................................................................................................",
  "........................................................................................................",
  "........................................................................................................",
  "........................................................................................................",
  "...........................===....................................................===...................",
  "..........................=...=..................................................=...=..................",
  "..............===....................................................===..............................",
  ".............=...=...........E...........................E...........=...=..........E.................",
  "...................................................................................................T....",
  "..........E....................................===......................................................",
  "..............................................=...=.....................................................",
  "....................===.................................................................................",
  "...................=...=..............V..............................V..................................",
  "........................................................................................................",
  "......P.................................................................................................",
  "########################################################################################################",
  "########################################################################################################",
];

const keys = new Set();
const touchInput = { left: false, right: false, up: false, down: false, jump: false, action: false };

let cameraX = 0;
let coins = 0;
let lives = 3;
let gameState = "playing";
let levelWidth = 0;
let tiles = [];
let enemies = [];
let items = [];
let particles = [];
let goal = null;
let player = null;
let held = null;
let actionPressed = false;

function tileAt(col, row) {
  if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length) {
    return ".";
  }
  return tiles[row][col];
}

function isSolid(ch) {
  return ch === "#" || ch === "=";
}

function parseLevel() {
  tiles = LEVEL_MAP.map((row) => row.split(""));
  levelWidth = tiles[0].length * TILE;
  enemies = [];
  items = [];
  goal = null;

  for (let row = 0; row < tiles.length; row++) {
    for (let col = 0; col < tiles[row].length; col++) {
      const ch = tiles[row][col];
      const x = col * TILE;
      const y = row * TILE;

      if (ch === "P") {
        player = createPlayer(x, y - 8);
        tiles[row][col] = ".";
      } else if (ch === "E") {
        enemies.push(createEnemy(x, y - 4));
        tiles[row][col] = ".";
      } else if (ch === "V") {
        items.push({ type: "veggie-spot", x, y: y + TILE - 8, w: TILE, h: 8, pulled: false });
        tiles[row][col] = ".";
      } else if (ch === "T") {
        goal = { x, y: y - TILE, w: TILE, h: TILE * 2 };
        tiles[row][col] = ".";
      } else if (ch === "C") {
        items.push({ type: "coin", x: x + 8, y: y + 8, w: 16, h: 16, taken: false });
        tiles[row][col] = ".";
      }
    }
  }

  for (let col = 20; col < 100; col += 15) {
    const row = 17;
    if (tileAt(col, row) === "#") {
      items.push({ type: "coin", x: col * TILE + 8, y: row * TILE - 24, w: 16, h: 16, taken: false });
    }
  }
}

function createPlayer(x, y) {
  return {
    x,
    y,
    w: 22,
    h: 28,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    invuln: 0,
    duck: false,
  };
}

function createEnemy(x, y) {
  return {
    x,
    y,
    w: 24,
    h: 24,
    vx: 1.2,
    vy: 0,
    state: "walk",
    stunned: 0,
    held: false,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getSolidTilesAround(box) {
  const solids = [];
  const c0 = Math.floor(box.x / TILE);
  const c1 = Math.floor((box.x + box.w) / TILE);
  const r0 = Math.floor(box.y / TILE);
  const r1 = Math.floor((box.y + box.h) / TILE);

  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const ch = tileAt(col, row);
      if (isSolid(ch)) {
        solids.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE, ch });
      }
    }
  }
  return solids;
}

function moveBox(box, dx, dy) {
  box.x += dx;
  let solids = getSolidTilesAround(box);
  for (const s of solids) {
    if (rectsOverlap(box, s)) {
      if (dx > 0) box.x = s.x - box.w;
      else if (dx < 0) box.x = s.x + s.w;
    }
  }

  box.y += dy;
  solids = getSolidTilesAround(box);
  box.onGround = false;
  for (const s of solids) {
    if (rectsOverlap(box, s)) {
      if (dy > 0) {
        box.y = s.y - box.h;
        box.onGround = true;
      } else if (dy < 0) {
        box.y = s.y + s.h;
        box.vy = 0;
      }
    }
  }
}

function spawnParticles(x, y, color) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 24,
      color,
    });
  }
}

function tryPullVeggie() {
  if (!player.duck || !player.onGround) return;

  for (const spot of items) {
    if (spot.type !== "veggie-spot" || spot.pulled) continue;
    if (Math.abs(player.x + player.w / 2 - (spot.x + spot.w / 2)) < 20) {
      spot.pulled = true;
      held = {
        type: "veggie",
        x: player.x + player.facing * 10,
        y: player.y - 8,
        w: 20,
        h: 20,
        vx: 0,
        vy: 0,
      };
      spawnParticles(spot.x, spot.y, "#fff");
      return;
    }
  }
}

function tryPickup() {
  if (held) {
    const obj = held;
    obj.vx = player.facing * THROW_SPEED;
    obj.vy = -3;
    obj.x = player.x + player.facing * 18;
    obj.y = player.y + 4;
    if (obj.state === "held") {
      obj.state = "thrown";
      obj.held = false;
    } else {
      items.push(obj);
    }
    held = null;
    return;
  }

  for (const enemy of enemies) {
    if (enemy.state === "stunned" && !enemy.held && rectsOverlap(player, enemy)) {
      enemy.held = true;
      enemy.state = "held";
      held = enemy;
      return;
    }
  }

  tryPullVeggie();
}

function damagePlayer() {
  if (player.invuln > 0 || gameState !== "playing") return;
  lives -= 1;
  player.invuln = 90;
  player.vy = -8;
  player.vx = -player.facing * 4;
  spawnParticles(player.x, player.y, "#ff6b6b");
  updateHud();

  if (lives <= 0) {
    endGame(false);
  }
}

function endGame(won) {
  gameState = won ? "win" : "lose";
  overlayTitle.textContent = won ? "ゴール！" : "ゲームオーバー";
  overlayMsg.textContent = won
    ? `コイン ${coins} 枚獲得！ 1面クリア！`
    : "もう一度挑戦しよう";
  overlay.classList.add("is-visible");
}

function resetGame() {
  coins = 0;
  lives = 3;
  gameState = "playing";
  held = null;
  particles = [];
  overlay.classList.remove("is-visible");
  parseLevel();
  updateHud();
}

function updateHud() {
  hudCoins.textContent = `🪙 ${coins}`;
  hudLives.textContent = `❤️ × ${lives}`;
}

function updatePlayer() {
  const left = keys.has("ArrowLeft") || keys.has("a") || touchInput.left;
  const right = keys.has("ArrowRight") || keys.has("d") || touchInput.right;
  const jump = keys.has("ArrowUp") || keys.has("w") || keys.has("z") || keys.has(" ") || touchInput.jump;
  const down = keys.has("ArrowDown") || keys.has("s") || touchInput.down;
  const action = keys.has("x") || touchInput.action;

  player.duck = down && player.onGround && !held;
  player.vx = 0;
  if (!player.duck) {
    if (left) {
      player.vx = -MOVE_SPEED;
      player.facing = -1;
    }
    if (right) {
      player.vx = MOVE_SPEED;
      player.facing = 1;
    }
  }

  if (jump && player.onGround && !player.duck) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }

  if (action && !actionPressed) {
    tryPickup();
  }
  actionPressed = action;

  player.vy += GRAVITY;
  if (player.vy > 14) player.vy = 14;

  moveBox(player, player.vx, player.vy);

  if (player.invuln > 0) player.invuln -= 1;

  if (held) {
    held.x = player.x + player.facing * 16 - held.w / 2;
    held.y = player.y - held.h + 4;
  }

  if (goal && rectsOverlap(player, goal)) {
    endGame(true);
  }
}

function updateEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.state === "held") continue;

    if (e.state === "stunned") {
      e.stunned -= 1;
      if (e.stunned <= 0) {
        e.state = "walk";
        e.vx = player.x > e.x ? 1.2 : -1.2;
      }
      continue;
    }

    if (e.state === "thrown") {
      e.vy += GRAVITY;
      e.x += e.vx;
      e.y += e.vy;
      e.onGround = false;

      const solids = getSolidTilesAround(e);
      for (const s of solids) {
        if (rectsOverlap(e, s)) {
          if (e.vy > 0) {
            e.y = s.y - e.h;
            e.vy = 0;
            e.onGround = true;
            e.vx *= 0.55;
          }
        }
      }

      for (const other of enemies) {
        if (other !== e && other.state === "walk" && rectsOverlap(e, other)) {
          other.state = "dead";
          spawnParticles(other.x, other.y, "#e74c3c");
          e.vx *= 0.3;
        }
      }

      if (e.onGround && Math.abs(e.vx) < 0.6) {
        spawnParticles(e.x, e.y, "#ccc");
        enemies.splice(i, 1);
      }
      continue;
    }

    if (e.state === "dead") {
      enemies.splice(i, 1);
      continue;
    }

    e.vy += GRAVITY;
    moveBox(e, e.vx, e.vy);

    if (e.onGround) {
      const ahead = {
        x: e.vx > 0 ? e.x + e.w : e.x - 4,
        y: e.y + e.h + 2,
        w: 4,
        h: 4,
      };
      const below = getSolidTilesAround(ahead);
      if (below.length === 0) e.vx *= -1;
    }

    const wall = getSolidTilesAround({
      x: e.x + (e.vx > 0 ? e.w : -2),
      y: e.y,
      w: 2,
      h: e.h,
    });
    if (wall.length > 0) e.vx *= -1;

    if (rectsOverlap(player, e)) {
      if (player.vy > 0 && player.y + player.h - player.vy <= e.y + 6) {
        e.state = "stunned";
        e.stunned = 120;
        e.vx = 0;
        player.vy = JUMP_FORCE * 0.55;
        spawnParticles(e.x, e.y, "#e74c3c");
      } else if (e.state === "walk") {
        damagePlayer();
      }
    }
  }
}

function updateItems() {
  for (const item of items) {
    if (item.type === "coin" && !item.taken && rectsOverlap(player, item)) {
      item.taken = true;
      coins += 1;
      spawnParticles(item.x, item.y, "#feca57");
      updateHud();
    }

    if (item.type === "veggie" && item.vx !== undefined) {
      item.vy += GRAVITY;
      item.x += item.vx;
      item.y += item.vy;

      for (const e of enemies) {
        if (e.state === "walk" && rectsOverlap(item, e)) {
          e.state = "dead";
          spawnParticles(e.x, e.y, "#e74c3c");
          item.vx = 0;
        }
      }

      const solids = getSolidTilesAround(item);
      for (const s of solids) {
        if (rectsOverlap(item, s) && item.vy > 0) {
          item.y = s.y - item.h;
          item.vy = 0;
          item.vx = 0;
        }
      }
    }
  }

  items = items.filter((item) => item.type !== "coin" || !item.taken);
}

function updateParticles() {
  particles = particles.filter((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    return p.life > 0;
  });
}

function updateCamera() {
  const viewW = canvas.width / dpr;
  cameraX = player.x - viewW * 0.35;
  if (cameraX < 0) cameraX = 0;
  if (cameraX > levelWidth - viewW) cameraX = levelWidth - viewW;
}

function drawBackground() {
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  ctx.fillStyle = "#5c94fc";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 180 - cameraX * 0.2) % (w + 200)) - 50;
    const cy = 30 + (i % 3) * 18;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 36, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 28, cy + 4, 28, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 24, cy + 4, 24, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let x = -cameraX % 64; x < w; x += 64) {
    ctx.fillStyle = "#6aad4a";
    ctx.beginPath();
    ctx.moveTo(x, h - 48);
    ctx.quadraticCurveTo(x + 32, h - 72, x + 64, h - 48);
    ctx.lineTo(x + 64, h);
    ctx.lineTo(x, h);
    ctx.fill();
  }
}

function drawTiles() {
  const viewW = canvas.width / dpr;
  const c0 = Math.floor(cameraX / TILE);
  const c1 = Math.ceil((cameraX + viewW) / TILE);

  for (let row = 0; row < tiles.length; row++) {
    for (let col = c0; col <= c1; col++) {
      const ch = tileAt(col, row);
      const x = col * TILE - cameraX;
      const y = row * TILE;

      if (ch === "#") {
        ctx.fillStyle = "#c84c0c";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#5a3010";
        ctx.fillRect(x, y + TILE - 8, TILE, 8);
        ctx.fillStyle = "#6aad4a";
        ctx.fillRect(x, y, TILE, 10);
      } else if (ch === "=") {
        ctx.fillStyle = "#8b6914";
        ctx.fillRect(x, y + 12, TILE, 10);
        ctx.fillStyle = "#6aad4a";
        ctx.fillRect(x, y + 10, TILE, 6);
      }
    }
  }
}

function drawVeggieSpots() {
  for (const spot of items) {
    if (spot.type !== "veggie-spot" || spot.pulled) continue;
    const x = spot.x - cameraX;
    ctx.fillStyle = "#8b6914";
    ctx.fillRect(x + 4, spot.y, spot.w - 8, spot.h);
    ctx.fillStyle = "#6aad4a";
    ctx.fillRect(x + 2, spot.y - 4, spot.w - 4, 6);
  }
}

function drawCoins() {
  for (const item of items) {
    if (item.type !== "coin" || item.taken) continue;
    const x = item.x - cameraX;
    ctx.fillStyle = "#feca57";
    ctx.beginPath();
    ctx.arc(x + 8, item.y + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e67e22";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawGoal() {
  if (!goal) return;
  const x = goal.x - cameraX;
  ctx.fillStyle = "#8e44ad";
  ctx.fillRect(x + 4, goal.y, goal.w - 8, goal.h);
  ctx.fillStyle = "#f39c12";
  ctx.beginPath();
  ctx.arc(x + goal.w / 2, goal.y + 10, 12, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GOAL", x + goal.w / 2, goal.y + goal.h - 12);
}

function drawEnemy(e) {
  const x = e.x - cameraX;
  if (e.state === "stunned") {
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(x, e.y + 14, e.w, 10);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 4, e.y + 16, 6, 4);
    ctx.fillRect(x + 14, e.y + 16, 6, 4);
    return;
  }

  ctx.fillStyle = "#e74c3c";
  ctx.beginPath();
  ctx.arc(x + 12, e.y + 10, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + 5, e.y + 8, 5, 6);
  ctx.fillRect(x + 14, e.y + 8, 5, 6);
  ctx.fillStyle = "#000";
  ctx.fillRect(x + 7, e.y + 10, 2, 3);
  ctx.fillRect(x + 16, e.y + 10, 2, 3);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + 8, e.y + 18, 8, 3);
}

function drawHeld(obj) {
  const x = obj.x - cameraX;
  if (obj.type === "veggie" || obj.w === 20) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(x + 10, obj.y + 12, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6aad4a";
    ctx.fillRect(x + 6, obj.y, 8, 6);
    return;
  }
  drawEnemy(obj);
}

function drawPlayer() {
  const x = player.x - cameraX;
  const duck = player.duck;
  const h = duck ? 18 : player.h;
  const y = duck ? player.y + 10 : player.y;

  if (player.invuln > 0 && Math.floor(player.invuln / 4) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(x + 4, y, 14, duck ? 8 : 10);
  ctx.fillStyle = "#3498db";
  ctx.fillRect(x + 2, y + (duck ? 6 : 8), 18, duck ? 10 : 14);
  ctx.fillStyle = "#f5cba7";
  ctx.fillRect(x + 5, y + (duck ? 8 : 10), 12, duck ? 8 : 10);
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(x + 3, y - (duck ? 0 : 2), 16, duck ? 6 : 8);

  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - cameraX, p.y, 4, 4);
  }
}

function render() {
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  drawBackground();
  drawTiles();
  drawVeggieSpots();
  drawCoins();
  drawGoal();

  for (const e of enemies) drawEnemy(e);
  for (const item of items) {
    if (item.type === "veggie" && item.vx !== undefined) drawHeld(item);
  }
  if (held) drawHeld(held);
  drawPlayer();
  drawParticles();

  ctx.restore();
}

function tick() {
  if (gameState === "playing") {
    updatePlayer();
    updateEnemies();
    updateItems();
    updateParticles();
    updateCamera();
  }
  render();
  requestAnimationFrame(tick);
}

let dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
}

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.key.toLowerCase());
  if (e.key === " ") keys.add(" ");
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
  if (e.key === " ") keys.delete(" ");
});

overlayBtn.addEventListener("click", resetGame);

for (const btn of document.querySelectorAll(".touch-btn")) {
  const action = btn.dataset.action;

  const setTouch = (active) => {
    if (action === "left") touchInput.left = active;
    if (action === "right") touchInput.right = active;
    if (action === "up") touchInput.up = active;
    if (action === "down") touchInput.down = active;
    if (action === "jump") touchInput.jump = active;
    if (action === "action") touchInput.action = active;
    btn.classList.toggle("is-active", active);
  };

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    setTouch(true);
  });
  btn.addEventListener("pointerup", () => setTouch(false));
  btn.addEventListener("pointercancel", () => setTouch(false));
  btn.addEventListener("pointerleave", () => setTouch(false));
}

new ResizeObserver(resize).observe(wrap);
window.addEventListener("resize", resize);

parseLevel();
updateHud();
resize();
requestAnimationFrame(tick);
