// Game rules engine. All state lives here; clients only send intents.
const B = require('./shared/board');
const { makeT } = require('./shared/i18n');
const { SPACES, CHANCE, CHEST, TOKENS } = B;

const shuffle = (arr, rng) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const isProperty = (pos) => ['street', 'rail', 'util'].includes(SPACES[pos].type);
const groupOf = (g) => SPACES.map((s, i) => (s.group === g ? i : -1)).filter((i) => i >= 0);
const mortgageValue = (pos) => SPACES[pos].price / 2;
const unmortgageCost = (pos) => Math.ceil(mortgageValue(pos) * 1.1);
const interestOnly = (pos) => Math.ceil(mortgageValue(pos) * 0.1);

class Game {
  constructor(code, rng = Math.random) {
    this.rng = rng;
    this.code = code;
    this.phase = 'lobby'; // lobby | playing | over
    this.players = [];
    this.turn = 0;
    this.step = 'roll'; // roll | buy | auction | debt | endturn
    this.owners = {};
    this.houses = {};
    this.mortgaged = {};
    this.housesLeft = 32;
    this.hotelsLeft = 12;
    this.dice = [1, 1];
    this.diceSeq = 0;
    this.doublesCount = 0;
    this.canRollAgain = false;
    this.pendingBuy = null;
    this.auction = null;
    this.debts = [];
    this.trades = [];
    this.tradeSeq = 0;
    this.card = null;
    this.cardSeq = 0;
    this.pot = 0;
    this.settings = { jackpot: false, theme: 'greece', lang: 'en' };
    this.dress();
    this.log = [];
    this.ranking = null;
    this.decks = { chance: shuffle([...CHANCE.keys()], rng), chest: shuffle([...CHEST.keys()], rng) };
  }

  // ---------- helpers ----------
  P(id) { return this.players.find((p) => p.id === id); }
  get current() { return this.players[this.turn]; }
  active() { return this.players.filter((p) => !p.bankrupt); }
  say(msg) { this.log.push(msg); if (this.log.length > 60) this.log.shift(); }
  nm(p) { return `${p.emoji} ${p.name}`; }
  owns(pid) { return Object.keys(this.owners).filter((k) => this.owners[k] === pid).map(Number); }
  ownsGroup(pid, g) { return groupOf(g).every((i) => this.owners[i] === pid); }
  groupHasBuildings(g) { return groupOf(g).some((i) => (this.houses[i] || 0) > 0); }
  rand6() { return 1 + Math.floor(this.rng() * 6); }

  setTheme(id) {
    if (this.phase !== 'lobby' || !B.THEMES[id]) return;
    this.settings.theme = id;
    this.dress();
  }

  // Language can change at any time; new messages use the new language.
  setLang(lang) {
    if (lang !== 'en' && lang !== 'el') return;
    this.settings.lang = lang;
    this.dress();
  }

  dress() {
    const t = B.themed(this.settings.theme, this.settings.lang);
    this.T = t.T; this.S = t.SPACES; this.G = t.GROUPS; this.CH = t.CHANCE; this.CC = t.CHEST;
    this.tr = makeT(this.settings.lang);
  }

  t(key, p = {}) { return this.tr(key, { T: this.T, ...p }); }
  m(n) { return B.money(this.T, n); }

  // ---------- lobby ----------
  join(id, name, tokenId) {
    if (this.phase !== 'lobby') return this.t('err.started');
    if (this.players.length >= 8) return this.t('err.full');
    name = String(name || '').trim().slice(0, 14);
    if (!name) return this.t('err.name');
    const tok = TOKENS.find((t) => t.id === tokenId);
    if (!tok) return this.t('err.token');
    if (this.players.some((p) => p.token === tokenId)) return this.t('err.tokenTaken');
    this.players.push({
      id, name, token: tok.id, emoji: tok.emoji, color: tok.color,
      cash: B.START_CASH, pos: 0, inJail: false, jailTurns: 0, jailCards: [], bankrupt: false, connected: true,
    });
    this.say(this.t('log.joined', { who: `${tok.emoji} ${name}` }));
    return null;
  }

  start(settings = {}) {
    if (this.phase !== 'lobby') return this.t('err.alreadyStarted');
    if (this.players.length < 2) return this.t('err.need2');
    this.settings.jackpot = !!settings.jackpot;
    if (settings.theme) this.setTheme(settings.theme);
    if (settings.lang) this.setLang(settings.lang);
    this.players = shuffle(this.players, this.rng);
    this.phase = 'playing';
    this.turn = 0;
    this.say(this.t('log.begins', { who: this.nm(this.current) }));
    this.beginTurn();
    return null;
  }

  removePlayer(id) {
    const p = this.P(id);
    if (!p) return this.t('err.noPlayer');
    if (this.phase === 'lobby') {
      this.players = this.players.filter((x) => x !== p);
      return null;
    }
    if (p.bankrupt) return null;
    this.say(this.t('log.left', { who: this.nm(p) }));
    this.goBankrupt(p, null);
    this.settle();
    return null;
  }

  // ---------- turns ----------
  beginTurn() {
    this.step = 'roll';
    this.doublesCount = 0;
    this.canRollAgain = false;
    this.pendingBuy = null;
  }

  nextTurn() {
    if (this.phase !== 'playing') return;
    let n = this.turn;
    for (let k = 0; k < this.players.length; k++) {
      n = (n + 1) % this.players.length;
      if (!this.players[n].bankrupt) break;
    }
    this.turn = n;
    this.beginTurn();
    this.say(this.t('log.turn', { who: this.nm(this.current) }));
  }

  // Decide what the game is waiting for next.
  settle() {
    if (this.phase !== 'playing') return;
    const cur = this.current;
    if (this.debts.length) { this.step = 'debt'; return; }
    if (this.auction) { this.step = 'auction'; return; }
    if (cur.bankrupt) { this.nextTurn(); return; }
    if (this.pendingBuy !== null) { this.step = 'buy'; return; }
    this.step = this.canRollAgain && !cur.inJail ? 'roll' : 'endturn';
  }

  roll(p) {
    if (p !== this.current || this.step !== 'roll') return this.t('err.cantRoll');
    const d1 = this.rand6(), d2 = this.rand6();
    this.dice = [d1, d2];
    this.diceSeq++;
    const sum = d1 + d2, dbl = d1 === d2;
    this.say(this.t('log.rolled', { who: this.nm(p), d1, d2, dbl }));

    if (p.inJail) {
      if (dbl) {
        p.inJail = false; p.jailTurns = 0; this.canRollAgain = false;
        this.say(this.t('log.escapedDoubles', { who: this.nm(p) }));
        this.move(p, sum);
      } else {
        p.jailTurns++;
        if (p.jailTurns >= 3) {
          this.say(this.t('log.thirdTry', { who: this.nm(p), m: this.m(B.JAIL_FINE) }));
          p.inJail = false; p.jailTurns = 0; this.canRollAgain = false;
          this.pay(p, null, B.JAIL_FINE, this.t('reason.jailFine'));
          this.move(p, sum);
        } else {
          this.say(this.t('log.stillStuck', { n: p.jailTurns }));
          this.canRollAgain = false;
        }
      }
    } else if (dbl) {
      this.doublesCount++;
      if (this.doublesCount >= 3) {
        this.say(this.t('log.threeDoubles', { who: this.nm(p) }));
        this.sendToJail(p);
      } else {
        this.canRollAgain = true;
        this.move(p, sum);
      }
    } else {
      this.canRollAgain = false;
      this.move(p, sum);
    }
    this.settle();
    return null;
  }

  endTurn(p) {
    if (p !== this.current || this.step !== 'endturn') return this.t('err.cantEnd');
    this.nextTurn();
    return null;
  }

  // ---------- movement ----------
  passGo(p) {
    p.cash += B.GO_SALARY;
    this.say(this.t('log.passGo', { who: this.nm(p), m: this.m(B.GO_SALARY) }));
  }

  move(p, steps) {
    const to = (p.pos + steps) % 40;
    if (p.pos + steps >= 40) this.passGo(p);
    p.pos = to;
    this.landOn(p, steps, {});
  }

  moveTo(p, target, mods = {}) {
    if (target < p.pos) this.passGo(p);
    p.pos = target;
    this.landOn(p, this.dice[0] + this.dice[1], mods);
  }

  sendToJail(p) {
    p.pos = B.JAIL_POS;
    p.inJail = true;
    p.jailTurns = 0;
    if (p === this.current) this.canRollAgain = false;
  }

  landOn(p, diceSum, mods) {
    const sp = this.S[p.pos];
    if (isProperty(p.pos)) {
      const ownerId = this.owners[p.pos];
      if (!ownerId) {
        this.pendingBuy = p.pos;
        this.say(this.t('log.landedBuy', { who: this.nm(p), place: sp.name, m: this.m(sp.price) }));
      } else if (ownerId === p.id) {
        this.say(this.t('log.ownPlace', { who: this.nm(p), place: sp.name }));
      } else if (this.mortgaged[p.pos]) {
        this.say(this.t('log.mortNoRent', { place: sp.name }));
      } else {
        const owner = this.P(ownerId);
        const rent = this.rentFor(p.pos, diceSum, mods);
        this.say(this.t('log.rent', { who: this.nm(p), m: this.m(rent), owner: this.nm(owner), place: sp.name }));
        this.pay(p, owner, rent, this.t('reason.rent', { place: sp.name }));
      }
      return;
    }
    switch (sp.type) {
      case 'tax':
        this.say(this.t('log.tax', { ico: sp.emoji, who: this.nm(p), m: this.m(sp.amount), place: sp.name }));
        this.pay(p, null, sp.amount, sp.name);
        break;
      case 'chance': this.drawCard(p, 'chance', diceSum); break;
      case 'chest': this.drawCard(p, 'chest', diceSum); break;
      case 'gotojail':
        this.say(this.t('log.gotoJail', { who: this.nm(p) }));
        this.sendToJail(p);
        break;
      case 'parking':
        if (this.settings.jackpot && this.pot > 0) {
          this.say(this.t('log.jackpot', { who: this.nm(p), m: this.m(this.pot) }));
          p.cash += this.pot; this.pot = 0;
        } else this.say(this.t('log.parking', { who: this.nm(p) }));
        break;
      case 'jail': this.say(this.t('log.visiting', { who: this.nm(p) })); break;
      default: break;
    }
  }

  rentFor(pos, diceSum, mods = {}) {
    const sp = this.S[pos], ownerId = this.owners[pos];
    if (sp.type === 'street') {
      const h = this.houses[pos] || 0;
      if (h > 0) return sp.rent[h];
      return this.ownsGroup(ownerId, sp.group) ? sp.rent[0] * 2 : sp.rent[0];
    }
    if (sp.type === 'rail') {
      const n = [5, 15, 25, 35].filter((i) => this.owners[i] === ownerId).length;
      return 25 * 2 ** (n - 1) * (mods.double ? 2 : 1);
    }
    if (mods.util10) {
      const d1 = this.rand6(), d2 = this.rand6();
      this.dice = [d1, d2]; this.diceSeq++;
      this.say(this.t('log.util10', { d1, d2, s: d1 + d2 }));
      return 10 * (d1 + d2);
    }
    const n = [12, 28].filter((i) => this.owners[i] === ownerId).length;
    return (n === 2 ? 10 : 4) * diceSum;
  }

  // ---------- money ----------
  pay(from, to, amount, reason) {
    if (amount <= 0) return;
    if (from.cash >= amount && !this.debts.some((d) => d.from === from.id)) {
      from.cash -= amount;
      this.receive(to, amount);
    } else {
      this.debts.push({ from: from.id, to: to ? to.id : null, amount, reason });
      this.say(this.t('log.needs', { who: this.nm(from), m: this.m(amount), reason }));
    }
  }

  receive(to, amount) {
    if (to) to.cash += amount;
    else if (this.settings.jackpot) this.pot += amount;
  }

  payDebt(p) {
    const d = this.debts[0];
    if (!d || d.from !== p.id) return this.t('err.noDebt');
    if (p.cash < d.amount) return this.t('err.needMore', { m: this.m(d.amount - p.cash) });
    p.cash -= d.amount;
    this.receive(d.to ? this.P(d.to) : null, d.amount);
    this.debts.shift();
    this.say(this.t('log.paid', { who: this.nm(p), m: this.m(d.amount) }));
    this.settle();
    return null;
  }

  declareBankrupt(p) {
    const d = this.debts.find((x) => x.from === p.id);
    if (!d) return this.t('err.giveUpOnly');
    const creditor = d.to ? this.P(d.to) : null;
    this.goBankrupt(p, creditor);
    this.settle();
    return null;
  }

  goBankrupt(p, creditor) {
    // Buildings go back to the bank for half price.
    for (const pos of this.owns(p.id)) {
      const h = this.houses[pos] || 0;
      if (!h) continue;
      const hc = this.S[pos].house;
      if (h === 5) { this.hotelsLeft++; p.cash += (5 * hc) / 2; } else { this.housesLeft += h; p.cash += (h * hc) / 2; }
      this.houses[pos] = 0;
    }
    if (creditor && !creditor.bankrupt) {
      creditor.cash += p.cash;
      for (const pos of this.owns(p.id)) this.owners[pos] = creditor.id;
      creditor.jailCards.push(...p.jailCards);
      this.say(this.t('log.outTo', { who: this.nm(p), to: this.nm(creditor) }));
    } else {
      for (const pos of this.owns(p.id)) { delete this.owners[pos]; delete this.mortgaged[pos]; }
      for (const deck of p.jailCards) this.decks[deck].push(deck === 'chance' ? 8 : 4);
      this.say(this.t('log.outBank', { who: this.nm(p) }));
    }
    p.cash = 0; p.jailCards = []; p.bankrupt = true; p.inJail = false;
    this.debts = this.debts.filter((d) => d.from !== p.id && d.to !== p.id);
    this.trades = this.trades.filter((t) => t.from !== p.id && t.to !== p.id);
    if (this.auction) {
      this.auction.inIds = this.auction.inIds.filter((id) => id !== p.id);
      if (this.auction.bidder === p.id) { this.auction.bidder = null; this.auction.bid = 0; }
      this.checkAuctionEnd();
    }
    if (p === this.current) { this.pendingBuy = null; this.canRollAgain = false; }
    if (this.active().length <= 1) this.finishGame();
  }

  // ---------- cards ----------
  drawCard(p, deckName, diceSum) {
    const deck = this.decks[deckName];
    const idx = deck.shift();
    const card = (deckName === 'chance' ? this.CH : this.CC)[idx];
    if (card.act !== 'jailcard') deck.push(idx);
    this.card = { deck: deckName, text: card.text, playerId: p.id, seq: ++this.cardSeq };
    this.say(this.t('log.card', { ico: deckName === 'chance' ? this.T.chanceIco : this.T.chestIco, who: this.nm(p), text: card.text }));
    switch (card.act) {
      case 'move': this.moveTo(p, card.to); break;
      case 'nearest': {
        const spots = card.kind === 'rail' ? [5, 15, 25, 35] : [12, 28];
        const target = spots.find((s) => s > p.pos) ?? spots[0];
        this.moveTo(p, target, card.kind === 'rail' ? { double: true } : { util10: true });
        break;
      }
      case 'money':
        if (card.amount > 0) p.cash += card.amount;
        else this.pay(p, null, -card.amount, this.t('reason.card'));
        break;
      case 'jailcard': p.jailCards.push(deckName); break;
      case 'back3': p.pos = (p.pos + 37) % 40; this.landOn(p, diceSum, {}); break;
      case 'gotojail': this.sendToJail(p); break;
      case 'repairs': {
        let total = 0;
        for (const pos of this.owns(p.id)) {
          const h = this.houses[pos] || 0;
          total += h === 5 ? card.hotel : h * card.house;
        }
        if (total) this.pay(p, null, total, this.t('reason.repairs'));
        else this.say(this.t('log.noRepairs'));
        break;
      }
      case 'each':
        for (const o of this.active()) {
          if (o === p) continue;
          if (card.amount < 0) this.pay(p, o, -card.amount, this.t('reason.payEach'));
          else this.pay(o, p, card.amount, this.t('reason.collectEach'));
        }
        break;
      default: break;
    }
  }

  // ---------- jail ----------
  payJail(p) {
    if (p !== this.current || this.step !== 'roll' || !p.inJail) return this.t('err.notNow');
    if (p.cash < B.JAIL_FINE) return this.t('err.need', { m: this.m(B.JAIL_FINE) });
    p.cash -= B.JAIL_FINE;
    this.receive(null, B.JAIL_FINE);
    p.inJail = false; p.jailTurns = 0;
    this.say(this.t('log.paidJail', { who: this.nm(p), m: this.m(B.JAIL_FINE) }));
    return null;
  }

  useJailCard(p) {
    if (p !== this.current || this.step !== 'roll' || !p.inJail) return this.t('err.notNow');
    const deck = p.jailCards.pop();
    if (!deck) return this.t('err.noEscape');
    this.decks[deck].push(deck === 'chance' ? 8 : 4);
    p.inJail = false; p.jailTurns = 0;
    this.say(this.t('log.usedEscape', { who: this.nm(p) }));
    return null;
  }

  // ---------- buying & auctions ----------
  buy(p) {
    if (p !== this.current || this.step !== 'buy') return this.t('err.notNow');
    const pos = this.pendingBuy, price = this.S[pos].price;
    if (p.cash < price) return this.t('err.noMoneyAuction');
    p.cash -= price;
    this.owners[pos] = p.id;
    this.pendingBuy = null;
    this.say(this.t('log.bought', { who: this.nm(p), place: this.S[pos].name }));
    this.settle();
    return null;
  }

  decline(p) {
    if (p !== this.current || this.step !== 'buy') return this.t('err.notNow');
    const pos = this.pendingBuy;
    this.pendingBuy = null;
    this.auction = { pos, bid: 0, bidder: null, inIds: this.active().map((x) => x.id) };
    this.say(this.t('log.auction', { place: this.S[pos].name }));
    this.settle();
    return null;
  }

  bid(p, inc) {
    const a = this.auction;
    if (!a || !a.inIds.includes(p.id)) return this.t('err.notInAuction');
    inc = Math.max(1, Math.floor(Number(inc) || 0));
    const amount = a.bid + inc;
    if (p.cash < amount) return this.t('err.onlyHave', { m: this.m(p.cash) });
    a.bid = amount; a.bidder = p.id;
    this.say(this.t('log.bid', { who: this.nm(p), m: this.m(amount) }));
    this.checkAuctionEnd();
    return null;
  }

  passAuction(p) {
    const a = this.auction;
    if (!a || !a.inIds.includes(p.id)) return this.t('err.notInAuction');
    if (a.bidder === p.id) return this.t('err.topBid');
    a.inIds = a.inIds.filter((id) => id !== p.id);
    this.say(this.t('log.stopBid', { who: this.nm(p) }));
    this.checkAuctionEnd();
    return null;
  }

  checkAuctionEnd(force = false) {
    const a = this.auction;
    if (!a) return;
    const done = force || a.inIds.length === 0 || (a.bidder && a.inIds.length === 1 && a.inIds[0] === a.bidder);
    if (!done) return;
    if (a.bidder) {
      const w = this.P(a.bidder);
      w.cash -= a.bid;
      this.owners[a.pos] = w.id;
      this.say(this.t('log.won', { who: this.nm(w), place: this.S[a.pos].name, m: this.m(a.bid) }));
    } else {
      this.say(this.t('log.nobody', { place: this.S[a.pos].name }));
    }
    this.auction = null;
    this.settle();
  }

  // ---------- building & mortgages ----------
  buildHouse(p, pos) {
    const sp = this.S[pos];
    if (!sp || sp.type !== 'street' || this.owners[pos] !== p.id) return this.t('err.buildOwn');
    if (!this.ownsGroup(p.id, sp.group)) return this.t('err.needSet', { group: this.G[sp.group].name });
    const grp = groupOf(sp.group);
    if (grp.some((i) => this.mortgaged[i])) return this.t('err.unmortgageSet');
    const h = this.houses[pos] || 0;
    if (h >= 5) return this.t('err.hasHotel');
    if (h > Math.min(...grp.map((i) => this.houses[i] || 0))) return this.t('err.buildEven');
    if (p.cash < sp.house) return this.t('err.houseCost', { m: this.m(sp.house) });
    if (h === 4) {
      if (this.hotelsLeft < 1) return this.t('err.noHotels');
      this.hotelsLeft--; this.housesLeft += 4;
    } else {
      if (this.housesLeft < 1) return this.t('err.noHouses');
      this.housesLeft--;
    }
    p.cash -= sp.house;
    this.houses[pos] = h + 1;
    this.say(this.t(h === 4 ? 'log.builtHotel' : 'log.builtHouse', { who: this.nm(p), place: sp.name }));
    return null;
  }

  sellHouse(p, pos) {
    const sp = this.S[pos];
    if (!sp || sp.type !== 'street' || this.owners[pos] !== p.id) return this.t('err.notYours');
    const h = this.houses[pos] || 0;
    if (!h) return this.t('err.noBuildings');
    const grp = groupOf(sp.group);
    if (h < Math.max(...grp.map((i) => this.houses[i] || 0))) return this.t('err.sellEven');
    if (h === 5) {
      if (this.housesLeft < 4) return this.t('err.hotelSwap');
      this.housesLeft -= 4; this.hotelsLeft++;
    } else this.housesLeft++;
    this.houses[pos] = h - 1;
    p.cash += sp.house / 2;
    this.say(this.t(h === 5 ? 'log.soldHotel' : 'log.soldHouse', { who: this.nm(p), place: sp.name, m: this.m(sp.house / 2) }));
    return null;
  }

  mortgage(p, pos) {
    if (!isProperty(pos) || this.owners[pos] !== p.id) return this.t('err.notYours');
    if (this.mortgaged[pos]) return this.t('err.alreadyMort');
    const sp = this.S[pos];
    if (sp.type === 'street' && this.groupHasBuildings(sp.group)) return this.t('err.sellHousesFirst');
    this.mortgaged[pos] = true;
    p.cash += mortgageValue(pos);
    this.say(this.t('log.mortgaged', { who: this.nm(p), place: sp.name, m: this.m(mortgageValue(pos)) }));
    return null;
  }

  unmortgage(p, pos) {
    if (!isProperty(pos) || this.owners[pos] !== p.id || !this.mortgaged[pos]) return this.t('err.notMort');
    const cost = unmortgageCost(pos);
    if (p.cash < cost) return this.t('err.unmortCost', { m: this.m(cost) });
    p.cash -= cost;
    delete this.mortgaged[pos];
    this.say(this.t('log.unmortgaged', { who: this.nm(p), place: this.S[pos].name }));
    return null;
  }

  // ---------- trading ----------
  cleanOffer(o) {
    const nums = (a) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((n) => Number.isInteger(n) && isProperty(n)))];
    const cash = (n) => Math.max(0, Math.floor(Number(n) || 0));
    const cards = (n) => Math.max(0, Math.min(2, Math.floor(Number(n) || 0)));
    return { to: String(o.to), giveProps: nums(o.giveProps), getProps: nums(o.getProps), giveCash: cash(o.giveCash), getCash: cash(o.getCash), giveCards: cards(o.giveCards), getCards: cards(o.getCards) };
  }

  checkTrade(t) {
    const a = this.P(t.from), b = this.P(t.to);
    if (!a || !b || a.bankrupt || b.bankrupt || a === b) return this.t('err.pickTrade');
    if (!t.giveProps.length && !t.getProps.length && !t.giveCards && !t.getCards) return this.t('err.tradeEmpty');
    for (const pos of t.giveProps) if (this.owners[pos] !== a.id) return this.t('err.notYoursPlace', { place: this.S[pos].name });
    for (const pos of t.getProps) if (this.owners[pos] !== b.id) return this.t('err.notTheirs', { place: this.S[pos].name });
    for (const pos of [...t.giveProps, ...t.getProps]) {
      const sp = this.S[pos];
      if (sp.type === 'street' && this.groupHasBuildings(sp.group)) return this.t('err.tradeHouses', { group: this.G[sp.group].name, place: sp.name });
    }
    if (a.cash < t.giveCash) return this.t('err.noCash', { name: a.name, m: this.m(t.giveCash) });
    if (b.cash < t.getCash) return this.t('err.noCash', { name: b.name, m: this.m(t.getCash) });
    if (a.jailCards.length < t.giveCards || b.jailCards.length < t.getCards) return this.t('err.notEnoughEscape');
    return null;
  }

  proposeTrade(p, offer) {
    if (this.phase !== 'playing' || p.bankrupt) return this.t('err.notNow');
    const t = { ...this.cleanOffer(offer || {}), from: p.id };
    const err = this.checkTrade(t);
    if (err) return err;
    this.trades = this.trades.filter((x) => x.from !== p.id); // one open offer each
    t.id = ++this.tradeSeq;
    this.trades.push(t);
    this.say(this.t('log.offer', { who: this.nm(p), to: this.nm(this.P(t.to)) }));
    return null;
  }

  respondTrade(p, id, accept) {
    const t = this.trades.find((x) => x.id === Number(id));
    if (!t) return this.t('err.offerGone');
    if (accept && t.to !== p.id) return this.t('err.onlyOther');
    if (!accept && t.to !== p.id && t.from !== p.id) return this.t('err.notYourTrade');
    this.trades = this.trades.filter((x) => x !== t);
    const a = this.P(t.from), b = this.P(t.to);
    if (!accept) { this.say(this.t('log.tradeCancelled', { a: this.nm(a), b: this.nm(b) })); return null; }
    const err = this.checkTrade(t);
    if (err) return err;
    // Receiving a mortgaged place costs 10% interest (official rule).
    const fee = (list) => list.filter((pos) => this.mortgaged[pos]).reduce((s, pos) => s + interestOnly(pos), 0);
    const aFee = fee(t.getProps), bFee = fee(t.giveProps);
    if (a.cash - t.giveCash + t.getCash < aFee) return this.t('err.cantPayInterest', { name: a.name, m: this.m(aFee) });
    if (b.cash - t.getCash + t.giveCash < bFee) return this.t('err.youCantPayInterest', { m: this.m(bFee) });
    a.cash += t.getCash - t.giveCash - aFee;
    b.cash += t.giveCash - t.getCash - bFee;
    for (const pos of t.giveProps) this.owners[pos] = b.id;
    for (const pos of t.getProps) this.owners[pos] = a.id;
    for (let i = 0; i < t.giveCards; i++) b.jailCards.push(a.jailCards.pop());
    for (let i = 0; i < t.getCards; i++) a.jailCards.push(b.jailCards.pop());
    this.say(this.t('log.traded', { a: this.nm(a), b: this.nm(b) }));
    return null;
  }

  // ---------- end of game ----------
  netWorth(p) {
    let v = p.cash;
    for (const pos of this.owns(p.id)) {
      const sp = this.S[pos];
      v += this.mortgaged[pos] ? sp.price / 2 : sp.price;
      const h = this.houses[pos] || 0;
      if (h) v += h * sp.house;
    }
    return v;
  }

  finishGame() {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.step = 'over';
    this.auction = null; this.debts = []; this.trades = []; this.pendingBuy = null; this.canRollAgain = false;
    this.ranking = this.players
      .map((p) => ({ id: p.id, worth: p.bankrupt ? 0 : this.netWorth(p) }))
      .sort((x, y) => y.worth - x.worth);
    const w = this.P(this.ranking[0].id);
    this.say(this.t('log.winner', { who: this.nm(w) }));
  }

  // ---------- dispatch ----------
  act(pid, a) {
    const p = this.P(pid);
    if (!p) return this.t('err.notInGame');
    if (this.phase !== 'playing') return this.t('err.notRunning');
    if (p.bankrupt) return this.t('err.youreOut');
    const pos = Number(a.pos);
    switch (a.type) {
      case 'roll': return this.roll(p);
      case 'endTurn': return this.endTurn(p);
      case 'buy': return this.buy(p);
      case 'decline': return this.decline(p);
      case 'bid': return this.bid(p, a.inc);
      case 'pass': return this.passAuction(p);
      case 'payJail': return this.payJail(p);
      case 'useCard': return this.useJailCard(p);
      case 'payDebt': return this.payDebt(p);
      case 'bankrupt': return this.declareBankrupt(p);
      case 'build': return this.buildHouse(p, pos);
      case 'sell': return this.sellHouse(p, pos);
      case 'mortgage': return this.mortgage(p, pos);
      case 'unmortgage': return this.unmortgage(p, pos);
      case 'trade': return this.proposeTrade(p, a.offer);
      case 'tradeReply': return this.respondTrade(p, a.id, !!a.accept);
      default: return this.t('err.unknown');
    }
  }

  view() {
    return {
      code: this.code, phase: this.phase, players: this.players, turn: this.turn, step: this.step,
      owners: this.owners, houses: this.houses, mortgaged: this.mortgaged,
      housesLeft: this.housesLeft, hotelsLeft: this.hotelsLeft,
      dice: this.dice, diceSeq: this.diceSeq, pendingBuy: this.pendingBuy, auction: this.auction,
      debts: this.debts, trades: this.trades, card: this.card, pot: this.pot, settings: this.settings,
      log: this.log.slice(-25), ranking: this.ranking, canRollAgain: this.canRollAgain,
    };
  }
}

module.exports = { Game, groupOf, unmortgageCost };
