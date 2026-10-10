// Monster Battle: everyone answers maths questions at their own pace; each right answer hits the monster.
// The team beats as many monsters as it can before time runs out; whoever did the most damage wins.
const { buildQuiz } = require('../quiz/questions');

const ALL_TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const COLORS = ['#ff4f8b', '#4f7bff', '#ffb020', '#22c55e', '#a855f7', '#06b6d4', '#f97316', '#e11d48',
  '#84cc16', '#0ea5e9', '#d946ef', '#14b8a6', '#f59e0b', '#6366f1', '#ef4444', '#10b981'];
const MONSTERS = [
  { k: 'dragon', e: '🐉' }, { k: 'gobbler', e: '👾' }, { k: 'octo', e: '🐙' }, { k: 'rex', e: '🦖' },
  { k: 'troll', e: '🧌' }, { k: 'ghost', e: '👻' }, { k: 'kraken', e: '🦑' }, { k: 'mega', e: '🐲' },
];
const MAX_PLAYERS = 40;

class Battle {
  constructor(code, onChange = () => {}, { rng = Math.random, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
    Object.assign(this, { code, onChange, rng, now, schedule, cancel });
    this.phase = 'lobby'; // lobby | playing | final
    this.players = [];
    this.settings = { tables: ALL_TABLES.slice(), ops: { mul: true, div: true, missing: false, big: false }, mode: 'choices', minutes: 5, lang: 'en' };
    this.monster = null;
    this.defeated = [];
    this.hits = [];
    this.hitSeq = 0;
    this.endsAt = 0;
    this.timer = null;
  }

  P(id) { return this.players.find((p) => p.id === id); }

  join(id, name, avatar) {
    if (this.players.length >= MAX_PLAYERS) return 'err.full';
    name = String(name || '').trim().slice(0, 14);
    if (!name) return 'err.name';
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'err.nameTaken';
    const p = { id, name, avatar: String(avatar || '⭐').slice(0, 8), color: COLORS[this.players.length % COLORS.length], connected: true };
    this.reset(p);
    this.players.push(p);
    if (this.phase === 'playing') this.nextQuestion(p);
    return null;
  }

  reset(p) {
    Object.assign(p, { dmg: 0, hits: 0, finals: 0, streak: 0, best: 0, right: 0, tried: 0, wrong: [], q: null, last: null, recent: [] });
  }

  removePlayer(id) { this.players = this.players.filter((p) => p.id !== id); }

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
      lang: s.lang === 'el' || s.lang === 'en' ? s.lang : st.lang,
    };
    return null;
  }

  // Tougher monsters each time; health grows with the number of players so every group gets a fair fight.
  spawn(n) {
    const kids = Math.max(1, this.players.filter((p) => p.connected).length);
    const max = Math.round(100 * kids * Math.pow(1.35, n));
    const m = MONSTERS[n % MONSTERS.length];
    this.monster = { n, k: m.k, e: m.e, super: Math.floor(n / MONSTERS.length), hp: max, max };
  }

  start() {
    if (this.phase === 'playing') return 'err.running';
    if (!this.players.length) return 'err.noPlayers';
    for (const p of this.players) { this.reset(p); this.nextQuestion(p); }
    this.defeated = []; this.hits = [];
    this.phase = 'playing';
    this.spawn(0);
    this.endsAt = this.now() + this.settings.minutes * 60000;
    this.cancel(this.timer);
    this.timer = this.schedule(() => { this.finish(); this.onChange(); }, this.settings.minutes * 60000);
    return null;
  }

  finish() {
    this.cancel(this.timer);
    this.timer = null;
    if (this.phase !== 'playing') return null;
    this.phase = 'final';
    for (const p of this.players) p.q = null;
    return null;
  }

  backToLobby() {
    this.cancel(this.timer);
    this.phase = 'lobby';
    this.monster = null; this.defeated = []; this.hits = [];
    for (const p of this.players) this.reset(p);
  }

  dispose() { this.cancel(this.timer); }

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
    p.tried++;
    let dmg = 0, crit = false, fast = false, ko = null;
    if (correct) {
      p.right++; p.streak++; p.best = Math.max(p.best, p.streak);
      fast = this.now() - p.qAt < 4000;
      dmg = 10 + (fast ? 5 : 0) + (p.streak >= 3 ? 5 : 0);
      if (p.streak % 5 === 0) { dmg *= 2; crit = true; }
      p.dmg += dmg; p.hits++;
      const m = this.monster;
      m.hp -= dmg;
      this.hits.push({ id: ++this.hitSeq, who: p.id, avatar: p.avatar, dmg, crit });
      if (this.hits.length > 20) this.hits.shift();
      if (m.hp <= 0) {
        p.finals++;
        ko = { k: m.k, e: m.e, super: m.super };
        this.defeated.push({ k: m.k, e: m.e, super: m.super, by: `${p.avatar} ${p.name}` });
        this.spawn(m.n + 1);
      }
    } else {
      p.streak = 0;
      p.wrong.push({ text: q.text, answer: q.answer, mine: Number(value) });
    }
    p.last = { text: q.text, answer: q.answer, mine: Number(value), correct, dmg, crit, fast, ko, streak: p.streak, seq: (p.last ? p.last.seq : 0) + 1 };
    this.nextQuestion(p);
    return { ok: true };
  }

  ranking() {
    return this.players.slice().sort((a, b) => b.dmg - a.dmg || b.right - a.right || a.name.localeCompare(b.name));
  }

  view(forPlayerId = null) {
    const ranked = this.ranking();
    const v = {
      code: this.code, phase: this.phase, settings: this.settings,
      remainingMs: this.phase === 'playing' ? Math.max(0, this.endsAt - this.now()) : 0,
      monster: this.monster, defeated: this.defeated, hits: this.hits.slice(-12),
      teamDmg: this.players.reduce((s, p) => s + p.dmg, 0),
      players: ranked.map((p, i) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, connected: p.connected, rank: i + 1, dmg: p.dmg, finals: p.finals, streak: p.streak })),
    };
    const me = forPlayerId && this.P(forPlayerId);
    if (me) {
      v.me = {
        id: me.id, dmg: me.dmg, finals: me.finals, streak: me.streak, best: me.best, right: me.right, tried: me.tried,
        rank: ranked.indexOf(me) + 1,
        q: me.q ? { text: me.q.text, choices: this.settings.mode === 'choices' ? me.q.choices : null, seq: me.tried } : null,
        last: me.last,
        wrong: this.phase === 'final' ? me.wrong : null,
      };
    }
    return v;
  }
}

module.exports = { Battle, MONSTERS };
