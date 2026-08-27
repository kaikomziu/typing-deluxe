// ひらがな → ローマ字 変換 & 逐次入力判定エンジン
// 複数のローマ字表記(shi/si、chi/ti、fu/hu、ji/zi、っ、ん 等)を許容する。

const ROMAJI_MAP = {
  "あ": ["a"], "い": ["i"], "う": ["u", "wu"], "え": ["e"], "お": ["o"],
  "か": ["ka", "ca"], "き": ["ki"], "く": ["ku", "cu", "qu"], "け": ["ke"], "こ": ["ko", "co"],
  "が": ["ga"], "ぎ": ["gi"], "ぐ": ["gu"], "げ": ["ge"], "ご": ["go"],
  "さ": ["sa"], "し": ["shi", "si", "ci"], "す": ["su"], "せ": ["se", "ce"], "そ": ["so"],
  "ざ": ["za"], "じ": ["ji", "zi"], "ず": ["zu"], "ぜ": ["ze"], "ぞ": ["zo"],
  "た": ["ta"], "ち": ["chi", "ti"], "つ": ["tsu", "tu"], "て": ["te"], "と": ["to"],
  "だ": ["da"], "ぢ": ["di"], "づ": ["du"], "で": ["de"], "ど": ["do"],
  "な": ["na"], "に": ["ni"], "ぬ": ["nu"], "ね": ["ne"], "の": ["no"],
  "は": ["ha"], "ひ": ["hi"], "ふ": ["fu", "hu"], "へ": ["he"], "ほ": ["ho"],
  "ば": ["ba"], "び": ["bi"], "ぶ": ["bu"], "べ": ["be"], "ぼ": ["bo"],
  "ぱ": ["pa"], "ぴ": ["pi"], "ぷ": ["pu"], "ぺ": ["pe"], "ぽ": ["po"],
  "ま": ["ma"], "み": ["mi"], "む": ["mu"], "め": ["me"], "も": ["mo"],
  "や": ["ya"], "ゆ": ["yu"], "よ": ["yo"],
  "ら": ["ra"], "り": ["ri"], "る": ["ru"], "れ": ["re"], "ろ": ["ro"],
  "わ": ["wa"], "を": ["wo", "o"],
  "ぁ": ["la", "xa"], "ぃ": ["li", "xi"], "ぅ": ["lu", "xu"], "ぇ": ["le", "xe"], "ぉ": ["lo", "xo"],
  "きゃ": ["kya"], "きゅ": ["kyu"], "きょ": ["kyo"],
  "ぎゃ": ["gya"], "ぎゅ": ["gyu"], "ぎょ": ["gyo"],
  "しゃ": ["sha", "sya"], "しゅ": ["shu", "syu"], "しょ": ["sho", "syo"],
  "じゃ": ["ja", "jya", "zya"], "じゅ": ["ju", "jyu", "zyu"], "じょ": ["jo", "jyo", "zyo"],
  "ちゃ": ["cha", "tya", "cya"], "ちゅ": ["chu", "tyu", "cyu"], "ちょ": ["cho", "tyo", "cyo"],
  "にゃ": ["nya"], "にゅ": ["nyu"], "にょ": ["nyo"],
  "ひゃ": ["hya"], "ひゅ": ["hyu"], "ひょ": ["hyo"],
  "びゃ": ["bya"], "びゅ": ["byu"], "びょ": ["byo"],
  "ぴゃ": ["pya"], "ぴゅ": ["pyu"], "ぴょ": ["pyo"],
  "みゃ": ["mya"], "みゅ": ["myu"], "みょ": ["myo"],
  "りゃ": ["rya"], "りゅ": ["ryu"], "りょ": ["ryo"],
  "ふぁ": ["fa"], "ふぃ": ["fi"], "ふぇ": ["fe"], "ふぉ": ["fo"],
  "てぃ": ["thi"], "でぃ": ["dhi"],
  "うぃ": ["wi"], "うぇ": ["we"],
  "しぇ": ["she"], "じぇ": ["je"], "ちぇ": ["che"],
  "ー": ["-"],
  "、": [","], "。": ["."], "・": ["/"], " ": [" "],
};

const VOWELS = "aiueo";
const SOKUON_STANDALONE = ["ltu", "xtu", "ltsu", "xtsu"];

function toChunks(kana) {
  const chunks = [];
  const small = "ゃゅょぁぃぅぇぉ";
  for (let i = 0; i < kana.length; i++) {
    const c = kana[i];
    const n = kana[i + 1];
    if (c === "っ") { chunks.push({ k: "っ", sokuon: true }); continue; }
    if (c === "ん") { chunks.push({ k: "ん", hatsuon: true }); continue; }
    if (n && small.includes(n) && ROMAJI_MAP[c + n]) {
      chunks.push({ k: c + n, cands: ROMAJI_MAP[c + n].slice() });
      i++;
      continue;
    }
    if (ROMAJI_MAP[c]) { chunks.push({ k: c, cands: ROMAJI_MAP[c].slice() }); continue; }
    chunks.push({ k: c, cands: [c.toLowerCase()] }); // フォールバック(英数字など)
  }
  return chunks;
}

// 打てない文字(漢字・カタカナ等)を列挙。マイリストの検証用。
function untypeableChars(kana) {
  const bad = [];
  for (const ch of toChunks(kana)) {
    if (ch.sokuon || ch.hatsuon) continue;
    if (ch.cands.length === 1 && ch.cands[0] === ch.k.toLowerCase() &&
        !/^[a-z0-9,.\-'/ ]$/i.test(ch.k)) {
      bad.push(ch.k);
    }
  }
  return bad;
}

class Typer {
  constructor(kana) {
    this.kana = kana;
    this.chunks = toChunks(kana);
    this.ci = 0;        // 現在のチャンク
    this.buf = "";      // 現在チャンクへ入力済みの文字
    this.pending = "";  // っ から引き継いだ子音
    this.typed = "";    // 受理済みの全入力文字列
  }

  get done() { return this.ci >= this.chunks.length; }

  // 指定チャンクの候補ローマ字(pending 適用なし)
  _rawCands(ci) {
    const ch = this.chunks[ci];
    if (!ch) return [];
    if (ch.hatsuon) return ["nn", "xn"];
    if (ch.sokuon) return SOKUON_STANDALONE.slice();
    return ch.cands.slice();
  }

  // 現在チャンクの実効候補(pending 適用済み)
  _cands() {
    const ch = this.chunks[this.ci];
    if (!ch) return [];
    if (ch.hatsuon || ch.sokuon) return this._rawCands(this.ci);
    const raw = ch.cands;
    return this.pending ? raw.map((r) => this.pending + r) : raw.slice();
  }

  // 次チャンクの候補の先頭文字集合(っ の二重子音判定用)
  _nextHeads() {
    const nx = this.chunks[this.ci + 1];
    if (!nx || nx.hatsuon || nx.sokuon) return new Set();
    return new Set(nx.cands.map((r) => r[0]));
  }

  _advance(consumedChar) {
    this.typed += consumedChar;
    this.ci += 1;
    this.buf = "";
    this.pending = "";
  }

  // 1文字入力。戻り値: "ok" | "ng" | "done"
  input(ch) {
    if (this.done) return "done";
    ch = ch.toLowerCase();
    const cur = this.chunks[this.ci];

    // --- っ(促音) ---
    if (cur.sokuon) {
      if (this.buf === "") {
        // 二重子音: 次チャンク先頭子音と一致
        if (!VOWELS.includes(ch) && ch !== "n" && this._nextHeads().has(ch)) {
          this.typed += ch;
          this.ci += 1;              // っ を消費
          this.pending = ch;
          this.buf = ch;             // 次チャンクへ1文字入力済み
          return this.done ? "done" : "ok";
        }
        if (ch === "l" || ch === "x") { this.buf = ch; this.typed += ch; return "ok"; }
        return "ng";
      }
      // 単独表記(ltu/xtu/...)の途中
      const nb = this.buf + ch;
      const hit = SOKUON_STANDALONE.filter((r) => r.startsWith(nb));
      if (hit.length === 0) return "ng";
      this.typed += ch;
      if (SOKUON_STANDALONE.includes(nb)) { this.ci += 1; this.buf = ""; return this.done ? "done" : "ok"; }
      this.buf = nb;
      return "ok";
    }

    // --- ん(撥音) ---
    if (cur.hatsuon) {
      if (this.buf === "") {
        if (ch === "n") { this.buf = "n"; this.typed += "n"; return "ok"; }
        if (ch === "x") { this.buf = "x"; this.typed += "x"; return "ok"; }
        return "ng";
      }
      if (this.buf === "n") {
        if (ch === "n") { this._advance("n"); return this.done ? "done" : "ok"; }
        // 単独 "n": 次が母音・n・y 以外の子音なら確定して ch を次チャンクへ
        const nx = this.chunks[this.ci + 1];
        if (nx && !nx.hatsuon && !nx.sokuon && !"aiueony".includes(ch)) {
          this.ci += 1; this.buf = ""; this.pending = "";  // ん を確定(typed は "n" 済み)
          return this.input(ch);
        }
        return "ng";
      }
      if (this.buf === "x") {
        if (ch === "n") { this._advance("n"); return this.done ? "done" : "ok"; }
        return "ng";
      }
    }

    // --- 通常チャンク ---
    const cands = this._cands();
    const nb = this.buf + ch;
    if (cands.includes(nb)) { this._advance(ch); return this.done ? "done" : "ok"; }
    if (cands.some((r) => r.startsWith(nb))) { this.buf = nb; this.typed += ch; return "ok"; }
    return "ng";
  }

  // 表示用: これまでの入力 + 残りの正規ローマ字
  display() {
    let remain = "";
    // 現在チャンクの残り
    const curCands = this._cands();
    if (curCands.length) {
      const pick = curCands.find((r) => r.startsWith(this.buf)) || curCands[0];
      remain += pick.slice(this.buf.length);
    }
    // 以降のチャンク
    for (let i = this.ci + 1; i < this.chunks.length; i++) {
      const ch = this.chunks[i];
      if (ch.hatsuon) {
        const nx = this.chunks[i + 1];
        remain += (nx && !nx.hatsuon && !nx.sokuon && !"aiueony".includes(nx.cands ? nx.cands[0][0] : "n")) ? "n" : "nn";
      } else if (ch.sokuon) {
        const nx = this.chunks[i + 1];
        const head = nx && nx.cands ? nx.cands[0][0] : "t";
        remain += VOWELS.includes(head) ? "xtu" : head;
      } else {
        remain += ch.cands[0];
      }
    }
    return { typed: this.typed, remain };
  }

  // 次に打てる文字の集合(キーボードハイライト用)
  nextKeys() {
    const keys = new Set();
    const cur = this.chunks[this.ci];
    if (!cur) return keys;
    if (cur.sokuon) {
      if (this.buf === "") {
        this._nextHeads().forEach((h) => { if (!VOWELS.includes(h) && h !== "n") keys.add(h); });
        keys.add("l"); keys.add("x");
      } else {
        SOKUON_STANDALONE.filter((r) => r.startsWith(this.buf)).forEach((r) => keys.add(r[this.buf.length]));
      }
      return keys;
    }
    if (cur.hatsuon) {
      if (this.buf === "") { keys.add("n"); keys.add("x"); }
      else if (this.buf === "n") {
        keys.add("n");
        const nx = this.chunks[this.ci + 1];
        if (nx && nx.cands) nx.cands.forEach((r) => { if (!"aiueony".includes(r[0])) keys.add(r[0]); });
      } else if (this.buf === "x") keys.add("n");
      return keys;
    }
    this._cands().forEach((r) => { if (r.startsWith(this.buf) && r.length > this.buf.length) keys.add(r[this.buf.length]); });
    return keys;
  }
}

// 単語全体の正規ローマ字(統計の分母用)
function canonicalRomaji(kana) {
  return new Typer(kana).display().remain;
}
