const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const wrap = document.getElementById("canvas-wrap");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const overlayBtn = document.getElementById("overlay-btn");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const dotsLeftEl = document.getElementById("dots-left");

const TILE = 20;
const PLAYER_SPEED = 1;
const GHOST_SPEED = 0.85;
const FRIGHTENED_TIME = 480;
const GHOST_COLORS = ["#ff0000", "#ffb8ff", "#00ffff", "#ffb852"];
const DIR = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const MAZE_RAW = [
  "#################",
  "#.......#.......#",
  "#.###.###.###.###",
  "#*#...#...#...#*#",
  "#.#.###.#.###.#.#",
  "#.....#P#.......#",
  "###.###.#.###.###",
  "   #....#....#   ",
  "###.#.#####.#.###",
  "#.....#...#.....#",
  "#.###.#.#.#.###.#",
  "#...#.......#...#",
  "###.#.#####.#.###",
  "#.......#.......#",
  "#.#####.#.#####.#",
  "#*..#... ... ...#",
  "#.###.###.###.###",
  "#...............#",
  "#################",
];

let maze = [];
let dots = [];
let powerPellets = [];
let player = null;
let ghosts = [];
let score = 0;
let lives = 3;
let frightenedTimer = 0;
let mouthFrame = 0;
let gameState = "ready";
let cols = 0;
let rows = 0;

const keys = new Set();
let touchDir = null;

function parseMaze() {
  maze = MAZE_RAW.map((row) => row.split(""));
  rows = maze.length;
  cols = maze[0].length;
  dots = [];
  powerPellets = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ch = maze[row][col];
      if (ch === ".") {
        dots.push({ col, row });
        maze[row][col] = " ";
      } else if (ch === "*") {
        powerPellets.push({ col, row });
        maze[row][col] = " ";
      } else if (ch === "P") {
        player = createPlayer(col, row);
        maze[row][col] = " ";
      }
    }
  }

  const ghostStarts = [
    [8, 8],
    [7, 9],
    [9, 9],
    [8, 10],
  ];
  ghosts = ghostStarts.map((pos, i) => createGhost(pos[0], pos[1], i));
}

function createPlayer(col, row) {
  return {
    x: col * TILE + TILE / 2,
    y: row * TILE + TILE / 2,
    dir: { x: 0, y: 0 },
    nextDir: { x: 0, y: 0 },
  };
}

function createGhost(col, row, index) {
  return {
    x: col * TILE + TILE / 2,
    y: row * TILE + TILE / 2,
    dir: { x: -1, y: 0 },
    color: GHOST_COLORS[index],
    index,
    mode: "normal",
    homeCol: col,
    homeRow: row,
  };
}

function isWall(col, row) {
  if (row < 0 || row >= rows || col < 0 || col >= cols) {
    return row !== 7;
  }
  return maze[row][col] === "#";
}

function canEnter(col, row) {
  if (row === 7 && (col < 0 || col >= cols)) return true;
  return !isWall(col, row);
}

function gridPos(entity) {
  return {
    col: Math.round((entity.x - TILE / 2) / TILE),
    row: Math.round((entity.y - TILE / 2) / TILE),
  };
}

function atCenter(entity, speed) {
  const col = (entity.x - TILE / 2) % TILE;
  const row = (entity.y - TILE / 2) % TILE;
  return Math.abs(col) < speed && Math.abs(row) < speed;
}

function snapToCenter(entity) {
  const { col, row } = gridPos(entity);
  entity.x = col * TILE + TILE / 2;
  entity.y = row * TILE + TILE / 2;
}

function getDesiredDir() {
  if (keys.has("arrowup") || keys.has("w")) return DIR.up;
  if (keys.has("arrowdown") || keys.has("s")) return DIR.down;
  if (keys.has("arrowleft") || keys.has("a")) return DIR.left;
  if (keys.has("arrowright") || keys.has("d")) return DIR.right;
  if (touchDir) return DIR[touchDir];
  return null;
}

function tryTurn(entity, dir) {
  if (!dir) return;
  const { col, row } = gridPos(entity);
  if (canEnter(col + dir.x, row + dir.y)) {
    entity.dir = { ...dir };
  }
}

function moveEntity(entity, speed) {
  if (entity.dir.x === 0 && entity.dir.y === 0) return;

  entity.x += entity.dir.x * speed;
  entity.y += entity.dir.y * speed;

  if (entity.dir.x !== 0 && gridPos(entity).row === 7) {
    if (entity.x < TILE / 2) entity.x = (cols - 1) * TILE + TILE / 2;
    else if (entity.x > (cols - 1) * TILE + TILE / 2) entity.x = TILE / 2;
  }

  const { col: c, row: r } = gridPos(entity);
  if (!canEnter(c + entity.dir.x, r + entity.dir.y)) {
    snapToCenter(entity);
    entity.dir = { x: 0, y: 0 };
  }
}

function availableDirs(col, row) {
  const result = [];
  for (const [name, d] of Object.entries(DIR)) {
    if (canEnter(col + d.x, row + d.y)) result.push({ name, ...d });
  }
  return result;
}

function opposite(d) {
  return { x: -d.x, y: -d.y };
}

function dist(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function chooseGhostDir(ghost) {
  const { col, row } = gridPos(ghost);
  const options = availableDirs(col, row).filter(
    (d) => !(d.x === -ghost.dir.x && d.y === -ghost.dir.y)
  );
  if (options.length === 0) return opposite(ghost.dir);

  if (ghost.mode === "frightened") {
    return options[Math.floor(Math.random() * options.length)];
  }

  const target = gridPos(player);
  let best = options[0];
  let bestDist = Infinity;
  for (const opt of options) {
    const d = dist({ col: col + opt.x, row: row + opt.y }, target);
    if (d < bestDist || (d === bestDist && Math.random() < 0.3)) {
      bestDist = d;
      best = opt;
    }
  }
  return best;
}

function updatePlayer() {
  const desired = getDesiredDir();
  if (desired) player.nextDir = desired;

  if (atCenter(player, PLAYER_SPEED)) {
    snapToCenter(player);
    if (player.nextDir.x || player.nextDir.y) {
      tryTurn(player, player.nextDir);
    }
    if (!player.dir.x && !player.dir.y && player.nextDir.x) {
      tryTurn(player, player.nextDir);
    }
  }

  moveEntity(player, PLAYER_SPEED);
  collectItems();
}

function collectItems() {
  const { col, row } = gridPos(player);

  dots = dots.filter((d) => {
    if (d.col === col && d.row === row) {
      score += 10;
      return false;
    }
    return true;
  });

  powerPellets = powerPellets.filter((p) => {
    if (p.col === col && p.row === row) {
      score += 50;
      frightenedTimer = FRIGHTENED_TIME;
      for (const g of ghosts) {
        if (g.mode !== "eaten") g.mode = "frightened";
      }
      return false;
    }
    return true;
  });

  updateHud();

  if (dots.length === 0 && powerPellets.length === 0) {
    endGame(true);
  }
}

function updateGhosts() {
  for (const ghost of ghosts) {
    if (ghost.mode === "eaten") {
      const { col, row } = gridPos(ghost);
      if (col === ghost.homeCol && row === ghost.homeRow) {
        ghost.mode = frightenedTimer > 0 ? "frightened" : "normal";
      }
      const home = { col: ghost.homeCol, row: ghost.homeRow };
      const options = availableDirs(col, row);
      let best = options[0];
      let bestDist = Infinity;
      for (const opt of options) {
        const d = dist({ col: col + opt.x, row: row + opt.y }, home);
        if (d < bestDist) {
          bestDist = d;
          best = opt;
        }
      }
      if (best) ghost.dir = { x: best.x, y: best.y };
      moveEntity(ghost, GHOST_SPEED);
      continue;
    }

    if (atCenter(ghost, GHOST_SPEED)) {
      snapToCenter(ghost);
      const chosen = chooseGhostDir(ghost);
      ghost.dir = { x: chosen.x, y: chosen.y };
    }

    moveEntity(ghost, GHOST_SPEED);

    if (gridPos(ghost).col === gridPos(player).col &&
        gridPos(ghost).row === gridPos(player).row) {
      if (ghost.mode === "frightened") {
        ghost.mode = "eaten";
        score += 200;
        updateHud();
      } else {
        loseLife();
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
  resetPositions();
  gameState = "ready";
  showOverlay("ミス！", "残りライフ: " + lives, "続ける");
}

function resetPositions() {
  player = createPlayer(7, 5);
  const ghostStarts = [
    [8, 8],
    [7, 9],
    [9, 9],
    [8, 10],
  ];
  ghosts = ghostStarts.map((pos, i) => createGhost(pos[0], pos[1], i));
}

function updateHud() {
  scoreEl.textContent = `スコア: ${score}`;
  livesEl.textContent = `❤️ × ${lives}`;
  dotsLeftEl.textContent = `残り: ${dots.length + powerPellets.length}`;
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
  frightenedTimer = 0;
  gameState = "playing";
  parseMaze();
  updateHud();
  hideOverlay();
}

function drawMaze() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#2121de";
  ctx.lineWidth = 2;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (maze[row][col] !== "#") continue;
      const x = col * TILE;
      const y = row * TILE;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    }
  }

  ctx.fillStyle = "#ffb897";
  for (const d of dots) {
    ctx.beginPath();
    ctx.arc(d.col * TILE + TILE / 2, d.row * TILE + TILE / 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ffb897";
  for (const p of powerPellets) {
    ctx.beginPath();
    ctx.arc(p.col * TILE + TILE / 2, p.row * TILE + TILE / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  if (!player) return;
  mouthFrame += 1;
  const open = (Math.sin(mouthFrame * 0.2) + 1) * 0.25 + 0.05;
  let angle = 0;
  if (player.dir.x === 1) angle = 0;
  else if (player.dir.x === -1) angle = Math.PI;
  else if (player.dir.y === -1) angle = -Math.PI / 2;
  else if (player.dir.y === 1) angle = Math.PI / 2;

  ctx.fillStyle = "#ff0";
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.arc(player.x, player.y, TILE / 2 - 2, angle + open * Math.PI, angle - open * Math.PI, true);
  ctx.fill();
}

function drawGhost(ghost) {
  const x = ghost.x;
  const y = ghost.y;
  const r = TILE / 2 - 2;

  if (ghost.mode === "frightened") {
    ctx.fillStyle = frightenedTimer < 120 && Math.floor(frightenedTimer / 8) % 2 ? "#fff" : "#2121de";
  } else if (ghost.mode === "eaten") {
    ctx.fillStyle = "#444";
  } else {
    ctx.fillStyle = ghost.color;
  }

  ctx.beginPath();
  ctx.arc(x, y - 2, r, Math.PI, 0);
  ctx.lineTo(x + r, y + r);
  for (let i = 3; i >= 0; i--) {
    const px = x - r + (2 * r * i) / 3;
    ctx.lineTo(px, y + r - (i % 2 === 0 ? 4 : 0));
  }
  ctx.lineTo(x - r, y - 2);
  ctx.fill();

  if (ghost.mode !== "eaten") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x - 4, y - 2, 3, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#00f";
    ctx.fillRect(x - 5, y - 3, 2, 3);
    ctx.fillRect(x + 3, y - 3, 2, 3);
  }
}

function render() {
  ctx.save();
  ctx.scale(dpr, dpr);
  drawMaze();
  if (player) drawPlayer();
  for (const g of ghosts) drawGhost(g);
  ctx.restore();
}

function tick() {
  if (gameState === "playing") {
    updatePlayer();
    if (frightenedTimer > 0) {
      frightenedTimer -= 1;
      if (frightenedTimer === 0) {
        for (const g of ghosts) {
          if (g.mode === "frightened") g.mode = "normal";
        }
      }
    }
    updateGhosts();
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
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.key.toLowerCase());
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

for (const btn of document.querySelectorAll(".touch-btn[data-dir]")) {
  const dir = btn.dataset.dir;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    touchDir = dir;
    btn.classList.add("is-active");
  });
  const release = () => {
    touchDir = null;
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
  } else if (gameState === "win" || gameState === "over") {
    startGame();
  }
});

parseMaze();
cols = maze[0].length;
rows = maze.length;
updateHud();
resize();
showOverlay("シンプルパックマン", "ドットを全部食べてクリア！", "スタート");
gameState = "ready";
requestAnimationFrame(tick);
