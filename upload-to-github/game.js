// Game rules engine. All state lives here; clients only send intents.
const B = require('./shared/board');
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
    this.settings = { jackpot: false, theme: 'greece' };
    this.setTheme('greece');
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
    const t = B.themed(id);
    this.settings.theme = id;
    this.T = t.T; this.S = t.SPACES; this.G = t.GROUPS; this.CH = t.CHANCE; this.CC = t.CHEST;
  }

  // ---------- lobby ----------
  join(id, name, tokenId) {
    if (this.phase !== 'lobby') return 'The game has already started.';
    if (this.players.length >= 8) return 'The game is full (8 players).';
    name = String(name || '').trim().slice(0, 14);
    if (!name) return 'Please type your name.';
    const tok = TOKENS.find((t) => t.id === tokenId);
    if (!tok) return 'Pick a character!';
    if (this.players.some((p) => p.token === tokenId)) return 'Someone already picked that one!';
    this.players.push({
      id, name, token: tok.id, emoji: tok.emoji, color: tok.color,
      cash: B.START_CASH, pos: 0, inJail: false, jailTurns: 0, jailCards: [], bankrupt: false, connected: true,
    });
    this.say(`${tok.emoji} ${name} joined the game!`);
    return null;
  }

  start(settings = {}) {
    if (this.phase !== 'lobby') return 'Already started.';
    if (this.players.length < 2) return 'You need at least 2 players.';
    this.settings.jackpot = !!settings.jackpot;
    if (settings.theme) this.setTheme(settings.theme);
    this.players = shuffle(this.players, this.rng);
    this.phase = 'playing';
    this.turn = 0;
    this.say(`🎉 The adventure begins! ${this.nm(this.current)} goes first.`);
    this.beginTurn();
    return null;
  }

  removePlayer(id) {
    const p = this.P(id);
    if (!p) return 'No such player.';
    if (this.phase === 'lobby') {
      this.players = this.players.filter((x) => x !== p);
      return null;
    }
    if (p.bankrupt) return null;
    this.say(`👋 ${this.nm(p)} left the game.`);
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
    this.say(`➡️ It's ${this.nm(this.current)}'s turn.`);
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
    if (p !== this.current || this.step !== 'roll') return "You can't roll right now.";
    const d1 = this.rand6(), d2 = this.rand6();
    this.dice = [d1, d2];
    this.diceSeq++;
    const sum = d1 + d2, dbl = d1 === d2;
    this.say(`🎲 ${this.nm(p)} rolled ${d1} + ${d2} = ${sum}${dbl ? ' — doubles!' : ''}`);

    if (p.inJail) {
      if (dbl) {
        p.inJail = false; p.jailTurns = 0; this.canRollAgain = false;
        this.say(`${this.T.escapeIco} ${this.nm(p)} rolled doubles and escaped ${this.T.jailShort}!`);
        this.move(p, sum);
      } else {
        p.jailTurns++;
        if (p.jailTurns >= 3) {
          this.say(`${this.T.jailIco} Third try in ${this.T.jailShort} — ${this.nm(p)} pays ${this.T.cur}${B.JAIL_FINE} and walks out.`);
          p.inJail = false; p.jailTurns = 0; this.canRollAgain = false;
          this.pay(p, null, B.JAIL_FINE, 'the jail fine');
          this.move(p, sum);
        } else {
          this.say(`${this.T.jailIco} Still stuck in ${this.T.jailShort} (try ${p.jailTurns} of 3).`);
          this.canRollAgain = false;
        }
      }
    } else if (dbl) {
      this.doublesCount++;
      if (this.doublesCount >= 3) {
        this.say(`😵 Three doubles in a row! ${this.nm(p)} goes to ${this.T.jailShort}.`);
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
    if (p !== this.current || this.step !== 'endturn') return "You can't end your turn yet.";
    this.nextTurn();
    return null;
  }

  // ---------- movement ----------
  passGo(p) {
    p.cash += B.GO_SALARY;
    this.say(`${this.T.goIco} ${this.nm(p)} passed GO and collected ${this.T.cur}${B.GO_SALARY}!`);
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
        this.say(`📍 ${this.nm(p)} landed on ${sp.name} (${this.T.cur}${sp.price}). Buy it?`);
      } else if (ownerId === p.id) {
        this.say(`🏡 ${this.nm(p)} is visiting their own ${sp.name}.`);
      } else if (this.mortgaged[p.pos]) {
        this.say(`💤 ${sp.name} is mortgaged — no rent to pay!`);
      } else {
        const owner = this.P(ownerId);
        const rent = this.rentFor(p.pos, diceSum, mods);
        this.say(`💸 ${this.nm(p)} pays ${this.T.cur}${rent} rent to ${this.nm(owner)} for ${sp.name}.`);
        this.pay(p, owner, rent, `rent for ${sp.name}`);
      }
      return;
    }
    switch (sp.type) {
      case 'tax':
        this.say(`${sp.emoji} ${this.nm(p)} pays ${this.T.cur}${sp.amount} ${sp.name}.`);
        this.pay(p, null, sp.amount, sp.name);
        break;
      case 'chance': this.drawCard(p, 'chance', diceSum); break;
      case 'chest': this.drawCard(p, 'chest', diceSum); break;
      case 'gotojail':
        this.say(`${this.T.gotoIco} ${this.nm(p)} goes to ${this.T.jail}!`);
        this.sendToJail(p);
        break;
      case 'parking':
        if (this.settings.jackpot && this.pot > 0) {
          this.say(`${this.T.parkingIco} ${this.T.parkingName} jackpot! ${this.nm(p)} collects ${this.T.cur}${this.pot}!`);
          p.cash += this.pot; this.pot = 0;
        } else this.say(`${this.T.parkingIco} ${this.nm(p)} ${this.T.parkingMsg}.`);
        break;
      case 'jail': this.say(`👀 ${this.nm(p)} is just visiting ${this.T.jailShort}.`); break;
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
      this.say(`🎲 Rolled ${d1} + ${d2} for ${this.T.chanceShort}: 10 × ${d1 + d2}.`);
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
      this.say(`😟 ${this.nm(from)} needs ${this.T.cur}${amount} for ${reason} — time to sell or mortgage something!`);
    }
  }

  receive(to, amount) {
    if (to) to.cash += amount;
    else if (this.settings.jackpot) this.pot += amount;
  }

  payDebt(p) {
    const d = this.debts[0];
    if (!d || d.from !== p.id) return "You don't owe anything right now.";
    if (p.cash < d.amount) return `You need ${this.T.cur}${d.amount - p.cash} more. Sell houses or mortgage places first.`;
    p.cash -= d.amount;
    this.receive(d.to ? this.P(d.to) : null, d.amount);
    this.debts.shift();
    this.say(`✅ ${this.nm(p)} paid ${this.T.cur}${d.amount}.`);
    this.settle();
    return null;
  }

  declareBankrupt(p) {
    const d = this.debts.find((x) => x.from === p.id);
    if (!d) return 'You can only give up when you owe money you cannot pay.';
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
      this.say(`💔 ${this.nm(p)} is out! Everything goes to ${this.nm(creditor)}.`);
    } else {
      for (const pos of this.owns(p.id)) { delete this.owners[pos]; delete this.mortgaged[pos]; }
      for (const deck of p.jailCards) this.decks[deck].push(deck === 'chance' ? 8 : 4);
      this.say(`💔 ${this.nm(p)} is out! Their places go back to the bank.`);
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
    this.say(`${deckName === 'chance' ? this.T.chanceIco : this.T.chestIco} ${this.nm(p)}: "${card.text}"`);
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
        else this.pay(p, null, -card.amount, 'a ' + this.T.chanceName + ' card');
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
        if (total) this.pay(p, null, total, 'repairs');
        else this.say('Lucky! No houses to fix.');
        break;
      }
      case 'each':
        for (const o of this.active()) {
          if (o === p) continue;
          if (card.amount < 0) this.pay(p, o, -card.amount, this.T.payEach);
          else this.pay(o, p, card.amount, this.T.collectEach);
        }
        break;
      default: break;
    }
  }

  // ---------- jail ----------
  payJail(p) {
    if (p !== this.current || this.step !== 'roll' || !p.inJail) return 'Not now.';
    if (p.cash < B.JAIL_FINE) return `You need ${this.T.cur}${B.JAIL_FINE}.`;
    p.cash -= B.JAIL_FINE;
    this.receive(null, B.JAIL_FINE);
    p.inJail = false; p.jailTurns = 0;
    this.say(`🔓 ${this.nm(p)} paid ${this.T.cur}${B.JAIL_FINE} to leave ${this.T.jailShort}.`);
    return null;
  }

  useJailCard(p) {
    if (p !== this.current || this.step !== 'roll' || !p.inJail) return 'Not now.';
    const deck = p.jailCards.pop();
    if (!deck) return `You don't have a ${this.T.escapeName}.`;
    this.decks[deck].push(deck === 'chance' ? 8 : 4);
    p.inJail = false; p.jailTurns = 0;
    this.say(`${this.T.escapeIco} ${this.nm(p)} used a ${this.T.escapeName}!`);
    return null;
  }

  // ---------- buying & auctions ----------
  buy(p) {
    if (p !== this.current || this.step !== 'buy') return 'Not now.';
    const pos = this.pendingBuy, price = this.S[pos].price;
    if (p.cash < price) return "You don't have enough money — try the auction!";
    p.cash -= price;
    this.owners[pos] = p.id;
    this.pendingBuy = null;
    this.say(`🎀 ${this.nm(p)} bought ${this.S[pos].name}!`);
    this.settle();
    return null;
  }

  decline(p) {
    if (p !== this.current || this.step !== 'buy') return 'Not now.';
    const pos = this.pendingBuy;
    this.pendingBuy = null;
    this.auction = { pos, bid: 0, bidder: null, inIds: this.active().map((x) => x.id) };
    this.say(`🔨 Auction time for ${this.S[pos].name}! Everyone can bid.`);
    this.settle();
    return null;
  }

  bid(p, inc) {
    const a = this.auction;
    if (!a || !a.inIds.includes(p.id)) return 'You are not in this auction.';
    inc = Math.max(1, Math.floor(Number(inc) || 0));
    const amount = a.bid + inc;
    if (p.cash < amount) return `You only have ${this.T.cur}${p.cash}.`;
    a.bid = amount; a.bidder = p.id;
    this.say(`🙋 ${this.nm(p)} bids ${this.T.cur}${amount}!`);
    this.checkAuctionEnd();
    return null;
  }

  passAuction(p) {
    const a = this.auction;
    if (!a || !a.inIds.includes(p.id)) return 'You are not in this auction.';
    if (a.bidder === p.id) return 'You have the top bid!';
    a.inIds = a.inIds.filter((id) => id !== p.id);
    this.say(`🙅 ${this.nm(p)} stops bidding.`);
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
      this.say(`🎉 ${this.nm(w)} won ${this.S[a.pos].name} for ${this.T.cur}${a.bid}!`);
    } else {
      this.say(`Nobody bid — ${this.S[a.pos].name} stays with the bank.`);
    }
    this.auction = null;
    this.settle();
  }

  // ---------- building & mortgages ----------
  buildHouse(p, pos) {
    const sp = this.S[pos];
    if (!sp || sp.type !== 'street' || this.owners[pos] !== p.id) return 'You can only build on your own streets.';
    if (!this.ownsGroup(p.id, sp.group)) return `You need all the ${this.G[sp.group].name} first!`;
    const grp = groupOf(sp.group);
    if (grp.some((i) => this.mortgaged[i])) return 'Unmortgage the whole colour set first.';
    const h = this.houses[pos] || 0;
    if (h >= 5) return 'This already has a hotel!';
    if (h > Math.min(...grp.map((i) => this.houses[i] || 0))) return 'Build evenly — add houses to the other streets in this colour first.';
    if (p.cash < sp.house) return `A house costs ${this.T.cur}${sp.house}.`;
    if (h === 4) {
      if (this.hotelsLeft < 1) return 'The bank has no hotels left!';
      this.hotelsLeft--; this.housesLeft += 4;
    } else {
      if (this.housesLeft < 1) return 'The bank has no houses left!';
      this.housesLeft--;
    }
    p.cash -= sp.house;
    this.houses[pos] = h + 1;
    this.say(`${h === 4 ? '🏨' : '🏠'} ${this.nm(p)} built a ${h === 4 ? 'hotel' : 'house'} on ${sp.name}!`);
    return null;
  }

  sellHouse(p, pos) {
    const sp = this.S[pos];
    if (!sp || sp.type !== 'street' || this.owners[pos] !== p.id) return 'Not yours.';
    const h = this.houses[pos] || 0;
    if (!h) return 'No buildings here.';
    const grp = groupOf(sp.group);
    if (h < Math.max(...grp.map((i) => this.houses[i] || 0))) return 'Sell evenly — sell from the other streets in this colour first.';
    if (h === 5) {
      if (this.housesLeft < 4) return 'The bank needs 4 houses to swap for your hotel, and it does not have them.';
      this.housesLeft -= 4; this.hotelsLeft++;
    } else this.housesLeft++;
    this.houses[pos] = h - 1;
    p.cash += sp.house / 2;
    this.say(`💰 ${this.nm(p)} sold a ${h === 5 ? 'hotel' : 'house'} on ${sp.name} for ${this.T.cur}${sp.house / 2}.`);
    return null;
  }

  mortgage(p, pos) {
    if (!isProperty(pos) || this.owners[pos] !== p.id) return 'Not yours.';
    if (this.mortgaged[pos]) return 'Already mortgaged.';
    const sp = this.S[pos];
    if (sp.type === 'street' && this.groupHasBuildings(sp.group)) return 'Sell the houses in this colour set first.';
    this.mortgaged[pos] = true;
    p.cash += mortgageValue(pos);
    this.say(`🏦 ${this.nm(p)} mortgaged ${sp.name} for ${this.T.cur}${mortgageValue(pos)}.`);
    return null;
  }

  unmortgage(p, pos) {
    if (!isProperty(pos) || this.owners[pos] !== p.id || !this.mortgaged[pos]) return 'Not mortgaged.';
    const cost = unmortgageCost(pos);
    if (p.cash < cost) return `You need ${this.T.cur}${cost} (that includes 10% interest).`;
    p.cash -= cost;
    delete this.mortgaged[pos];
    this.say(`✨ ${this.nm(p)} paid back the mortgage on ${this.S[pos].name}.`);
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
    if (!a || !b || a.bankrupt || b.bankrupt || a === b) return 'Pick another player to trade with.';
    if (!t.giveProps.length && !t.getProps.length && !t.giveCards && !t.getCards) return 'Add at least one place or card to the trade.';
    for (const pos of t.giveProps) if (this.owners[pos] !== a.id) return `${this.S[pos].name} isn't yours.`;
    for (const pos of t.getProps) if (this.owners[pos] !== b.id) return `${this.S[pos].name} isn't theirs.`;
    for (const pos of [...t.giveProps, ...t.getProps]) {
      const sp = this.S[pos];
      if (sp.type === 'street' && this.groupHasBuildings(sp.group)) return `Sell the houses on the ${this.G[sp.group].name} before trading ${sp.name}.`;
    }
    if (a.cash < t.giveCash) return `${a.name} doesn't have ${this.T.cur}${t.giveCash}.`;
    if (b.cash < t.getCash) return `${b.name} doesn't have ${this.T.cur}${t.getCash}.`;
    if (a.jailCards.length < t.giveCards || b.jailCards.length < t.getCards) return `Not enough ${this.T.escapeName}s.`;
    return null;
  }

  proposeTrade(p, offer) {
    if (this.phase !== 'playing' || p.bankrupt) return 'Not now.';
    const t = { ...this.cleanOffer(offer || {}), from: p.id };
    const err = this.checkTrade(t);
    if (err) return err;
    this.trades = this.trades.filter((x) => x.from !== p.id); // one open offer each
    t.id = ++this.tradeSeq;
    this.trades.push(t);
    this.say(`🤝 ${this.nm(p)} sent a trade offer to ${this.nm(this.P(t.to))}.`);
    return null;
  }

  respondTrade(p, id, accept) {
    const t = this.trades.find((x) => x.id === Number(id));
    if (!t) return 'That offer is gone.';
    if (accept && t.to !== p.id) return 'Only the other player can accept.';
    if (!accept && t.to !== p.id && t.from !== p.id) return 'Not your trade.';
    this.trades = this.trades.filter((x) => x !== t);
    const a = this.P(t.from), b = this.P(t.to);
    if (!accept) { this.say(`🙅 Trade between ${this.nm(a)} and ${this.nm(b)} was cancelled.`); return null; }
    const err = this.checkTrade(t);
    if (err) return err;
    // Receiving a mortgaged place costs 10% interest (official rule).
    const fee = (list) => list.filter((pos) => this.mortgaged[pos]).reduce((s, pos) => s + interestOnly(pos), 0);
    const aFee = fee(t.getProps), bFee = fee(t.giveProps);
    if (a.cash - t.giveCash + t.getCash < aFee) return `${a.name} can't pay the ${this.T.cur}${aFee} mortgage interest.`;
    if (b.cash - t.getCash + t.giveCash < bFee) return `You can't pay the ${this.T.cur}${bFee} mortgage interest.`;
    a.cash += t.getCash - t.giveCash - aFee;
    b.cash += t.giveCash - t.getCash - bFee;
    for (const pos of t.giveProps) this.owners[pos] = b.id;
    for (const pos of t.getProps) this.owners[pos] = a.id;
    for (let i = 0; i < t.giveCards; i++) b.jailCards.push(a.jailCards.pop());
    for (let i = 0; i < t.getCards; i++) a.jailCards.push(b.jailCards.pop());
    this.say(`🤝 ${this.nm(a)} and ${this.nm(b)} made a trade!`);
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
    this.auction = null; this.debts = []; this.trades = [];
    this.ranking = this.players
      .map((p) => ({ id: p.id, worth: p.bankrupt ? 0 : this.netWorth(p) }))
      .sort((x, y) => y.worth - x.worth);
    const w = this.P(this.ranking[0].id);
    this.say(`👑 ${this.nm(w)} is the ${this.T.crown}! 🎉`);
  }

  // ---------- dispatch ----------
  act(pid, a) {
    const p = this.P(pid);
    if (!p) return 'You are not in this game.';
    if (this.phase !== 'playing') return 'The game is not running.';
    if (p.bankrupt) return 'You are out of the game.';
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
      default: return 'Unknown action.';
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
