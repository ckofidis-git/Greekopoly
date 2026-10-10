// Times Table Bingo: the big screen calls a question; children tap the answer on their own card.
// Right taps, lines and a full card score points; a wrong tap costs a little and locks you out of that call.

const ALL_TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const COLORS = ['#ff4f8b', '#4f7bff', '#ffb020', '#22c55e', '#a855f7', '#06b6d4', '#f97316', '#e11d48',
  '#84cc16', '#0ea5e9', '#d946ef', '#14b8a6', '#f59e0b', '#6366f1', '#ef4444', '#10b981'];
const MAX_PLAYERS = 40;
const REVEAL_MS = 2500;
const PTS = { mark: 10, fast: 5, wrong: 5, line: 50, firstLine: 50, full: 100 };

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const shuffle = (arr, rng) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Every way the chosen tables and question types can produce the answer v.
function questionsFor(v, tables, ops) {
  const out = [];
  for (const t of tables) {
    for (let n = 2; n <= 12; n++) {
      if (ops.mul && t * n === v) out.push(`${t} × ${n}`, `${n} × ${t}`);
    }
    if (v >= 2 && v <= 12) {
      if (ops.div) out.push(`${t * v} ÷ ${t}`);
      if (ops.missing) out.push(`□ × ${t} = ${t * v}`, `${t} × □ = ${t * v}`);
    }
  }
  return [...new Set(out)];
}

function answerPool(tables, ops) {
  const pool = new Set();
  for (const t of tables) for (let n = 2; n <= 12; n++) {
    if (ops.mul) pool.add(t * n);
    if (ops.div || ops.missing) pool.add(n);
  }
  return [...pool].sort((a, b) => a - b);
}

// Rows, columns and both diagonals of an n×n card.
function lines(n) {
  const L = [];
  for (let r = 0; r < n; r++) L.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) L.push(Array.from({ length: n }, (_, r) => r * n + c));
  L.push(Array.from({ length: n }, (_, i) => i * n + i));
  L.push(Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));
  return L;
}

class Bingo {
  constructor(code, onChange = () => {}, { rng = Math.random, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
    Object.assign(this, { code, onChange, rng, now, schedule, cancel });
    this.phase = 'lobby'; // lobby | call | reveal | final
    this.players = [];
    this.settings = { tables: ALL_TABLES.slice(), ops: { mul: true, div: true, missing: false }, calls: 25, secs: 12, lang: 'en' };
    this.calls = []; this.ci = -1; this.size = 4;
    this.events = []; this.evSeq = 0;
    this.firstLine = false; this.endAfter = false;
    this.phaseEnds = 0; this.timer = null;
  }

  P(id) { return this.players.find((p) => p.id === id); }
  get call() { return this.calls[this.ci]; }
  event(k, p = {}) { this.events.push({ k, p, id: ++this.evSeq }); if (this.events.length > 20) this.events.shift(); }

  join(id, name, avatar) {
    if (this.players.length >= MAX_PLAYERS) return 'err.full';
    name = String(name || '').trim().slice(0, 14);
    if (!name) return 'err.name';
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'err.nameTaken';
    const p = { id, name, avatar: String(avatar || '⭐').slice(0, 8), color: COLORS[this.players.length % COLORS.length], connected: true };
    this.reset(p);
    this.players.push(p);
    if (this.phase === 'call' || this.phase === 'reveal') this.deal(p); // late arrivals get a card straight away
    return null;
  }

  reset(p) { Object.assign(p, { card: [], marked: [], points: 0, lines: [], marks: 0, wrongTaps: 0, full: false, lockCall: -1, missed: [], last: null }); }
  removePlayer(id) { this.players = this.players.filter((p) => p.id !== id); }

  setSettings(s = {}) {
    if (this.phase === 'call' || this.phase === 'reveal') return 'err.settingsLocked';
    const st = this.settings;
    const tables = Array.isArray(s.tables) ? s.tables.map(Number).filter((t) => ALL_TABLES.includes(t)) : st.tables;
    const ops = { ...st.ops };
    for (const k of Object.keys(ops)) if (s.ops && k in s.ops) ops[k] = !!s.ops[k];
    if (!Object.values(ops).some(Boolean)) ops.mul = true;
    this.settings = {
      tables: tables.length ? [...new Set(tables)].sort((a, b) => a - b) : ALL_TABLES.slice(),
      ops,
      calls: [15, 25, 35].includes(Number(s.calls)) ? Number(s.calls) : st.calls,
      secs: [8, 12, 15].includes(Number(s.secs)) ? Number(s.secs) : st.secs,
      lang: s.lang === 'el' || s.lang === 'en' ? s.lang : st.lang,
    };
    return null;
  }

  deal(p) {
    const cells = this.size * this.size;
    p.card = shuffle(this.pool, this.rng).slice(0, cells);
    p.marked = p.card.map(() => false);
  }

  setPhase(phase, ms, next) {
    this.cancel(this.timer);
    this.phase = phase;
    this.phaseEnds = ms ? this.now() + ms : 0;
    this.timer = ms ? this.schedule(() => { this.timer = null; next(); this.onChange(); }, ms) : null;
  }

  start() {
    if (this.phase === 'call' || this.phase === 'reveal') return 'err.running';
    if (!this.players.length) return 'err.noPlayers';
    this.pool = answerPool(this.settings.tables, this.settings.ops);
    this.size = this.pool.length >= 24 ? 4 : 3; // very small pools get a 3×3 card
    for (const p of this.players) { this.reset(p); this.deal(p); }
    this.calls = []; this.ci = -1; this.events = [];
    this.firstLine = false; this.endAfter = false;
    this.nextCall();
    return null;
  }

  // Pick an answer that is on someone's card (favouring ones on many cards), not called recently.
  nextCall() {
    const used = new Set(this.calls.map((c) => c.answer));
    let options = this.pool.filter((v) => !used.has(v));
    if (!options.length) options = this.pool.slice();
    const weight = (v) => 1 + this.players.reduce((s, p) => s + (p.card.includes(v) && !p.marked[p.card.indexOf(v)] ? 3 : 0), 0);
    const total = options.reduce((s, v) => s + weight(v), 0);
    let r = this.rng() * total, v = options[0];
    for (const o of options) { r -= weight(o); if (r <= 0) { v = o; break; } }
    const text = pick(questionsFor(v, this.settings.tables, this.settings.ops), this.rng);
    this.calls.push({ text, answer: v });
    this.ci = this.calls.length - 1;
    this.calledAt = this.now();
    for (const p of this.players) p.last = null;
    this.setPhase('call', this.settings.secs * 1000, () => this.reveal());
  }

  reveal() {
    const c = this.call;
    for (const p of this.players) {
      const i = p.card.indexOf(c.answer);
      if (i >= 0 && !p.marked[i]) p.missed.push({ text: c.text, answer: c.answer });
    }
    const done = this.endAfter || this.ci >= this.settings.calls - 1;
    this.setPhase('reveal', REVEAL_MS, () => (done ? this.finish() : this.nextCall()));
  }

  skip() {
    if (this.phase === 'call') { this.cancel(this.timer); this.reveal(); return null; }
    if (this.phase === 'reveal') { this.cancel(this.timer); (this.endAfter || this.ci >= this.settings.calls - 1) ? this.finish() : this.nextCall(); return null; }
    return 'err.notPlaying';
  }

  finish() {
    if (this.phase === 'call') this.reveal();
    this.setPhase('final', 0);
    const top = this.ranking()[0];
    if (top) this.event('winner', { who: `${top.avatar} ${top.name}` });
    return null;
  }

  backToLobby() {
    this.setPhase('lobby', 0);
    this.calls = []; this.ci = -1; this.events = [];
    for (const p of this.players) this.reset(p);
  }

  dispose() { this.cancel(this.timer); }

  mark(pid, cell) {
    const p = this.P(pid);
    if (!p) return { error: 'err.rejoin' };
    if (this.phase !== 'call') return { error: 'err.notCalling' };
    cell = Number(cell);
    if (!(cell >= 0 && cell < p.card.length)) return { error: 'err.cell' };
    if (p.marked[cell]) return { error: 'err.already' };
    if (p.lockCall === this.ci) return { error: 'err.locked' };
    const c = this.call;
    if (p.card[cell] !== c.answer) {
      p.lockCall = this.ci;
      p.wrongTaps++;
      const lost = Math.min(PTS.wrong, p.points);
      p.points -= lost;
      p.last = { ok: false, lost, value: p.card[cell] };
      return { ok: true };
    }
    p.marked[cell] = true;
    p.marks++;
    p.lockCall = this.ci; // one square per call
    const fast = this.now() - this.calledAt < 3000;
    let gained = PTS.mark + (fast ? PTS.fast : 0);
    const newLines = [];
    lines(this.size).forEach((L, li) => {
      if (!p.lines.includes(li) && L.every((i) => p.marked[i])) { p.lines.push(li); newLines.push(li); }
    });
    const who = `${p.avatar} ${p.name}`;
    let first = false;
    for (const li of newLines) {
      gained += PTS.line;
      if (!this.firstLine) { this.firstLine = true; first = true; gained += PTS.firstLine; this.event('firstBingo', { who }); }
      else this.event('line', { who });
    }
    let full = false;
    if (!p.full && p.marked.every(Boolean)) { p.full = true; full = true; gained += PTS.full; this.event('full', { who }); this.endAfter = true; }
    p.points += gained;
    p.last = { ok: true, gained, fast, lines: newLines.length, first, full };
    return { ok: true };
  }

  ranking() {
    return this.players.slice().sort((a, b) => b.points - a.points || b.marks - a.marks || a.name.localeCompare(b.name));
  }

  view(forPlayerId = null) {
    const showAnswer = this.phase === 'reveal' || this.phase === 'final';
    const ranked = this.ranking();
    const c = this.call;
    const v = {
      code: this.code, phase: this.phase, settings: this.settings, size: this.size,
      ci: this.ci, total: this.settings.calls,
      remainingMs: this.phaseEnds ? Math.max(0, this.phaseEnds - this.now()) : 0,
      callMs: this.settings.secs * 1000,
      call: c && this.phase !== 'lobby' ? { text: c.text, answer: showAnswer ? c.answer : undefined } : null,
      history: this.calls.slice(0, showAnswer ? this.ci + 1 : this.ci).map((h) => ({ text: h.text, answer: h.answer })),
      events: this.events.slice(-6),
      players: ranked.map((p, i) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, connected: p.connected, rank: i + 1, points: p.points, lines: p.lines.length, marks: p.marks, full: p.full })),
    };
    const me = forPlayerId && this.P(forPlayerId);
    if (me) {
      v.me = {
        id: me.id, card: me.card, marked: me.marked, points: me.points, rank: ranked.indexOf(me) + 1,
        lines: me.lines.map((li) => lines(this.size)[li]), locked: me.lockCall === this.ci, last: me.last,
        marks: me.marks, wrongTaps: me.wrongTaps, full: me.full,
        missed: this.phase === 'final' ? me.missed : null,
      };
    }
    return v;
  }
}

module.exports = { Bingo, PTS, questionsFor, answerPool, lines };
