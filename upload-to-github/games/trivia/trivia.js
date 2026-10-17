// Trivia Pursuit: a category wheel picks the category, the turn team answers (members vote, the captain decides),
// a right answer wins that category's wedge; if they miss, the other teams can steal for points.
// First team to collect the target number of wedges wins.
const fs = require('fs');
const path = require('path');

const CATS = ['geo', 'hist', 'sci', 'arts', 'sport', 'fun'];
const TEAM_KINDS = [
  { key: 'lions', emoji: '🦁', color: '#f59e0b' }, { key: 'dolphins', emoji: '🐬', color: '#0ea5e9' },
  { key: 'unicorns', emoji: '🦄', color: '#ec4899' }, { key: 'owls', emoji: '🦉', color: '#8b5cf6' },
  { key: 'turtles', emoji: '🐢', color: '#22c55e' }, { key: 'foxes', emoji: '🦊', color: '#f97316' },
];
const SOLO_COLORS = ['#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6', '#22c55e', '#f97316', '#ef4444', '#14b8a6', '#6366f1', '#84cc16', '#d946ef', '#06b6d4'];
const MAX_PLAYERS = 40;
const MS = { spin: 4200, choose: 15000, steal: 15000, reveal: 9000 };
const PTS = { correct: 10, steal: 5 };

// ---------- question bank ----------
let BANK = null;
function loadBank(dir = path.join(__dirname, 'questions')) {
  const bank = {};
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const m = f.match(/^(greece|world)-(kids|adults)-[a-z]\.json$/);
    if (!m) continue;
    const list = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    list.forEach((q, i) => {
      if (!CATS.includes(q.cat) || !q.q || !Array.isArray(q.a) || q.a.length !== 4) return;
      const key = `${m[1]}-${m[2]}-${q.cat}`;
      (bank[key] = bank[key] || []).push({ ...q, id: `${f}#${i}` });
    });
  }
  return bank;
}
// questions asked recently on this server (id -> time), so new games avoid them
const RECENT = new Map();
function bank() { if (!BANK) BANK = loadBank(); return BANK; }

class Trivia {
  constructor(code, onChange = () => {}, { rng = Math.random, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout, questions = null } = {}) {
    Object.assign(this, { code, onChange, rng, now, schedule, cancel });
    this.bank = questions || bank();
    this.phase = 'lobby'; // lobby | spin | choose | question | steal | reveal | final
    this.players = [];
    this.teams = [];
    this.settings = { audience: 'greece', level: 'kids', mode: 'teams', teamCount: 2, wedges: 6, timer: 30, steal: true, decide: 'captain', lang: 'en' };
    this.events = []; this.evSeq = 0;
    this.used = new Set();
    this.seen = new Map(); // id -> time, sent by the big screen from earlier games
    this.history = [];
    this.timer = null; this.phaseEnds = 0; this.paused = null;
    this.voteSeq = 0;
  }

  P(id) { return this.players.find((p) => p.id === id); }
  T(id) { return this.teams.find((t) => t.id === id); }
  teamOf(pid) { return this.teams.find((t) => t.members.includes(pid)); }
  get turnTeam() { return this.teams[this.turn]; }
  event(k, p = {}) { this.events.push({ k, p, id: ++this.evSeq }); if (this.events.length > 20) this.events.shift(); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- players & teams ----------
  join(id, name, avatar) {
    if (this.players.length >= MAX_PLAYERS) return 'err.full';
    name = String(name || '').trim().slice(0, 14);
    if (!name) return 'err.name';
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'err.nameTaken';
    const p = { id, name, avatar: String(avatar || '⭐').slice(0, 8), connected: true };
    this.players.push(p);
    if (this.phase !== 'lobby' && this.phase !== 'final') this.placeLate(p);
    return null;
  }

  // Late arrivals: their own team in solo mode, otherwise the smallest team.
  placeLate(p) {
    if (this.settings.mode === 'solo') this.teams.push(this.makeTeam(this.teams.length, [p.id], p));
    else {
      const t = this.teams.slice().sort((a, b) => a.members.length - b.members.length)[0];
      t.members.push(p.id);
      if (!t.captain) t.captain = p.id;
    }
  }

  makeTeam(i, members, soloPlayer = null) {
    const kind = TEAM_KINDS[i % TEAM_KINDS.length];
    return {
      id: 't' + i + '-' + Math.floor(this.rng() * 1e6),
      key: soloPlayer ? null : kind.key, emoji: soloPlayer ? soloPlayer.avatar : kind.emoji,
      color: soloPlayer ? SOLO_COLORS[i % SOLO_COLORS.length] : kind.color,
      name: soloPlayer ? soloPlayer.name : null, solo: !!soloPlayer,
      members, captain: members[0] || null, capIdx: -1, wedges: [], points: 0, votes: {}, voteAt: {}, final: null,
      // how this team settles its answer: 'captain' (rotating captain decides) or 'vote' (most votes wins)
      style: this.settings.decide === 'vote' ? 'vote' : 'captain',
    };
  }

  makeTeams() {
    const ids = this.shuffle(this.players.map((p) => p.id));
    if (this.settings.mode === 'solo') {
      this.teams = ids.map((id, i) => this.makeTeam(i, [id], this.P(id)));
    } else {
      const n = Math.max(1, Math.min(this.settings.teamCount, ids.length));
      this.teams = Array.from({ length: n }, (_, i) => this.makeTeam(i, []));
      ids.forEach((id, i) => this.teams[i % n].members.push(id));
      for (const t of this.teams) t.captain = t.members[0];
    }
  }

  removePlayer(id) {
    this.players = this.players.filter((p) => p.id !== id);
    for (const t of this.teams) {
      t.members = t.members.filter((m) => m !== id);
      if (t.captain === id) t.captain = t.members[0] || null;
      if (t.votes) delete t.votes[id];
    }
    // an empty team leaves the game (keeping the turn pointer sensible)
    const empty = this.teams.findIndex((t) => !t.members.length);
    if (empty >= 0 && this.phase !== 'lobby') {
      const wasTurn = empty === this.turn;
      this.teams.splice(empty, 1);
      if (!this.teams.length) { this.finish(); return; }
      if (empty < this.turn) this.turn--;
      this.turn %= this.teams.length;
      if (wasTurn && this.phase !== 'final') this.nextTurn(true);
    } else if (empty >= 0) this.teams.splice(empty, 1);
  }

  setSettings(s = {}) {
    const st = this.settings;
    if (s.lang === 'el' || s.lang === 'en') st.lang = s.lang; // language can change any time
    if (this.phase !== 'lobby' && this.phase !== 'final') return null;
    if (s.audience === 'greece' || s.audience === 'world') st.audience = s.audience;
    if (s.level === 'kids' || s.level === 'adults') st.level = s.level;
    if (s.mode === 'solo' || s.mode === 'teams') st.mode = s.mode;
    if ([2, 3, 4, 5, 6].includes(Number(s.teamCount))) st.teamCount = Number(s.teamCount);
    if ([3, 4, 6].includes(Number(s.wedges))) st.wedges = Number(s.wedges);
    if ([20, 30, 45].includes(Number(s.timer))) st.timer = Number(s.timer);
    if (typeof s.steal === 'boolean') st.steal = s.steal;
    if (['captain', 'vote', 'team'].includes(s.decide)) st.decide = s.decide;
    return null;
  }

  // ---------- flow ----------
  setPhase(phase, ms, next) {
    this.cancel(this.timer);
    this.phase = phase;
    this.paused = null;
    this.phaseEnds = ms ? this.now() + ms : 0;
    this.phaseNext = next || null;
    this.timer = ms ? this.schedule(() => { this.timer = null; next(); this.onChange(); }, ms) : null;
  }

  start() {
    if (this.phase !== 'lobby' && this.phase !== 'final') return 'err.running';
    if (!this.players.length) return 'err.noPlayers';
    this.makeTeams();
    this.used = new Set(); this.history = []; this.events = [];
    this.turn = Math.floor(this.rng() * this.teams.length);
    this.event('start');
    this.beginTurn();
    return null;
  }

  setSeen(list) {
    this.seen = new Map();
    if (Array.isArray(list)) list.slice(-5000).forEach((x, i) => { if (Array.isArray(x) && typeof x[0] === 'string') this.seen.set(x[0], Number(x[1]) || i); });
  }

  missing(team) { return CATS.filter((c) => !team.wedges.includes(c)); }

  beginTurn() {
    const team = this.turnTeam;
    // rotate the captain among connected members
    const here = team.members.filter((m) => { const p = this.P(m); return p && p.connected; });
    const pool = here.length ? here : team.members;
    team.capIdx = (team.capIdx + 1) % pool.length;
    team.captain = pool[team.capIdx] || team.members[0];
    for (const t of this.teams) { t.votes = {}; t.voteAt = {}; t.final = null; }
    this.turnPick = null; this.stealers = []; this.result = null; this.question = null;
    // the wheel can land on any colour (one you already have still scores points); a free spin lets you pick a missing one
    const miss = this.missing(team);
    const cats = miss.length ? miss : CATS;
    const free = this.rng() < 1 / 7;
    this.spin = { result: free ? 'free' : CATS[Math.floor(this.rng() * CATS.length)], seq: (this.spin ? this.spin.seq : 0) + 1 };
    this.setPhase('spin', MS.spin, () => (free ? this.setPhase('choose', MS.choose, () => this.choose(team.captain, cats[Math.floor(this.rng() * cats.length)], true)) : this.ask(this.spin.result)));
  }

  choose(pid, cat, auto = false) {
    if (this.phase !== 'choose') return 'err.notNow';
    const team = this.turnTeam;
    // with a captain only the captain picks; in a voting team anyone in the team may pick
    if (!auto && (team.style === 'captain' ? team.captain !== pid : !team.members.includes(pid))) return 'err.captainOnly';
    if (!CATS.includes(cat)) return 'err.notNow';
    this.ask(cat);
    return null;
  }

  pickQuestion(cat) {
    const key = `${this.settings.audience}-${this.settings.level}-${cat}`;
    let list = this.bank[key] || [];
    if (!list.length) list = Object.entries(this.bank).filter(([k]) => k.endsWith('-' + cat)).flatMap(([, v]) => v);
    let fresh = list.filter((q) => !this.used.has(q.id));
    if (!fresh.length) { for (const q of list) this.used.delete(q.id); fresh = list; } // ran out: allow repeats
    // prefer questions not asked in earlier games (this big screen's history + this server's memory)
    const never = fresh.filter((q) => !this.seen.has(q.id) && !RECENT.has(q.id));
    if (never.length) return never[Math.floor(this.rng() * never.length)];
    const last = (q) => Math.max(this.seen.has(q.id) ? this.seen.get(q.id) : -1, RECENT.has(q.id) ? RECENT.get(q.id) : -1);
    const oldest = [...fresh].sort((x, y) => last(x) - last(y)).slice(0, Math.max(1, Math.ceil(fresh.length / 4)));
    return oldest[Math.floor(this.rng() * oldest.length)];
  }

  ask(cat) {
    const q = this.pickQuestion(cat);
    if (!q) { this.event('noQuestions'); this.nextTurn(); return; }
    this.used.add(q.id);
    RECENT.delete(q.id); RECENT.set(q.id, Date.now());
    if (RECENT.size > 5000) RECENT.delete(RECENT.keys().next().value);
    const order = this.shuffle([0, 1, 2, 3]);
    this.question = { id: q.id, cat, q: q.q, a: order.map((i) => q.a[i]), correct: order.indexOf(0), fact: q.fact };
    for (const t of this.teams) { t.votes = {}; t.voteAt = {}; t.final = null; }
    this.setPhase('question', this.settings.timer * 1000, () => this.lockTurn());
  }

  // ---------- answering ----------
  // Team members vote. Captain teams: the captain's "final answer" counts (on timeout: the captain's vote, else the most votes).
  // Voting teams: the answer locks once everyone here has voted, and the most votes wins (a tie goes to the answer that got there first).
  vote(pid, idx) {
    const t = this.teamOf(pid);
    idx = Number(idx);
    if (!t || !(idx >= 0 && idx < 4)) return 'err.notNow';
    if (!this.canAnswer(t)) return 'err.notYourTeam';
    if (t.final !== null) return 'err.locked';
    if (this.phase === 'steal' && idx === this.turnPick) return 'err.alreadyWrong';
    t.votes[pid] = idx;
    t.voteAt = t.voteAt || {};
    t.voteAt[pid] = ++this.voteSeq;
    if (t.members.length === 1) return this.finalAnswer(pid, idx); // solo: a tap is the answer
    if (t.style === 'vote') {
      const here = t.members.filter((m) => { const p = this.P(m); return p && p.connected; });
      if (here.length && here.every((m) => m in t.votes)) this.settle(t, this.teamChoice(t));
    }
    return null;
  }

  // Lock a team's answer and move the game on.
  settle(t, idx) {
    t.final = idx;
    if (this.phase === 'question') this.lockTurn();
    else if (this.stealers.every((id) => this.T(id).final !== null)) this.lockSteal();
  }

  // Each team chooses its style (when the host allowed it), between questions only.
  setStyle(pid, style, byHost = false) {
    const t = byHost ? this.T(pid) : this.teamOf(pid);
    if (!t || !['captain', 'vote'].includes(style) || t.solo) return 'err.notNow';
    if (!byHost && this.settings.decide !== 'team') return 'err.notNow';
    if (this.canAnswer(t) && t.final === null) return 'err.styleLocked';
    t.style = style;
    return null;
  }

  canAnswer(t) {
    if (this.phase === 'question') return t === this.turnTeam;
    if (this.phase === 'steal') return this.stealers.includes(t.id);
    return false;
  }

  finalAnswer(pid, idx) {
    const t = this.teamOf(pid);
    idx = Number(idx);
    if (!t || !this.canAnswer(t)) return 'err.notYourTeam';
    if (t.members.length > 1 && (t.style !== 'captain' || t.captain !== pid)) return 'err.captainOnly';
    if (t.final !== null) return 'err.locked';
    if (!(idx >= 0 && idx < 4)) return 'err.notNow';
    if (this.phase === 'steal' && idx === this.turnPick) return 'err.alreadyWrong';
    t.votes[pid] = idx;
    this.settle(t, idx);
    return null;
  }

  teamChoice(t) {
    if (t.final !== null) return t.final;
    if (t.style === 'captain' && t.captain in t.votes) return t.votes[t.captain];
    const tally = [0, 0, 0, 0];
    for (const v of Object.values(t.votes)) tally[v]++;
    const best = Math.max(...tally);
    if (!best) return null;
    // tie: the answer whose deciding vote came first
    const at = t.voteAt || {};
    const reached = (i) => Object.entries(t.votes).filter(([, v]) => v === i).map(([pid]) => at[pid] || 0).sort((a, b) => a - b)[best - 1];
    return [0, 1, 2, 3].filter((i) => tally[i] === best).sort((a, b) => reached(a) - reached(b))[0];
  }

  lockTurn() {
    const t = this.turnTeam, q = this.question;
    this.turnPick = this.teamChoice(t);
    t.final = this.turnPick;
    const right = this.turnPick === q.correct;
    this.result = { turnRight: right, wedge: false, stealRight: [] };
    if (right) this.award(t, q.cat);
    if (!right && this.settings.steal && this.teams.length > 1) {
      this.stealers = this.teams.filter((x) => x !== t).map((x) => x.id);
      for (const id of this.stealers) { const s = this.T(id); s.votes = {}; s.voteAt = {}; s.final = null; }
      this.setPhase('steal', MS.steal, () => this.lockSteal());
    } else this.reveal();
  }

  award(t, cat) {
    t.points += PTS.correct;
    if (!t.wedges.includes(cat)) { t.wedges.push(cat); this.result.wedge = cat; }
  }

  lockSteal() {
    const q = this.question;
    for (const id of this.stealers) {
      const s = this.T(id);
      if (!s) continue;
      const pick = this.teamChoice(s);
      s.final = pick;
      if (pick === q.correct) { s.points += PTS.steal; this.result.stealRight.push(s.id); }
    }
    this.reveal();
  }

  reveal() {
    const t = this.turnTeam, q = this.question;
    this.history.push({ cat: q.cat, q: q.q, answer: q.a[q.correct], team: t.id, right: this.result.turnRight });
    if (this.result.turnRight) this.event(this.result.wedge ? 'wedge' : 'right', { team: t.id, cat: q.cat });
    for (const id of this.result.stealRight) this.event('stole', { team: id });
    this.setPhase('reveal', MS.reveal, () => this.nextTurn());
  }

  winner() { return this.teams.find((t) => t.wedges.length >= this.settings.wedges); }

  nextTurn(keepTurn = false) {
    if (this.winner()) return this.finish();
    if (!keepTurn) this.turn = (this.turn + 1) % this.teams.length;
    this.beginTurn();
  }

  finish() {
    this.setPhase('final', 0);
    const top = this.ranking()[0];
    if (top) this.event('winner', { team: top.id });
    return null;
  }

  backToLobby() {
    this.setPhase('lobby', 0);
    this.teams = []; this.history = []; this.events = []; this.question = null;
  }

  dispose() { this.cancel(this.timer); }

  ranking() { return this.teams.slice().sort((a, b) => b.wedges.length - a.wedges.length || b.points - a.points); }

  // ---------- admin adjustments ----------
  admin(type, a = {}) {
    const t = a.teamId && this.T(a.teamId);
    switch (type) {
      case 'move': {
        const p = this.P(a.playerId);
        if (!p || !t || t.solo) return 'err.notNow';
        const from = this.teamOf(p.id);
        if (from === t) return null;
        if (from) { from.members = from.members.filter((m) => m !== p.id); if (from.captain === p.id) from.captain = from.members[0] || null; if (from.votes) delete from.votes[p.id]; }
        t.members.push(p.id);
        if (!t.captain) t.captain = p.id;
        if (from && !from.members.length) this.removeEmptyTeam(from);
        return null;
      }
      case 'reshuffle':
        if (this.phase === 'question' || this.phase === 'steal' || this.phase === 'choose') return 'err.waitTurnEnd';
        if (this.settings.mode === 'solo') return 'err.notNow';
        {
          const keep = this.teams.map((x) => ({ wedges: x.wedges, points: x.points, name: x.name }));
          const ids = this.shuffle(this.players.map((p) => p.id));
          this.teams.forEach((x) => { x.members = []; });
          ids.forEach((id, i) => this.teams[i % this.teams.length].members.push(id));
          this.teams.forEach((x, i) => { x.captain = x.members[0] || null; Object.assign(x, keep[i]); });
          this.teams = this.teams.filter((x) => x.members.length);
        }
        return null;
      case 'rename':
        if (!t) return 'err.notNow';
        t.name = String(a.name || '').trim().slice(0, 18) || null;
        return null;
      case 'style': return this.setStyle(a.teamId, a.style, true);
      case 'captain':
        if (!t || !t.members.includes(a.playerId)) return 'err.notNow';
        t.captain = a.playerId;
        return null;
      case 'points':
        if (!t) return 'err.notNow';
        t.points = Math.max(0, t.points + (Number(a.delta) || 0));
        return null;
      case 'wedge':
        if (!t || !CATS.includes(a.cat)) return 'err.notNow';
        if (t.wedges.includes(a.cat)) t.wedges = t.wedges.filter((c) => c !== a.cat);
        else t.wedges.push(a.cat);
        if (this.phase === 'reveal' && this.winner()) { /* the next turn ends the game */ }
        return null;
      case 'override': {
        // During the reveal: count the turn team's answer as right (or take it back)
        if (this.phase !== 'reveal' || !this.result) return 'err.notNow';
        const tt = this.turnTeam, cat = this.question.cat;
        if (!this.result.turnRight) {
          this.result.turnRight = true; this.result.overridden = true;
          this.award(tt, cat);
        } else {
          this.result.turnRight = false; this.result.overridden = true;
          tt.points = Math.max(0, tt.points - PTS.correct);
          if (this.result.wedge) { tt.wedges = tt.wedges.filter((c) => c !== this.result.wedge); this.result.wedge = false; }
        }
        this.history[this.history.length - 1].right = this.result.turnRight;
        return null;
      }
      case 'skip':
        if (this.phase === 'question') { this.ask(this.question.cat); return null; } // a different question, same category
        if (this.phase === 'spin' || this.phase === 'reveal') { this.cancel(this.timer); const n = this.phaseNext; if (n) n(); return null; }
        if (this.phase === 'choose') { const cats = this.missing(this.turnTeam); return this.choose(null, cats[0] || CATS[0], true); }
        if (this.phase === 'steal') { this.lockSteal(); return null; }
        return 'err.notNow';
      case 'extend':
        if (!this.phaseEnds || this.paused) return 'err.notNow';
        this.cancel(this.timer);
        this.phaseEnds += 15000;
        this.timer = this.schedule(() => { this.timer = null; this.phaseNext(); this.onChange(); }, this.phaseEnds - this.now());
        return null;
      case 'pause':
        if (this.paused) { // resume
          const left = this.paused;
          this.paused = null;
          this.phaseEnds = this.now() + left;
          this.timer = this.schedule(() => { this.timer = null; this.phaseNext(); this.onChange(); }, left);
          return null;
        }
        if (!this.phaseEnds) return 'err.notNow';
        this.cancel(this.timer); this.timer = null;
        this.paused = Math.max(1000, this.phaseEnds - this.now());
        return null;
      case 'end': return this.finish();
      default: return 'err.notNow';
    }
  }

  removeEmptyTeam(team) {
    const i = this.teams.indexOf(team);
    if (i < 0 || this.phase === 'lobby') return;
    this.teams.splice(i, 1);
    if (i < this.turn) this.turn--;
    this.turn %= Math.max(1, this.teams.length);
  }

  // ---------- views ----------
  view(forPlayerId = null) {
    const q = this.question;
    const showAnswer = this.phase === 'reveal' || this.phase === 'final';
    const v = {
      code: this.code, phase: this.phase, settings: this.settings, cats: CATS,
      remainingMs: this.paused || (this.phaseEnds ? Math.max(0, this.phaseEnds - this.now()) : 0), paused: !!this.paused,
      phaseMs: { spin: MS.spin, choose: MS.choose, question: this.settings.timer * 1000, steal: MS.steal, reveal: MS.reveal }[this.phase] || 0,
      players: this.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, connected: p.connected, team: (this.teamOf(p.id) || {}).id || null })),
      teams: this.teams.map((t) => ({
        id: t.id, key: t.key, emoji: t.emoji, color: t.color, name: t.name, solo: t.solo, members: t.members, captain: t.captain,
        style: t.style, wedges: t.wedges, points: t.points, answered: t.final !== null && t.final !== undefined, voters: t.votes ? Object.keys(t.votes).length : 0,
      })),
      turnTeam: this.turnTeam ? this.turnTeam.id : null,
      spin: this.spin || null,
      chooseCats: this.phase === 'choose' ? this.missing(this.turnTeam) : null,
      question: q && this.phase !== 'spin' && this.phase !== 'choose' ? { id: q.id, cat: q.cat, q: q.q, a: q.a, correct: showAnswer ? q.correct : undefined, fact: showAnswer ? q.fact : undefined } : null,
      turnPick: this.phase === 'steal' || showAnswer ? this.turnPick : null,
      stealers: this.phase === 'steal' ? this.stealers : [],
      result: showAnswer ? this.result : null,
      events: this.events.slice(-6),
      history: this.phase === 'final' ? this.history : null,
      ranking: this.phase === 'final' ? this.ranking().map((t) => t.id) : null,
    };
    const me = forPlayerId && this.P(forPlayerId);
    if (me) {
      const t = this.teamOf(me.id);
      const votes = {};
      if (t && t.votes) for (const [pid, idx] of Object.entries(t.votes)) (votes[idx] = votes[idx] || []).push(pid);
      v.me = {
        id: me.id, team: t ? t.id : null, captain: !!t && t.captain === me.id,
        canAnswer: !!t && this.canAnswer(t) && t.final === null,
        myVote: t && t.votes ? t.votes[me.id] ?? null : null,
        teamVotes: votes, teamFinal: t ? t.final ?? null : null,
      };
    }
    return v;
  }
}

module.exports = { Trivia, CATS, TEAM_KINDS, loadBank, PTS, MS };
