// Treasure Island: answer maths questions to earn gold, spend gold to claim squares of a shared island.
// Everyone plays at their own pace; the server owns the clock, the map and the hidden surprises.
const { buildQuiz } = require('../quiz/questions');

const ALL_TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const COLORS = ['#ff4f8b', '#4f7bff', '#ffb020', '#22c55e', '#a855f7', '#06b6d4', '#f97316', '#e11d48',
  '#84cc16', '#0ea5e9', '#d946ef', '#14b8a6', '#f59e0b', '#6366f1', '#ef4444', '#10b981'];
const MAX_PLAYERS = COLORS.length;
const COST = { plain: 30, star: 60, steal: 60 };
const POINTS = { plain: 1, star: 3, gem: 3 };
const SHIELD_MS = 20000;
const DECO = ['🌴', '🌴', '🌴', '🌳', '🌼', '🪨', '🐚', '🦀', '', '', '', '', '', ''];

class Island {
  constructor(code, onChange = () => {}, { rng = Math.random, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
    Object.assign(this, { code, onChange, rng, now, schedule, cancel });
    this.phase = 'lobby'; // lobby | playing | final
    this.players = [];
    this.settings = { tables: ALL_TABLES.slice(), ops: { mul: true, div: true, missing: false, big: false }, mode: 'choices', minutes: 5, steal: true, lang: 'en' };
    this.tiles = [];
    this.W = 0; this.H = 0;
    this.events = [];
    this.evSeq = 0;
    this.endsAt = 0;
    this.timer = null;
  }

  P(id) { return this.players.find((p) => p.id === id); }
  event(k, p = {}) {
    this.events.push({ k, p, id: ++this.evSeq });
    if (this.events.length > 30) this.events.shift();
  }

  // ---------- lobby ----------
  join(id, name, avatar) {
    if (this.players.length >= MAX_PLAYERS) return 'err.full';
    name = String(name || '').trim().slice(0, 14);
    if (!name) return 'err.name';
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'err.nameTaken';
    const used = new Set(this.players.map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c)) || COLORS[this.players.length % COLORS.length];
    const p = { id, name, avatar: String(avatar || '⭐').slice(0, 8), color, connected: true };
    this.reset(p);
    this.players.push(p);
    if (this.phase === 'playing') this.nextQuestion(p); // late arrivals jump straight in
    return null;
  }

  reset(p) {
    Object.assign(p, { coins: 0, streak: 0, best: 0, right: 0, tried: 0, wrong: [], q: null, last: null, recent: [] });
  }

  removePlayer(id) {
    for (const t of this.tiles) if (t.owner === id) { t.owner = null; t.shieldUntil = 0; }
    this.players = this.players.filter((p) => p.id !== id);
  }

  setSettings(s = {}) {
    if (this.phase === 'playing') return 'err.settingsLocked';
    const st = this.settings;
    const tables = Array.isArray(s.tables) ? s.tables.map(Number).filter((t) => ALL_TABLES.includes(t)) : st.tables;
    const ops = { ...st.ops };
    for (const k of Object.keys(ops)) if (s.ops && k in s.ops) ops[k] = !!s.ops[k];
    if (!Object.values(ops).some(Boolean)) ops.mul = true;
    this.settings = {
      tables: tables.length ? [...new Set(tables)].sort((a, b) => a - b) : ALL_TABLES.slice(),
      ops,
      mode: s.mode === 'type' || s.mode === 'choices' ? s.mode : st.mode,
      minutes: [3, 5, 8].includes(Number(s.minutes)) ? Number(s.minutes) : st.minutes,
      steal: typeof s.steal === 'boolean' ? s.steal : st.steal,
      lang: s.lang === 'el' || s.lang === 'en' ? s.lang : st.lang,
    };
    return null;
  }

  // ---------- map ----------
  makeMap() {
    const big = this.players.length > 6;
    const W = big ? 20 : 16, H = big ? 12 : 10;
    const r = this.rng;
    // A blobby island: an ellipse with a wobbly coastline (a few random bumps).
    const bumps = Array.from({ length: 5 }, () => ({ a: r() * Math.PI * 2, f: 2 + Math.floor(r() * 4), s: 0.06 + r() * 0.08 }));
    const tiles = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5 - W / 2) / (W / 2 - 0.6), dy = (y + 0.5 - H / 2) / (H / 2 - 0.4);
        const ang = Math.atan2(dy, dx);
        const edge = 1 + bumps.reduce((s, b) => s + b.s * Math.sin(b.f * ang + b.a), 0);
        const land = Math.hypot(dx, dy) < edge * 0.95;
        tiles.push({ i: y * W + x, x, y, land, kind: 'plain', deco: land ? DECO[Math.floor(r() * DECO.length)] : '', owner: null, shieldUntil: 0, surprise: null, found: null });
      }
    }
    const land = tiles.filter((t) => t.land);
    const shuffled = land.slice().sort(() => r() - 0.5);
    const stars = Math.max(6, Math.round(land.length * 0.08));
    shuffled.slice(0, stars).forEach((t) => { t.kind = 'star'; t.deco = ''; });
    shuffled.slice(stars, stars + Math.round(land.length * 0.12)).forEach((t) => {
      t.surprise = r() < 0.6 ? { type: 'coins', n: [15, 20, 25, 40][Math.floor(r() * 4)] } : { type: 'gem' };
    });
    this.W = W; this.H = H; this.tiles = tiles;
  }

  points(t) { return t.kind === 'star' ? POINTS.star : t.kind === 'gem' ? POINTS.gem : POINTS.plain; }
  score(p) { return this.tiles.reduce((s, t) => s + (t.owner === p.id ? this.points(t) : 0), 0); }
  landCount(p) { return this.tiles.filter((t) => t.owner === p.id).length; }

  // ---------- flow ----------
  start() {
    if (this.phase === 'playing') return 'err.running';
    if (!this.players.length) return 'err.noPlayers';
    this.makeMap();
    this.events = [];
    for (const p of this.players) { this.reset(p); this.nextQuestion(p); }
    this.phase = 'playing';
    this.endsAt = this.now() + this.settings.minutes * 60000;
    this.cancel(this.timer);
    this.timer = this.schedule(() => { this.finish(); this.onChange(); }, this.settings.minutes * 60000);
    this.event('start');
    return null;
  }

  finish() {
    this.cancel(this.timer);
    this.timer = null;
    if (this.phase !== 'playing') return null;
    this.phase = 'final';
    for (const p of this.players) p.q = null;
    const top = this.ranking()[0];
    if (top) this.event('winner', { who: `${top.avatar} ${top.name}` });
    return null;
  }

  backToLobby() {
    this.cancel(this.timer);
    this.phase = 'lobby';
    this.tiles = []; this.events = [];
    for (const p of this.players) this.reset(p);
  }

  dispose() { this.cancel(this.timer); }

  // ---------- questions ----------
  nextQuestion(p) {
    let q;
    for (let tries = 0; tries < 6; tries++) {
      q = buildQuiz({ ...this.settings, count: 1 }, this.rng)[0];
      if (!p.recent.includes(q.text)) break;
    }
    p.recent = [...p.recent.slice(-5), q.text];
    p.q = q;
    p.qAt = this.now();
  }

  answer(pid, value) {
    const p = this.P(pid);
    if (!p) return { error: 'err.rejoin' };
    if (this.phase !== 'playing' || !p.q) return { error: 'err.notPlaying' };
    const q = p.q;
    const correct = Number(value) === q.answer;
    const fast = this.now() - p.qAt < 4000;
    let gained = 0;
    p.tried++;
    if (correct) {
      p.right++;
      p.streak++;
      p.best = Math.max(p.best, p.streak);
      gained = 10 + (fast ? 5 : 0) + (p.streak >= 3 ? 5 : 0);
      p.coins += gained;
    } else {
      p.streak = 0;
      p.wrong.push({ text: q.text, answer: q.answer, mine: Number(value) });
    }
    p.last = { text: q.text, answer: q.answer, mine: Number(value), correct, gained, fast, streak: p.streak, seq: (p.last ? p.last.seq : 0) + 1 };
    this.nextQuestion(p);
    return { ok: true };
  }

  // ---------- land ----------
  claim(pid, idx) {
    const p = this.P(pid);
    const t = this.tiles[Number(idx)];
    if (!p) return 'err.rejoin';
    if (this.phase !== 'playing') return 'err.notPlaying';
    if (!t || !t.land) return 'err.water';
    if (t.owner === p.id) return 'err.yours';
    const now = this.now();
    let cost;
    const prev = t.owner ? this.P(t.owner) : null;
    if (prev) {
      if (!this.settings.steal) return 'err.noSteal';
      if (now < t.shieldUntil) return 'err.shield';
      cost = COST.steal;
    } else cost = t.kind === 'plain' ? COST.plain : COST.star;
    if (p.coins < cost) return 'err.coins';
    p.coins -= cost;
    t.owner = p.id;
    t.shieldUntil = now + SHIELD_MS;
    const who = `${p.avatar} ${p.name}`;
    if (prev) this.event('steal', { who, from: `${prev.avatar} ${prev.name}` });
    else if (t.kind === 'star') this.event('star', { who });
    if (t.surprise) {
      const s = t.surprise;
      t.surprise = null;
      if (s.type === 'coins') { p.coins += s.n; t.found = 'coins'; this.event('coins', { who, n: s.n }); }
      else { t.kind = 'gem'; t.deco = ''; t.found = 'gem'; this.event('gem', { who }); }
      p.found = { type: s.type, n: s.n || 0, seq: (p.found ? p.found.seq : 0) + 1 };
    }
    return null;
  }

  // ---------- views ----------
  ranking() {
    return this.players.map((p) => ({ p, s: this.score(p), l: this.landCount(p) }))
      .sort((a, b) => b.s - a.s || b.l - a.l || b.p.coins - a.p.coins || a.p.name.localeCompare(b.p.name))
      .map((r) => r.p);
  }

  view(forPlayerId = null) {
    const now = this.now();
    const ranked = this.ranking();
    const v = {
      code: this.code, phase: this.phase, settings: this.settings, cost: COST, W: this.W, H: this.H,
      remainingMs: this.phase === 'playing' ? Math.max(0, this.endsAt - now) : 0,
      // Hidden surprises never leave the server.
      tiles: this.tiles.map((t) => ({ land: t.land, kind: t.kind, deco: t.deco, owner: t.owner, shield: t.owner && t.shieldUntil > now ? t.shieldUntil - now : 0, found: t.found })),
      players: ranked.map((p, i) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, connected: p.connected, rank: i + 1, score: this.score(p), land: this.landCount(p), coins: p.coins, streak: p.streak })),
      events: this.events.slice(-8),
    };
    const me = forPlayerId && this.P(forPlayerId);
    if (me) {
      v.me = {
        id: me.id, coins: me.coins, streak: me.streak, best: me.best, right: me.right, tried: me.tried,
        rank: ranked.indexOf(me) + 1, score: this.score(me), land: this.landCount(me),
        q: me.q ? { text: me.q.text, choices: this.settings.mode === 'choices' ? me.q.choices : null, seq: me.tried } : null,
        last: me.last, found: me.found || null,
        wrong: this.phase === 'final' ? me.wrong : null,
      };
    }
    return v;
  }
}

module.exports = { Island, COST, POINTS, SHIELD_MS, ALL_TABLES };
