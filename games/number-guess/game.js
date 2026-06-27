const hintEl = document.getElementById("hint");
const attemptsEl = document.getElementById("attempts");
const guessInput = document.getElementById("guess-input");
const guessBtn = document.getElementById("guess-btn");
const restartBtn = document.getElementById("restart-btn");

let target = 0;
let attempts = 0;
let finished = false;

function newGame() {
  target = Math.floor(Math.random() * 100) + 1;
  attempts = 0;
  finished = false;
  hintEl.textContent = "1〜100の数字を当ててください";
  attemptsEl.textContent = "挑戦回数: 0";
  guessInput.value = "";
  guessInput.disabled = false;
  guessBtn.disabled = false;
  restartBtn.hidden = true;
  guessInput.focus();
}

function finishGame(message) {
  finished = true;
  hintEl.textContent = message;
  guessInput.disabled = true;
  guessBtn.disabled = true;
  restartBtn.hidden = false;
}

function submitGuess() {
  if (finished) return;

  const value = Number(guessInput.value);
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    hintEl.textContent = "1〜100の整数を入力してください";
    return;
  }

  attempts += 1;
  attemptsEl.textContent = `挑戦回数: ${attempts}`;

  if (value === target) {
    finishGame(`正解！ ${attempts} 回で当てました 🎉`);
    return;
  }

  hintEl.textContent = value < target ? "もっと大きい数字です" : "もっと小さい数字です";
  guessInput.select();
}

guessBtn.addEventListener("click", submitGuess);
guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitGuess();
});
restartBtn.addEventListener("click", newGame);

newGame();
