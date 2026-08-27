// ===== TYPING DELUXE メインロジック =====

const $ = (id) => document.getElementById(id);

const S = {
  mode: "time",
  timeSec: 60,
  count: 25,
  cat: "mix",
  running: false,
  deck: [],
  deckPos: 0,
  word: null,
  typer: null,
  startTime: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  correct: 0,
  miss: 0,
  wordsDone: 0,
  target: 0,
  raf: 0,
};

const MODE_DESC = {
  time: "制限時間内にできるだけ多く打つ。ミスしても続行。",
  count: "決まった数のお題をこなすまでのタイムとスコアを競う。",
  sudden: "1文字でもミスしたら即終了。全カテゴリのお題を打ち続ける。",
};

// ---------- スタート画面の設定 UI ----------
function initStartUI() {
  // カテゴリボタン
  const catRow = $("catRow");
  const cats = [["mix", "ミックス"]].concat(
    Object.keys(WORD_SETS).map((k) => [k, WORD_SETS[k].label])
  );
  cats.forEach(([key, label], i) => {
    const b = document.createElement("button");
    b.className = "opt" + (i === 0 ? " active" : "");
    b.dataset.val = key;
    b.textContent = label;
    catRow.appendChild(b);
  });
  catRow.addEventListener("click", (e) => {
    const b = e.target.closest(".opt");
    if (!b) return;
    [...catRow.children].forEach((c) => c.classList.toggle("active", c === b));
    S.cat = b.dataset.val;
    refreshBest();
  });

  // モード
  $("modeRow").addEventListener("click", (e) => {
    const b = e.target.closest(".opt");
    if (!b) return;
    [...$("modeRow").children].forEach((c) => c.classList.toggle("active", c === b));
    S.mode = b.dataset.mode;
    $("modeDesc").textContent = MODE_DESC[S.mode];
    $("subTime").hidden = S.mode !== "time";
    $("subCount").hidden = S.mode !== "count";
    refreshBest();
  });

  // サブオプション(時間 / お題数)
  document.querySelectorAll("[data-sub]").forEach((row) => {
    row.addEventListener("click", (e) => {
      const b = e.target.closest(".opt");
      if (!b) return;
      [...row.children].forEach((c) => c.classList.toggle("active", c === b));
      if (row.dataset.sub === "time") S.timeSec = +b.dataset.val;
      else S.count = +b.dataset.val;
      refreshBest();
    });
  });

  buildKeyboard();
  refreshBest();
  $("verText").textContent = "v" + CHANGELOG[0].version;
}

// ---------- ハイスコア ----------
function bestKey() {
  const p = S.mode === "time" ? S.timeSec : S.mode === "count" ? S.count : "x";
  return `td_best_${S.mode}_${p}_${S.cat}`;
}
function loadBest() {
  try { return JSON.parse(localStorage.getItem(bestKey()) || "null"); }
  catch (e) { return null; }
}
function saveBest(rec) {
  try { localStorage.setItem(bestKey(), JSON.stringify(rec)); } catch (e) {}
}
function refreshBest() {
  const b = loadBest();
  const modeName = S.mode === "time" ? `タイムアタック ${S.timeSec}秒`
    : S.mode === "count" ? `お題数 ${S.count}問` : "サドンデス";
  const catName = S.cat === "mix" ? "ミックス" : WORD_SETS[S.cat].label;
  $("bestBox").innerHTML = b
    ? `${modeName}・${catName} のベスト： <b>${b.score.toLocaleString()}</b> 点／${b.kpm} KPM／正確率 ${b.acc}%`
    : `${modeName}・${catName}： まだ記録がありません`;
}

// ---------- キーボード ----------
const KB_ROWS = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  "zxcvbnm".split(""),
];
function buildKeyboard() {
  const kb = $("keyboard");
  kb.innerHTML = "";
  KB_ROWS.forEach((row) => {
    const r = document.createElement("div");
    r.className = "kb-row";
    row.forEach((ch) => {
      const k = document.createElement("div");
      k.className = "key";
      k.dataset.k = ch;
      k.textContent = ch;
      r.appendChild(k);
    });
    kb.appendChild(r);
  });
}
function updateKeyboardHint() {
  const next = S.typer ? S.typer.nextKeys() : new Set();
  document.querySelectorAll(".key").forEach((k) => {
    k.classList.toggle("next", next.has(k.dataset.k));
  });
}
function flashKey(ch, cls) {
  const k = document.querySelector(`.key[data-k="${ch}"]`);
  if (!k) return;
  k.classList.add(cls);
  setTimeout(() => k.classList.remove(cls), 90);
}

// ---------- ゲーム進行 ----------
function showScreen(name) {
  ["start", "play", "result"].forEach((s) => {
    $("screen-" + s).hidden = s !== name;
  });
}

function startGame() {
  S.running = true;
  S.deck = buildDeck(S.cat);
  S.deckPos = 0;
  S.score = S.combo = S.maxCombo = S.correct = S.miss = S.wordsDone = 0;
  S.startTime = performance.now();
  S.target = S.mode === "count" ? S.count : S.deck.length;

  $("timeLabel").textContent = S.mode === "time" ? "残り" : "経過";
  showScreen("play");
  SFX.unlock();
  SFX.start();
  nextWord();
  loop();
}

function nextWord() {
  if (S.deckPos >= S.deck.length) {
    S.deck = buildDeck(S.cat);
    S.deckPos = 0;
  }
  S.word = S.deck[S.deckPos++];
  S.typer = new Typer(S.word.k);
  renderCard(false);
  updateKeyboardHint();
}

function renderCard(missFlag) {
  const d = S.typer.display();
  $("disp").textContent = S.word.t;
  $("kana").textContent = S.word.k;
  const cur = d.remain.slice(0, 1);
  const rest = d.remain.slice(1);
  $("roma").innerHTML =
    `<span class="done">${d.typed}</span>` +
    `<span class="cur">${cur}</span>` +
    `<span class="rest">${rest}</span>`;
  const card = $("card");
  if (missFlag) {
    card.classList.remove("miss");
    void card.offsetWidth;
    card.classList.add("miss");
  }
}

function onKey(e) {
  if (!S.running) return;
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  const ch = e.key.toLowerCase();
  if (!/[a-z0-9,.\-' ]/.test(ch)) return;
  e.preventDefault();
  SFX.unlock();

  const res = S.typer.input(ch);
  if (res === "ng") {
    S.miss++;
    S.combo = 0;
    SFX.miss();
    renderCard(true);
    flashKey(ch, "hit");
    updateHud();
    if (S.mode === "sudden") return finish("miss");
    return;
  }

  // 受理
  S.correct++;
  S.combo++;
  if (S.combo > S.maxCombo) S.maxCombo = S.combo;
  S.score += 10 + Math.floor(S.combo / 10) * 3;
  flashKey(ch, "hit");
  SFX.key();

  if (res === "done") {
    S.wordsDone++;
    S.score += 30;
    if (S.combo > 1 && S.combo % 10 === 0) SFX.combo(S.combo / 10);
    else SFX.word();
    if (S.mode === "count" && S.wordsDone >= S.count) {
      updateHud();
      return finish("clear");
    }
    nextWord();
  } else {
    renderCard(false);
  }
  updateKeyboardHint();
  updateHud();
}

function elapsedSec() {
  return (performance.now() - S.startTime) / 1000;
}
function kpm() {
  const m = elapsedSec() / 60;
  return m > 0 ? Math.round(S.correct / m) : 0;
}
function accuracy() {
  const tot = S.correct + S.miss;
  return tot > 0 ? Math.round((S.correct / tot) * 1000) / 10 : 100;
}

function updateHud() {
  const el = elapsedSec();
  if (S.mode === "time") {
    const rem = Math.max(0, S.timeSec - el);
    $("stTime").textContent = rem.toFixed(1);
    $("stTime").parentElement.classList.toggle("warn", rem <= 10);
  } else {
    $("stTime").textContent = el.toFixed(1);
  }
  $("stScore").textContent = S.score.toLocaleString();
  $("stKpm").textContent = kpm();
  $("stAcc").textContent = accuracy() + "%";
  $("stCombo").textContent = S.combo;
  $("stMiss").textContent = S.miss;

  let ratio = 0;
  if (S.mode === "time") ratio = Math.min(1, el / S.timeSec);
  else if (S.mode === "count") ratio = S.wordsDone / S.count;
  else ratio = S.wordsDone / Math.max(1, S.target);
  $("progressBar").style.width = (ratio * 100) + "%";

  if (S.mode === "count") $("qcount").textContent = `お題 ${S.wordsDone} / ${S.count}`;
  else if (S.mode === "sudden") $("qcount").textContent = `お題 ${S.wordsDone} 問クリア中`;
  else $("qcount").textContent = `お題 ${S.wordsDone} 問`;
}

function loop() {
  updateHud();
  if (S.mode === "time" && elapsedSec() >= S.timeSec) {
    return finish("timeup");
  }
  S.raf = requestAnimationFrame(loop);
}

// ---------- リザルト ----------
const RANKS = [
  [480, "GOD", "神速タイパー。すべてのキーが手に馴染んでいる。"],
  [380, "SS", "達人級。実戦でも通用する速さと正確さ。"],
  [300, "S", "熟練タイピスト。タッチタイプが完全に身についている。"],
  [230, "A", "一人前。手元を見なくても打てるレベル。"],
  [160, "B", "見習い。指がホームポジションを覚え始めた。"],
  [100, "C", "ひよこタイパー。まずは正確さを優先しよう。"],
  [0, "D", "指の位置から練習しよう。焦らずゆっくりでOK。"],
];

function finish(reason) {
  if (!S.running) return;
  S.running = false;
  cancelAnimationFrame(S.raf);

  const el = elapsedSec();
  const k = kpm();
  const acc = accuracy();

  const rankDef = RANKS.find((r) => k >= r[0] && acc >= 80) || RANKS[RANKS.length - 1];
  $("rank").textContent = rankDef[1];
  $("rankSub").textContent = rankDef[2];

  $("resultCap").textContent =
    reason === "miss" ? "MISS — サドンデス終了"
      : reason === "timeup" ? "TIME UP"
        : "CLEAR";

  $("rScore").textContent = S.score.toLocaleString();
  $("rKpm").textContent = k;
  $("rAcc").textContent = acc + "%";
  $("rCombo").textContent = S.maxCombo;
  $("rChars").textContent = S.correct;
  $("rMiss").textContent = S.miss;
  $("rWords").textContent = S.wordsDone;
  $("rElapsed").textContent = el.toFixed(1) + "s";

  const prev = loadBest();
  const rec = { score: S.score, kpm: k, acc };
  const isBest = !prev || S.score > prev.score;
  $("newBest").hidden = !isBest;
  if (isBest) saveBest(rec);

  if (reason === "miss") SFX.fail();
  else SFX.finish();

  showScreen("result");
}

function abort() {
  if (!S.running) return;
  S.running = false;
  cancelAnimationFrame(S.raf);
  showScreen("start");
  refreshBest();
}

// ---------- グローバル操作 ----------
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { abort(); return; }
  if (e.key === "Enter") {
    if (!$("screen-start").hidden) { startGame(); return; }
    if (!$("screen-result").hidden) { startGame(); return; }
  }
  onKey(e);
});

$("startBtn").addEventListener("click", startGame);
$("retryBtn").addEventListener("click", startGame);
$("backBtn").addEventListener("click", () => { showScreen("start"); refreshBest(); });

$("muteBtn").addEventListener("click", () => {
  const m = SFX.toggleMute();
  $("muteBtn").textContent = m ? "🔇" : "🔊";
});
$("muteBtn").textContent = SFX.muted ? "🔇" : "🔊";

initStartUI();
