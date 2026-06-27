const MOBILE_BREAKPOINT = 768;

const FALLBACK_GAMES = [
  {
    slug: "number-guess",
    title: "数字当て",
    path: "/games/number-guess/",
  },
  {
    slug: "tetris",
    title: "テトリス",
    path: "/games/tetris/",
  },
];

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuToggle = document.getElementById("menu-toggle");
const gameList = document.getElementById("game-list");
const welcome = document.getElementById("welcome");
const gameFrame = document.getElementById("game-frame");

let activeSlug = null;

function isMobile() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
}

function openDrawer() {
  sidebar.classList.add("is-open");
  overlay.hidden = false;
  overlay.classList.add("is-visible");
  menuToggle.setAttribute("aria-expanded", "true");
  menuToggle.setAttribute("aria-label", "メニューを閉じる");
}

function closeDrawer() {
  sidebar.classList.remove("is-open");
  overlay.hidden = true;
  overlay.classList.remove("is-visible");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "メニューを開く");
}

function toggleDrawer() {
  if (sidebar.classList.contains("is-open")) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

async function fetchGames() {
  try {
    const response = await fetch("/api/games");
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const games = await response.json();
    if (!Array.isArray(games) || games.length === 0) {
      return FALLBACK_GAMES;
    }
    return games;
  } catch {
    return FALLBACK_GAMES;
  }
}

function renderGameList(games) {
  gameList.innerHTML = "";

  for (const game of games) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "game-link";
    button.dataset.slug = game.slug;
    button.textContent = game.title;

    if (game.slug === activeSlug) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => selectGame(game, button));
    item.appendChild(button);
    gameList.appendChild(item);
  }
}

function selectGame(game, button) {
  activeSlug = game.slug;

  for (const link of gameList.querySelectorAll(".game-link")) {
    link.classList.toggle("is-active", link === button);
  }

  welcome.hidden = true;
  gameFrame.hidden = false;
  gameFrame.src = game.path;

  if (isMobile()) {
    closeDrawer();
  }
}

function showLoading() {
  gameList.innerHTML =
    '<li class="status-message">ゲーム一覧を読み込み中…</li>';
}

menuToggle.addEventListener("click", toggleDrawer);
overlay.addEventListener("click", closeDrawer);

window.addEventListener("resize", () => {
  if (!isMobile()) {
    closeDrawer();
  }
});

showLoading();
fetchGames().then((games) => {
  renderGameList(games);
});
