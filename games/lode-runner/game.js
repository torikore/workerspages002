const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const wrap = document.getElementById("canvas-wrap");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const overlayBtn = document.getElementById("overlay-btn");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");

const TILE = 24;
const SPEED = 1.5;
const FALL_SPEED = 2;
const HOLE_DURATION = 200;

const LEVEL = [
  "HHHHHHHHHHHHHHHHHHHH",
  "H........G.........H",
  "H..########....####H",
  "H..#......#....#..GH",
  "H..L..P...L....L...H",
  "H..########..######H",
  "H..G.......#.....#.H",
  "H..####....L..E..L.H",
  "H......#..########.H",
  "H..########........H",
  "H..#.....#..G..####H",
  "H..L..E..L..L......H",
  "H..########..#####.H",
  "H...G..........T...H",
  "HHHHHHHHHHHHHHHHHHHH",
];

const BRICK = "B";
const LADDER = "L";
const GOLD = "G";
const HARD = "H";
const EXIT = "T";

let grid = [];
let goldTotal = 0;
let goldLeft = 0;
let holes = [];
let player = null;
let enemies = [];
let score = 0;
let lives = 3;
let gameState = "ready";
let cols = 0;
let rows = 0;

const keys = new Set();
const touch = { up: false, down: false, left: false, right: false, digLeft: false, digRight: false };
let digCooldown = 0;

function parseLevel() {
  grid = LEVEL.map((row) => row.split(""));
  rows = grid.length;
  cols = grid[0].length;
  goldTotal = 0;
  goldLeft = 0;
  holes = [];
  enemies = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ch = grid[row][col];
      if (ch === "G") {
        goldTotal += 1;
        goldLeft += 1;
      } else if (ch === "P") {
        player = createEntity(col, row, "player");
        grid[row][col] = " ";
      } else if (ch === "E") {
        enemies.push(createEntity(col, row, "enemy"));
        grid[row][col] = " ";
      } else if (ch === "#") {
        grid[row][col] = BRICK;
      } else if (ch === "L") {
        grid[row][col] = LADDER;
      } else if (ch === "H") {
        grid[row][col] = HARD;
      } else if (ch === "T") {
        grid[row][col] = EXIT;
      } else if (ch === ".") {
        grid[row][col] = " ";
      }
    }
  }
}

function createEntity(col, row, type) {
  return {
    type,
    x: col * TILE + TILE / 2,
    y: row * TILE + TILE / 2,
    vx: 0,
    vy: 0,
    facing: 1,
    inHole: false,
  };
}

function gridPos(entity) {
  return {
    col: Math.round((entity.x - TILE / 2) / TILE),
    row: Math.round((entity.y - TILE / 2) / TILE),
  };
}

function cell(col, row) {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return HARD;
  const hole = holes.find((h) => h.col === col && h.row === row);
  if (hole) return " ";
  return grid[row][col];
}

function isSolid(col, row) {
  const c = cell(col, row);
  return c === BRICK || c === HARD;
}

function isLadder(col, row) {
  return cell(col, row) === LADDER;
}

function isClimbable(col, row) {
  const c = cell(col, row);
  return c === LADDER || c === EXIT;
}

function canPass(col, row) {
  const c = cell(col, row);
  return c !== BRICK && c !== HARD;
}

function distToCenter(entity) {
  const { col, row } = gridPos(entity);
  const cx = col * TILE + TILE / 2;
  const cy = row * TILE + TILE / 2;
  return Math.hypot(entity.x - cx, entity.y - cy);
}

function snapToCenter(entity) {
  const { col, row } = gridPos(entity);
  entity.x = col * TILE + TILE / 2;
  entity.y = row * TILE + TILE / 2;
}

function standingOnSolid(entity) {
  const { col, row } = gridPos(entity);
  return isSolid(col, row + 1) || isSolid(col - 1, row + 1) || isSolid(col + 1, row + 1);
}

function entitySupport(entity) {
  const { col, row } = gridPos(entity);
  if (isClimbable(col, row)) return true;
  if (isSolid(col, row + 1)) return true;
  const onEnemy = enemies.some((e) => {
    const ep = gridPos(e);
    return ep.col === col && ep.row === row + 1 && !e.inHole;
  });
  return onEnemy;
}

function tryDig(entity, dir) {
  if (digCooldown > 0 || entity.type !== "player") return;
  const { col, row } = gridPos(entity);
  if (!entitySupport(entity) || isClimbable(col, row)) return;

  const targetCol = col + dir;
  const targetRow = row + 1;
  if (grid[targetRow][targetCol] !== BRICK) return;
  if (holes.some((h) => h.col === targetCol && h.row === targetRow)) return;

  holes.push({ col: targetCol, row: targetRow, timer: HOLE_DURATION, original: BRICK });
  digCooldown = 20;
  entity.facing = dir;
}

function moveHorizontal(entity, dx) {
  if (entity.inHole) return;
  entity.vx = dx * SPEED;
  if (dx !== 0) entity.facing = dx;
}

function updateEntity(entity) {
  const { col, row } = gridPos(entity);

  if (entity.type === "player") {
    const climb = keys.has("arrowup") || keys.has("w") || touch.up;
    const down = keys.has("arrowdown") || keys.has("s") || touch.down;
    const left = keys.has("arrowleft") || keys.has("a") || touch.left;
    const right = keys.has("arrowright") || keys.has("d") || touch.right;
    const digL = keys.has("z") || touch.digLeft;
    const digR = keys.has("x") || touch.digRight;

    if (digL) tryDig(entity, -1);
    if (digR) tryDig(entity, 1);

    entity.vx = 0;
    entity.vy = 0;

    if (!entity.inHole) {
      if (left) moveHorizontal(entity, -1);
      if (right) moveHorizontal(entity, 1);

      if (isClimbable(col, row)) {
        if (climb && canPass(col, row - 1)) entity.vy = -SPEED;
        else if (down && canPass(col, row + 1)) entity.vy = SPEED;
      } else if (!entitySupport(entity)) {
        entity.vy = FALL_SPEED;
      }
    }
  } else {
    entity.vx = 0;
    entity.vy = 0;
    if (entity.inHole) return;

    const pp = gridPos(player);
    if (isClimbable(col, row)) {
      entity.vy = pp.row < row ? -SPEED * 0.85 : pp.row > row ? SPEED * 0.85 : 0;
    } else if (!entitySupport(entity)) {
      entity.vy = FALL_SPEED * 0.9;
    } else {
      entity.vx = pp.col < col ? -SPEED * 0.75 : pp.col > col ? SPEED * 0.75 : 0;
    }
  }

  entity.x += entity.vx;
  entity.y += entity.vy;

  const np = gridPos(entity);
  entity.inHole = holes.some((h) => h.col === np.col && h.row === np.row);

  if (entity.vx !== 0) {
    const nextCol = np.col + Math.sign(entity.vx);
    if (!canPass(nextCol, np.row)) {
      snapToCenter(entity);
      entity.vx = 0;
    }
  }

  if (entity.vy !== 0) {
    const nextRow = np.row + Math.sign(entity.vy);
    if (entity.vy > 0) {
      if (isSolid(np.col, nextRow) && !isClimbable(np.col, np.row)) {
        entity.y = (nextRow - 1) * TILE + TILE / 2;
        entity.vy = 0;
      } else if (!canPass(np.col, nextRow) && !isClimbable(np.col, nextRow)) {
        entity.y = (nextRow - 1) * TILE + TILE / 2;
        entity.vy = 0;
      }
    }
    if (entity.vy < 0 && !canPass(np.col, nextRow)) {
      entity.y = (nextRow + 1) * TILE + TILE / 2;
      entity.vy = 0;
    }
  }

  if (entity.vx === 0 && entity.vy === 0 && distToCenter(entity) < 0.5) {
    snapToCenter(entity);
  }

  if (entity.type === "player" && cell(np.col, np.row) === GOLD) {
    grid[np.row][np.col] = " ";
    goldLeft -= 1;
    score += 100;
    updateHud();
  }
}

function updateHoles() {
  holes = holes.filter((hole) => {
    hole.timer -= 1;
    if (hole.timer <= 0) {
      if (grid[hole.row][hole.col] === " ") {
        grid[hole.row][hole.col] = hole.original;
      }
      return false;
    }
    return true;
  });
  if (digCooldown > 0) digCooldown -= 1;
}

function checkCollisions() {
  const pp = gridPos(player);
  for (const enemy of enemies) {
    const ep = gridPos(enemy);
    if (pp.col === ep.col && pp.row === ep.row) {
      if (enemy.inHole) {
        respawnEnemy(enemy);
        score += 50;
        updateHud();
      } else {
        loseLife();
        return;
      }
    }
  }

  if (goldLeft === 0 && cell(pp.col, pp.row) === EXIT) {
    endGame(true);
  }
}

function respawnEnemy(enemy) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (LEVEL[row][col] === "E") {
        enemy.x = col * TILE + TILE / 2;
        enemy.y = row * TILE + TILE / 2;
        enemy.inHole = false;
        enemy.vx = 0;
        enemy.vy = 0;
        return;
      }
    }
  }
}

function loseLife() {
  lives -= 1;
  updateHud();
  if (lives <= 0) {
    endGame(false);
    return;
  }
  parseLevel();
  gameState = "ready";
  showOverlay("やられた！", `残りライフ: ${lives}`, "続ける");
}

function updateHud() {
  const collected = goldTotal - goldLeft;
  scoreEl.textContent = `💰 ${collected} / ${goldTotal}`;
  livesEl.textContent = `❤️ × ${lives}`;
}

function endGame(won) {
  gameState = won ? "win" : "over";
  showOverlay(
    won ? "クリア！" : "ゲームオーバー",
    won ? `スコア: ${score}` : `スコア: ${score}`,
    "もう一度"
  );
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
  lives = 3;
  gameState = "playing";
  parseLevel();
  updateHud();
  hideOverlay();
  canvas.focus();
}

function drawCell(col, row) {
  const x = col * TILE;
  const y = row * TILE;
  const c = cell(col, row);

  if (c === HARD) {
    ctx.fillStyle = "#4a3728";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = "#2d1f14";
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    return;
  }

  ctx.fillStyle = "#1a1208";
  ctx.fillRect(x, y, TILE, TILE);

  if (c === BRICK) {
    ctx.fillStyle = "#c84c0c";
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = "#8b4513";
    ctx.fillRect(x + 3, y + TILE - 5, TILE - 6, 3);
  }

  if (c === LADDER) {
    ctx.strokeStyle = "#48dbfb";
    ctx.lineWidth = 2;
    for (let i = 4; i < TILE - 2; i += 6) {
      ctx.beginPath();
      ctx.moveTo(x + 5, y + i);
      ctx.lineTo(x + TILE - 5, y + i);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 2);
    ctx.lineTo(x + 8, y + TILE - 2);
    ctx.moveTo(x + TILE - 8, y + 2);
    ctx.lineTo(x + TILE - 8, y + TILE - 2);
    ctx.stroke();
  }

  if (c === GOLD) {
    ctx.fillStyle = "#feca57";
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e67e22";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (c === EXIT) {
    ctx.fillStyle = "#1dd1a1";
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("EXIT", x + TILE / 2, y + TILE / 2 + 4);
  }

  const hole = holes.find((h) => h.col === col && h.row === row);
  if (hole) {
    ctx.fillStyle = "#1a1208";
    ctx.fillRect(x + 2, y + TILE - 8, TILE - 4, 8);
  }
}

function drawEntity(entity, color) {
  const { col, row } = gridPos(entity);
  const x = entity.x;
  const y = entity.y;

  ctx.fillStyle = color;
  ctx.fillRect(x - 8, y - 10, 16, 20);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x - 5 + entity.facing * 2, y - 6, 3, 3);
  ctx.fillRect(x + 2 + entity.facing * 2, y - 6, 3, 3);

  if (entity.inHole) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(col * TILE, row * TILE + TILE - 8, TILE, 8);
  }
}

function render() {
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      drawCell(col, row);
    }
  }

  for (const enemy of enemies) drawEntity(enemy, "#ff6b6b");
  if (player) drawEntity(player, "#48dbfb");

  ctx.restore();
}

function tick() {
  if (gameState === "playing") {
    updateEntity(player);
    for (const enemy of enemies) updateEntity(enemy);
    updateHoles();
    checkCollisions();
  }
  render();
  requestAnimationFrame(tick);
}

let dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = cols * TILE * dpr;
  canvas.height = rows * TILE * dpr;
  canvas.style.width = `${cols * TILE}px`;
  canvas.style.height = `${rows * TILE}px`;
}

window.addEventListener("keydown", (e) => {
  if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    keys.add(e.key.toLowerCase());
    return;
  }
  keys.add(e.key.toLowerCase());
});

window.addEventListener("keyup", (e) => {
  if (e.key.startsWith("Arrow")) {
    keys.delete(e.key.toLowerCase());
    return;
  }
  keys.delete(e.key.toLowerCase());
});

for (const btn of document.querySelectorAll(".touch-btn")) {
  const action = btn.dataset.action;
  const map = {
    up: "up",
    down: "down",
    left: "left",
    right: "right",
    "dig-left": "digLeft",
    "dig-right": "digRight",
  };
  const key = map[action];

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    touch[key] = true;
    btn.classList.add("is-active");
  });
  const release = () => {
    touch[key] = false;
    btn.classList.remove("is-active");
  };
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("pointerleave", release);
}

overlayBtn.addEventListener("click", () => {
  if (gameState === "ready") {
    hideOverlay();
    gameState = "playing";
    canvas.focus();
  } else if (gameState === "win" || gameState === "over") {
    startGame();
    canvas.focus();
  }
});

parseLevel();
updateHud();
resize();
showOverlay("ロードランナー", "金塊を集めて出口(T)へ！穴を掘って敵を落とせ！", "スタート");
gameState = "ready";
requestAnimationFrame(tick);

new ResizeObserver(resize).observe(wrap);
