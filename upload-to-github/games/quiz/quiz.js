// Quiz show engine. The server owns the clock; phones and the big screen only display.
const { buildQuiz } = require('./questions');

const ALL_TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const COUNTDOWN_MS = 3500, REVEAL_MS = 4500, BOARD_MS = 5000;
const MAX_PLAYERS = 40;

class Quiz {
  constructor(code, onChange = () => {}, { rng = Math.random, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
    Object.assign(this, { code, onChange, rng, now, schedule, cancel });
    this.phase = 'lobby'; // lobby | countdown | question | reveal | board | final
    this.players = [];
    this.settings = { tables: ALL_TABLES.slice(), ops: { mul: true, div: true, missing: false, big: false }, count: 10, time: 20, mode: 'choices', lang: 'en' };
    this.questions = [];
    this.qi = -1;
    this.phaseEnds = 0;
    this.timer = null;
  }

  P(id) { return this.players.find((p) => p.id === id); }
  get q() { return this.questions[this.qi]; }

  // ---------- lobby ----------
  join(id, name, avatar) {
    if (this.players.length >= MAX_PLAYERS) return 'err.full';
    name = String(name || '').trim().slice(0, 14);
    if (!name) return 'err.name';
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'err.nameTaken';
    this.players.push({ id, name, avatar: String(avatar || '⭐').slice(0, 8), score: 0, streak: 0, best: 0, answers: [], connected: true, lastPoints: 0 });
    return null;
  }

  removePlayer(id) {
    this.players = this.players.filter((p) => p.id !== id);
    this.maybeEndQuestion();
  }

  setSettings(s = {}) {
    if (this.phase !== 'lobby' && this.phase !== 'final') return 'err.settingsLocked';
    const tables = Array.isArray(s.tables) ? s.tables.map(Number).filter((t) => ALL_TABLES.includes(t)) : this.settings.tables;
    const ops = { ...this.settings.ops };
    for (const k of Object.keys(ops)) if (s.ops && k in s.ops) ops[k] = !!s.ops[k];
    if (!Object.values(ops).some(Boolean)) ops.mul = true;
    this.settings = {
      tables: tables.length ? [...new Set(tables)].sort((a, b) => a - b) : ALL_TABLES.slice(),
      ops,
      count: [5, 10, 15, 20].includes(Number(s.count)) ? Number(s.count) : this.settings.count,
      time: [10, 15, 20, 30].includes(Number(s.time)) ? Number(s.time) : this.settings.time,
      mode: s.mode === 'type' || s.mode === 'choices' ? s.mode : this.settings.mode,
      lang: s.lang === 'el' || s.lang === 'en' ? s.lang : this.settings.lang,
    };
    return null;
  }

  // ---------- flow ----------
  setPhase(phase, ms, next) {
    this.cancel(this.timer);
    this.phase = phase;
    this.phaseEnds = ms ? this.now() + ms : 0;
    this.timer = ms ? this.schedule(() => { this.timer = null; next(); this.onChange(); }, ms) : null;
  }

  start() {
    if (this.phase !== 'lobby' && this.phase !== 'final') return 'err.running';
    if (!this.players.length) return 'err.noPlayers';
    this.questions = buildQuiz(this.settings, this.rng);
    for (const p of this.players) Object.assign(p, { score: 0, streak: 0, best: 0, answers: [], lastPoints: 0 });
    this.qi = 0;
    this.setPhase('countdown', COUNTDOWN_MS, () => this.ask());
    return null;
  }

  ask() {
    this.setPhase('question', this.settings.time * 1000 + 300, () => this.reveal());
    this.askedAt = this.now();
  }

  answer(pid, value) {
    const p = this.P(pid);
    if (!p) return 'err.rejoin';
    if (this.phase !== 'question') return 'err.late';
    if (p.answers[this.qi]) return 'err.answered';
    const ms = this.now() - this.askedAt;
    const correct = Number(value) === this.q.answer;
    const limit = this.settings.time * 1000;
    let points = 0, bonus = 0;
    if (correct) {
      points = Math.round(500 + 500 * Math.max(0, 1 - ms / limit)); // up to 1000 for an instant answer
      p.streak++;
      p.best = Math.max(p.best, p.streak);
      if (p.streak >= 3) bonus = 100;
    } else {
      p.streak = 0;
    }
    p.answers[this.qi] = { value: Number(value), correct, points: points + bonus, bonus, ms };
    p.score += points + bonus;
    this.maybeEndQuestion();
    return null;
  }

  // Everyone who is here has answered: no need to wait for the clock.
  maybeEndQuestion() {
    if (this.phase !== 'question') return;
    const here = this.players.filter((p) => p.connected);
    if (here.length && here.every((p) => p.answers[this.qi])) this.setPhase('question', 700, () => this.reveal());
  }

  reveal() {
    for (const p of this.players) {
      if (!p.answers[this.qi]) { p.answers[this.qi] = { value: null, correct: false, points: 0, bonus: 0, ms: null }; p.streak = 0; }
      p.lastPoints = p.answers[this.qi].points;
    }
    const last = this.qi >= this.questions.length - 1;
    this.setPhase('reveal', REVEAL_MS, () => (last ? this.finish() : this.board()));
  }

  board() {
    this.setPhase('board', BOARD_MS, () => { this.qi++; this.ask(); });
  }

  finish() {
    this.setPhase('final', 0);
  }

  // Host's "Next" button: jump to the end of the current step.
  skip() {
    if (!this.timer) return 'err.noSkip';
    this.cancel(this.timer);
    const steps = { countdown: () => this.ask(), question: () => this.reveal(), reveal: () => (this.qi >= this.questions.length - 1 ? this.finish() : this.board()), board: () => { this.qi++; this.ask(); } };
    steps[this.phase]();
    return null;
  }

  endNow() {
    if (this.phase === 'lobby' || this.phase === 'final') return null;
    if (this.phase === 'question') this.reveal();
    this.questions = this.questions.slice(0, this.qi + 1);
    this.finish();
    return null;
  }

  backToLobby() {
    this.setPhase('lobby', 0);
    this.qi = -1;
    this.questions = [];
    for (const p of this.players) Object.assign(p, { score: 0, streak: 0, best: 0, answers: [], lastPoints: 0 });
  }

  dispose() { this.cancel(this.timer); }

  // ---------- views ----------
  ranking() {
    const correct = (p) => p.answers.filter((a) => a && a.correct).length;
    return this.players.slice().sort((a, b) => b.score - a.score || correct(b) - correct(a) || a.name.localeCompare(b.name));
  }

  hardest() {
    return this.questions
      .map((q, i) => {
        const tried = this.players.filter((p) => p.answers[i]);
        const right = tried.filter((p) => p.answers[i].correct).length;
        return { text: q.text, answer: q.answer, right, tried: tried.length };
      })
      .filter((h) => h.tried && h.right < h.tried)
      .sort((a, b) => a.right / a.tried - b.right / b.tried)
      .slice(0, 5);
  }

  view(forPlayerId = null) {
    const showAnswer = ['reveal', 'board', 'final'].includes(this.phase);
    const q = this.q;
    const ranked = this.ranking();
    const v = {
      code: this.code, phase: this.phase, settings: this.settings,
      qi: this.qi, total: this.questions.length,
      remainingMs: this.phaseEnds ? Math.max(0, this.phaseEnds - this.now()) : 0,
      questionMs: this.settings.time * 1000,
      question: q && this.phase !== 'countdown' ? { text: q.text, choices: this.settings.mode === 'choices' ? q.choices : null, answer: showAnswer ? q.answer : undefined } : null,
      players: ranked.map((p, i) => ({
        id: p.id, name: p.name, avatar: p.avatar, score: p.score, streak: p.streak, rank: i + 1, connected: p.connected,
        answered: !!(q && p.answers[this.qi] && p.answers[this.qi].value !== null), lastPoints: showAnswer ? p.lastPoints : 0,
      })),
    };
    if (showAnswer && q && this.settings.mode === 'choices') {
      v.counts = q.choices.map((c) => this.players.filter((p) => p.answers[this.qi] && p.answers[this.qi].value === c).length);
    }
    if (showAnswer && q) v.rightCount = this.players.filter((p) => p.answers[this.qi] && p.answers[this.qi].correct).length;
    if (this.phase === 'final') v.hardest = this.hardest();
    const me = forPlayerId && this.P(forPlayerId);
    if (me) {
      const mine = me.answers[this.qi];
      v.me = {
        id: me.id, score: me.score, streak: me.streak, best: me.best,
        rank: ranked.indexOf(me) + 1,
        answered: !!mine && mine.value !== null,
        last: showAnswer && mine ? mine : null,
        correctCount: me.answers.filter((a) => a && a.correct).length,
        recap: this.phase === 'final'
          ? this.questions.map((qq, i) => ({ text: qq.text, answer: qq.answer, mine: me.answers[i] ? me.answers[i].value : null, correct: !!(me.answers[i] && me.answers[i].correct) }))
          : null,
      };
    }
    return v;
  }
}

module.exports = { Quiz, ALL_TABLES };
