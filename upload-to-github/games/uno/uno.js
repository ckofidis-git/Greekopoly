// UNO, following the official 2022 rules:
// 108 cards, 7 each; the first discard is re-flipped until it is a number card; match colour, number or symbol;
// draw one card (you may play it if it fits); Skip / Reverse (a Skip with 2 players) / Draw Two;
// Wild Draw Four only when you hold no card of the current colour, and it can be challenged;
// call UNO when you play your second-to-last card or draw 2 if caught before the next player acts.
// Default game: first player out wins. Optional classic scoring: rounds are scored and the first to 200/500 wins.

const COLORS = ['r', 'y', 'g', 'b'];
const PLAYER_COLORS = ['#ff4f8b', '#4f7bff', '#ffb020', '#22c55e', '#a855f7', '#06b6d4', '#f97316', '#e11d48', '#84cc16', '#0ea5e9'];
const MAX_PLAYERS = 10;

function newDeck() {
  const cards = [];
  let id = 0;
  for (const c of COLORS) {
    cards.push({ id: id++, c, v: '0' });
    for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'rev', 'd2']) {
      cards.push({ id: id++, c, v }, { id: id++, c, v });
    }
  }
  for (let i = 0; i < 4; i++) cards.push({ id: id++, c: 'w', v: 'wild' }, { id: id++, c: 'w', v: 'wd4' });
  return cards; // 108
}
const points = (card) => (card.c === 'w' ? 50 : /^\d$/.test(card.v) ? Number(card.v) : 20);
const isNumber = (card) => /^\d$/.test(card.v);

class Uno {
  constructor(code, onChange = () => {}, { rng = Math.random } = {}) {
    Object.assign(this, { code, onChange, rng });
    this.phase = 'lobby'; // lobby | playing | roundover | final
    this.players = [];
    this.settings = { target: 0, highlight: true, lang: 'en' }; // target 0 = one round
    this.events = []; this.evSeq = 0;
    this.round = 0; this.dealer = -1;
  }

  P(id) { return this.players.find((p) => p.id === id); }
  get cur() { return this.players[this.turn]; }
  get top() { return this.discard[this.discard.length - 1]; }
  event(k, p = {}) { this.events.push({ k, p, id: ++this.evSeq }); if (this.events.length > 25) this.events.shift(); }
  nm(p) { return `${p.avatar} ${p.name}`; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- lobby ----------
  join(id, name, avatar) {
    if (this.phase !== 'lobby') return 'err.started';
    if (this.players.length >= MAX_PLAYERS) return 'err.full';
    name = String(name || '').trim().slice(0, 14);
    if (!name) return 'err.name';
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'err.nameTaken';
    const used = new Set(this.players.map((p) => p.color));
    this.players.push({ id, name, avatar: String(avatar || '⭐').slice(0, 8), color: PLAYER_COLORS.find((c) => !used.has(c)) || '#888', hand: [], score: 0, saidUno: false, connected: true });
    return null;
  }

  removePlayer(id) {
    const i = this.players.findIndex((p) => p.id === id);
    if (i < 0) return;
    if (this.phase === 'lobby' || this.phase === 'final') { this.players.splice(i, 1); return; }
    // mid-game: their cards go to the bottom of the draw pile and play carries on
    const p = this.players[i];
    this.deck.unshift(...p.hand);
    const wasTurn = i === this.turn;
    this.players.splice(i, 1);
    if (this.pending && (this.pending.from === id || this.pending.target === id)) this.pending = null;
    if (this.unoPending === id) this.unoPending = null;
    if (this.players.length < 2) { this.endGame(this.players[0] || null); return; }
    const n = this.players.length;
    if (i < this.turn) this.turn--;
    else if (wasTurn && this.dir === -1) this.turn = i - 1; // the turn passes to the next player in the current direction
    this.turn = ((this.turn % n) + n) % n;
    if (this.dealer >= n) this.dealer = 0;
    if (wasTurn) this.drawnCard = null;
  }

  setSettings(s = {}) {
    if (this.phase === 'playing' || this.phase === 'roundover') {
      if (s.lang === 'el' || s.lang === 'en') this.settings.lang = s.lang; // language can change any time
      return null;
    }
    this.settings = {
      target: [0, 200, 500].includes(Number(s.target)) ? Number(s.target) : this.settings.target,
      highlight: typeof s.highlight === 'boolean' ? s.highlight : this.settings.highlight,
      lang: s.lang === 'el' || s.lang === 'en' ? s.lang : this.settings.lang,
    };
    return null;
  }

  // ---------- rounds ----------
  start() {
    if (this.phase === 'playing' || this.phase === 'roundover') return 'err.running';
    if (this.players.length < 2) return 'err.need2';
    for (const p of this.players) p.score = 0;
    this.round = 0;
    this.dealer = Math.floor(this.rng() * this.players.length);
    this.startRound();
    return null;
  }

  nextRound() {
    if (this.phase !== 'roundover') return 'err.notNow';
    this.dealer = (this.dealer + 1) % this.players.length;
    this.startRound();
    return null;
  }

  startRound() {
    this.round++;
    this.deck = this.shuffle(newDeck());
    this.discard = [];
    for (const p of this.players) { p.hand = this.deck.splice(0, 7); p.saidUno = false; }
    // 2022 rule: keep flipping until the first discard is a number card
    let first = this.deck.pop();
    while (!isNumber(first)) { this.deck.unshift(first); first = this.deck.pop(); }
    this.discard.push(first);
    this.color = first.c;
    this.dir = 1;
    this.turn = (this.dealer + 1) % this.players.length;
    this.drawnCard = null; this.pending = null; this.awaitColor = false; this.unoPending = null;
    this.lastResult = null;
    this.phase = 'playing';
    this.event('round', { n: this.round, who: this.nm(this.cur) });
  }

  next(steps = 1) {
    const n = this.players.length;
    this.turn = (((this.turn + this.dir * steps) % n) + n) % n;
    this.drawnCard = null;
  }

  drawCards(p, n) {
    const got = [];
    for (let i = 0; i < n; i++) {
      if (!this.deck.length) {
        // reshuffle everything except the top card into a new draw pile
        const top = this.discard.pop();
        this.deck = this.shuffle(this.discard);
        this.discard = [top];
        if (!this.deck.length) break;
        this.event('reshuffle');
      }
      const c = this.deck.pop();
      p.hand.push(c);
      got.push(c);
    }
    if (p.hand.length > 1) p.saidUno = false;
    return got;
  }

  playable(card) {
    if (card.c === 'w') return true;
    return card.c === this.color || card.v === this.top.v;
  }

  // The window to catch a missing "UNO" closes when the next player acts.
  closeUnoWindow(actor) {
    if (this.unoPending && this.unoPending !== actor.id) this.unoPending = null;
  }

  guard(p) {
    if (!p) return 'err.rejoin';
    if (this.phase !== 'playing') return 'err.notPlaying';
    if (p !== this.cur) return 'err.notYourTurn';
    if (this.pending) return 'err.respondFirst';
    if (this.awaitColor) return 'err.pickColor';
    return null;
  }

  // ---------- actions ----------
  play(pid, cardId, chosen) {
    const p = this.P(pid);
    const err = this.guard(p);
    if (err) return err;
    const card = p.hand.find((c) => c.id === Number(cardId));
    if (!card) return 'err.noCard';
    if (this.drawnCard !== null && card.id !== this.drawnCard) return 'err.onlyDrawn';
    if (!this.playable(card)) return 'err.cantPlay';
    if (card.c === 'w' && !COLORS.includes(chosen)) return 'err.pickColor';
    this.closeUnoWindow(p);
    // Wild Draw Four is only legal without a card of the current colour (only checked if challenged)
    const illegal = card.v === 'wd4' && p.hand.some((c) => c.id !== card.id && c.c === this.color);
    p.hand = p.hand.filter((c) => c !== card);
    this.discard.push(card);
    this.color = card.c === 'w' ? chosen : card.c;
    this.drawnCard = null;
    const who = this.nm(p);
    this.event('play', { who, card: { c: card.c, v: card.v }, color: this.color });

    if (p.hand.length === 1) {
      if (p.saidUno) this.event('uno', { who });
      else this.unoPending = p.id;
    }
    p.saidUno = false;

    const n = this.players.length;
    const nextIdx = (((this.turn + this.dir) % n) + n) % n;
    const nextP = this.players[nextIdx];
    if (p.hand.length === 0) {
      // effects of the last card still happen (they count for scoring)
      if (card.v === 'd2') this.drawCards(nextP, 2);
      if (card.v === 'wd4') this.drawCards(nextP, 4);
      this.unoPending = null;
      this.roundWon(p);
      return null;
    }
    switch (card.v) {
      case 'skip': this.event('skipped', { who: this.nm(nextP) }); this.next(2); break;
      case 'rev':
        this.dir *= -1;
        this.event('reversed');
        if (n === 2) this.next(2); else this.next(1);
        break;
      case 'd2':
        this.drawCards(nextP, 2);
        this.event('drew2', { who: this.nm(nextP) });
        this.next(2);
        break;
      case 'wd4':
        this.next(1);
        this.pending = { from: p.id, target: nextP.id, illegal };
        break;
      default: this.next(1);
    }
    return null;
  }

  draw(pid) {
    const p = this.P(pid);
    const err = this.guard(p);
    if (err) return err;
    if (this.drawnCard !== null) return 'err.alreadyDrew';
    this.closeUnoWindow(p);
    const [c] = this.drawCards(p, 1);
    this.event('drew', { who: this.nm(p) });
    if (c && this.playable(c)) this.drawnCard = c.id; // they may play it or keep it
    else this.next(1);
    return null;
  }

  keep(pid) {
    const p = this.P(pid);
    const err = this.guard(p);
    if (err) return err;
    if (this.drawnCard === null) return 'err.notNow';
    this.next(1);
    return null;
  }

  // The player hit by a Wild Draw Four accepts (draws 4) or challenges.
  respond(pid, challenge) {
    const p = this.P(pid);
    if (!p || this.phase !== 'playing') return 'err.notPlaying';
    const pd = this.pending;
    if (!pd || pd.target !== p.id) return 'err.notNow';
    this.closeUnoWindow(p);
    this.pending = null;
    const from = this.P(pd.from);
    if (!challenge) {
      this.drawCards(p, 4);
      this.event('drew4', { who: this.nm(p) });
      this.next(1);
    } else if (pd.illegal && from) {
      this.drawCards(from, 4);
      this.event('challengeWon', { who: this.nm(p), from: this.nm(from) });
      // play continues with the challenger
    } else {
      this.drawCards(p, 6);
      this.event('challengeLost', { who: this.nm(p) });
      this.next(1);
    }
    return null;
  }

  sayUno(pid) {
    const p = this.P(pid);
    if (!p || this.phase !== 'playing') return 'err.notPlaying';
    if (this.unoPending === p.id) { this.unoPending = null; this.event('uno', { who: this.nm(p) }); return null; }
    if (p.hand.length === 2 && p === this.cur) { p.saidUno = true; return null; }
    return 'err.notNow';
  }

  catchUno(pid) {
    const p = this.P(pid);
    if (!p || this.phase !== 'playing') return 'err.notPlaying';
    const target = this.unoPending && this.P(this.unoPending);
    if (!target || target === p) return 'err.nobodyToCatch';
    this.unoPending = null;
    this.drawCards(target, 2);
    this.event('caught', { who: this.nm(p), target: this.nm(target) });
    return null;
  }

  roundWon(p) {
    const gained = this.players.reduce((s, o) => s + o.hand.reduce((t, c) => t + points(c), 0), 0);
    p.score += gained;
    this.lastResult = {
      winner: p.id, gained,
      hands: this.players.map((o) => ({ id: o.id, cards: o.hand.map((c) => ({ c: c.c, v: c.v })), pts: o.hand.reduce((t, c) => t + points(c), 0) })),
    };
    this.event('out', { who: this.nm(p), n: gained });
    if (!this.settings.target || p.score >= this.settings.target) this.endGame(p);
    else this.phase = 'roundover';
  }

  endGame(winner) {
    this.phase = 'final';
    this.winner = winner ? winner.id : null;
    if (winner) this.event('winner', { who: this.nm(winner) });
  }

  // Host ends early: best score wins in scored games, otherwise the fewest cards in hand.
  endNow() {
    if (this.phase !== 'playing' && this.phase !== 'roundover') return 'err.notPlaying';
    this.pending = null; this.unoPending = null;
    const best = this.players.slice().sort((a, b) => (this.settings.target ? b.score - a.score : 0) || a.hand.length - b.hand.length)[0];
    this.endGame(best);
    return null;
  }

  backToLobby() {
    this.phase = 'lobby';
    this.round = 0; this.events = []; this.lastResult = null; this.winner = null;
    for (const p of this.players) { p.hand = []; p.score = 0; p.saidUno = false; }
  }

  dispose() {}

  // ---------- views ----------
  order() {
    // final standings: in classic scoring by score; in one-round games the winner first, then fewest cards
    return this.players.slice().sort((a, b) => (b.id === this.winner) - (a.id === this.winner) || b.score - a.score || a.hand.length - b.hand.length);
  }

  view(forPlayerId = null) {
    const inGame = this.phase === 'playing' || this.phase === 'roundover' || this.phase === 'final';
    const v = {
      code: this.code, phase: this.phase, settings: this.settings, round: this.round,
      top: inGame && this.discard ? { c: this.top.c, v: this.top.v } : null,
      color: this.color, dir: this.dir, deck: this.deck ? this.deck.length : 0,
      turn: inGame && this.cur ? this.cur.id : null,
      pending: this.pending ? { from: this.pending.from, target: this.pending.target } : null,
      unoPending: this.unoPending,
      players: this.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, connected: p.connected, count: p.hand.length, score: p.score })),
      events: this.events.slice(-8),
      result: this.lastResult, winner: this.winner || null,
      standings: this.phase === 'final' ? this.order().map((p) => p.id) : null,
    };
    const me = forPlayerId && this.P(forPlayerId);
    if (me) {
      const order = { r: 0, y: 1, g: 2, b: 3, w: 4 };
      const val = (c) => (isNumber(c) ? Number(c.v) : { skip: 10, rev: 11, d2: 12, wild: 13, wd4: 14 }[c.v]);
      const hand = me.hand.slice().sort((a, b) => order[a.c] - order[b.c] || val(a) - val(b));
      const myTurn = this.phase === 'playing' && this.cur === me && !this.pending;
      v.me = {
        id: me.id,
        hand: hand.map((c) => ({ id: c.id, c: c.c, v: c.v })),
        myTurn,
        playable: myTurn ? hand.filter((c) => (this.drawnCard === null || c.id === this.drawnCard) && this.playable(c)).map((c) => c.id) : [],
        // the help highlight leaves out a Wild Draw Four that would be illegal (you hold the current colour) — it can still be played as a bluff
        lit: myTurn ? hand.filter((c) => (this.drawnCard === null || c.id === this.drawnCard) && this.playable(c) && !(c.v === 'wd4' && me.hand.some((o) => o.c === this.color))).map((c) => c.id) : [],
        drawnCard: myTurn ? this.drawnCard : null,
        mustRespond: !!(this.pending && this.pending.target === me.id),
        canUno: this.phase === 'playing' && ((this.cur === me && me.hand.length === 2 && !me.saidUno) || this.unoPending === me.id),
        saidUno: me.saidUno,
        canCatch: !!(this.unoPending && this.unoPending !== me.id),
      };
    }
    return v;
  }
}

module.exports = { Uno, newDeck, points };
