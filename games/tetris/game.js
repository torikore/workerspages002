const COLS = 10;
const ROWS = 20;
const BLOCK = 20;

const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const overlayBtn = document.getElementById("overlay-btn");

const SHAPES = {
  I: { color: "#00f0f0", cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { color: "#f0f000", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { color: "#a000f0", cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { color: "#00f000", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { color: "#f00000", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { color: "#0000f0", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { color: "#f0a000", cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

const TYPES = Object.keys(SHAPES);
const LINE_SCORES = [0, 100, 300, 500, 800];

let grid = [];
let current = null;
let next = null;
let score = 0;
let lines = 0;
let level = 1;
let dropInterval = 800;
let lastDrop = 0;
let paused = false;
let gameOver = false;
let started = false;
let animId = null;

const keys = new Set();
const touchInput = {};

function createGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomType() {
  return TYPES[Math.floor(Math.random() * TYPES.length)];
}

function rotateCells(cells) {
  const max = cells.reduce((m, [x, y]) => Math.max(m, x, y), 0);
  const size = max + 1;
  const map = Array.from({ length: size }, () => Array(size).fill(0));
  for (const [x, y] of cells) map[y][x] = 1;

  const rotated = Array.from({ length: size }, () => Array(size).fill(0));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      rotated[x][size - 1 - y] = map[y][x];
    }
  }

  const result = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rotated[y][x]) result.push([x, y]);
    }
  }
  return result;
}

function spawnPiece(type) {
  const shape = SHAPES[type];
  return {
    type,
    color: shape.color,
    cells: shape.cells.map(([x, y]) => [x, y]),
    x: 3,
    y: 0,
  };
}

function cellPositions(piece, offsetX = 0, offsetY = 0) {
  return piece.cells.map(([x, y]) => [piece.x + x + offsetX, piece.y + y + offsetY]);
}

function isValid(piece, offsetX = 0, offsetY = 0, cells = piece.cells) {
  for (const [x, y] of cells) {
    const col = piece.x + x + offsetX;
    const row = piece.y + y + offsetY;
    if (col < 0 || col >= COLS || row >= ROWS) return false;
    if (row >= 0 && grid[row][col]) return false;
  }
  return true;
}

function lockPiece() {
  for (const [x, y] of cellPositions(current)) {
    if (y >= 0) grid[y][x] = current.color;
  }
  clearLines();
  current = next;
  next = spawnPiece(randomType());
  drawNext();

  if (!isValid(current)) {
    endGame();
  }
}

function clearLines() {
  let cleared = 0;
  for (let row = ROWS - 1; row >= 0; row--) {
    if (grid[row].every((cell) => cell)) {
      grid.splice(row, 1);
      grid.unshift(Array(COLS).fill(null));
      cleared += 1;
      row += 1;
    }
  }
  if (cleared > 0) {
    lines += cleared;
    score += LINE_SCORES[cleared] * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(120, 800 - (level - 1) * 70);
    updateHud();
  }
}

function move(dx, dy) {
  if (!current || paused || gameOver) return false;
  if (isValid(current, dx, dy)) {
    current.x += dx;
    current.y += dy;
    return true;
  }
  return false;
}

function rotate() {
  if (!current || paused || gameOver) return;
  const rotated = rotateCells(current.cells);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (isValid(current, kick, 0, rotated)) {
      current.cells = rotated;
      current.x += kick;
      return;
    }
  }
}

function hardDrop() {
  if (!current || paused || gameOver) return;
  while (move(0, 1)) {
    score += 2;
  }
  lockPiece();
  updateHud();
}

function softDrop() {
  if (move(0, 1)) {
    score += 1;
    updateHud();
    return true;
  }
  lockPiece();
  return false;
}

function updateHud() {
  scoreEl.textContent = `スコア: ${score}`;
  linesEl.textContent = `ライン: ${lines}`;
  levelEl.textContent = `Lv: ${level}`;
}

function drawBlock(ctx, x, y, color, size = BLOCK) {
  const pad = 1;
  ctx.fillStyle = color;
  ctx.fillRect(x * size + pad, y * size + pad, size - pad * 2, size - pad * 2);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x * size + pad, y * size + pad, size - pad * 2, 3);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x * size + pad, y * size + size - pad - 4, size - pad * 2, 3);
}

function drawBoard() {
  boardCtx.fillStyle = "#0d1117";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col]) {
        drawBlock(boardCtx, col, row, grid[row][col]);
      }
    }
  }

  if (current) {
    for (const [x, y] of cellPositions(current)) {
      if (y >= 0) drawBlock(boardCtx, x, y, current.color);
    }
  }

  boardCtx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let col = 0; col <= COLS; col++) {
    boardCtx.beginPath();
    boardCtx.moveTo(col * BLOCK, 0);
    boardCtx.lineTo(col * BLOCK, ROWS * BLOCK);
    boardCtx.stroke();
  }
  for (let row = 0; row <= ROWS; row++) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, row * BLOCK);
    boardCtx.lineTo(COLS * BLOCK, row * BLOCK);
    boardCtx.stroke();
  }
}

function drawNext() {
  nextCtx.fillStyle = "#0d1117";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return;

  const size = 18;
  const minX = Math.min(...next.cells.map(([x]) => x));
  const maxX = Math.max(...next.cells.map(([x]) => x));
  const minY = Math.min(...next.cells.map(([, y]) => y));
  const maxY = Math.max(...next.cells.map(([, y]) => y));
  const offsetX = (4 - (maxX - minX + 1)) / 2 - minX;
  const offsetY = (4 - (maxY - minY + 1)) / 2 - minY;

  for (const [x, y] of next.cells) {
    drawBlock(nextCtx, x + offsetX, y + offsetY, next.color, size);
  }
}

function showOverlay(title, msg, btnText) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlayBtn.textContent = btnText;
  overlay.classList.add("is-visible");
}

function hideOverlay() {
  overlay.classList.remove("is-visible");
}

function startGame() {
  grid = createGrid();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 800;
  paused = false;
  gameOver = false;
  started = true;
  next = spawnPiece(randomType());
  current = spawnPiece(randomType());
  lastDrop = performance.now();
  hideOverlay();
  updateHud();
  drawNext();
}

function endGame() {
  gameOver = true;
  showOverlay("ゲームオーバー", `スコア: ${score}`, "もう一度");
}

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  if (paused) {
    showOverlay("一時停止", "P キーで再開", "再開");
    overlayBtn.onclick = () => {
      paused = false;
      hideOverlay();
      overlayBtn.onclick = onOverlayClick;
      lastDrop = performance.now();
    };
  }
}

function onOverlayClick() {
  startGame();
}

function tick(now) {
  animId = requestAnimationFrame(tick);

  if (!started || paused || gameOver) {
    drawBoard();
    return;
  }

  if (keys.has("arrowdown") || touchInput.down) {
    if (now - lastDrop > 50) {
      softDrop();
      lastDrop = now;
    }
  } else if (now - lastDrop > dropInterval) {
    if (!move(0, 1)) lockPiece();
    lastDrop = now;
  }

  drawBoard();
}

function handleKeyDown(e) {
  const key = e.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(e.key.toLowerCase()) || e.key === " ") {
    e.preventDefault();
  }

  if (!started || gameOver) {
    if (key === "enter" || key === " ") startGame();
    return;
  }

  if (key === "p") {
    if (paused) {
      paused = false;
      hideOverlay();
      overlayBtn.onclick = onOverlayClick;
      lastDrop = performance.now();
    } else {
      togglePause();
    }
    return;
  }

  if (paused) return;

  if (e.key === "ArrowLeft") move(-1, 0);
  if (e.key === "ArrowRight") move(1, 0);
  if (e.key === "ArrowDown") softDrop();
  if (e.key === "ArrowUp") rotate();
  if (key === "x" || key === "z") rotate();
  if (e.key === " ") hardDrop();

  keys.add(e.key === " " ? " " : key);
}

function handleKeyUp(e) {
  const key = e.key === " " ? " " : e.key.toLowerCase();
  keys.delete(key);
}

function bindTouch(btn, action) {
  const press = () => {
    if (!started || gameOver) {
      startGame();
      return;
    }
    if (paused) return;

    btn.classList.add("is-active");
    if (action === "left") move(-1, 0);
    if (action === "right") move(1, 0);
    if (action === "rotate") rotate();
    if (action === "down") {
      touchInput.down = true;
      softDrop();
    }
    if (action === "drop") hardDrop();
    drawBoard();
  };

  const release = () => {
    btn.classList.remove("is-active");
    if (action === "down") touchInput.down = false;
  };

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    press();
  });
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("pointerleave", release);
}

overlayBtn.addEventListener("click", onOverlayClick);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);

for (const btn of document.querySelectorAll(".touch-btn")) {
  bindTouch(btn, btn.dataset.action);
}

function resizeBoard() {
  const wrap = document.getElementById("board-wrap");
  const maxW = Math.min(wrap.clientWidth || 280, 280);
  const scale = maxW / (COLS * BLOCK);
  boardCanvas.style.width = `${COLS * BLOCK * scale}px`;
  boardCanvas.style.height = `${ROWS * BLOCK * scale}px`;
}

new ResizeObserver(resizeBoard).observe(document.getElementById("game-root"));
window.addEventListener("resize", resizeBoard);

showOverlay("テトリス", "ブロックを揃えてラインを消そう！", "スタート");
resizeBoard();
animId = requestAnimationFrame(tick);
