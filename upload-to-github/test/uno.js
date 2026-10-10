// Bots play many UNO games; checks the official rules hold and no card is ever lost or duplicated.
const assert = require('assert');
const { Uno, newDeck, points } = require('../games/uno/uno');

let seed = 3; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const deck = newDeck();
assert.strictEqual(deck.length, 108);
assert.strictEqual(deck.filter((c) => c.c === 'w').length, 8);
assert.strictEqual(deck.reduce((s, c) => s + points(c), 0), 4 * (0 + 2 * 45) + 4 * 6 * 20 + 8 * 50);

const total = (u) => u.deck.length + u.discard.length + u.players.reduce((s, p) => s + p.hand.length, 0);
let games = 0, rounds = 0, wd4 = 0, challengesWon = 0, challengesLost = 0, catches = 0, reshuffles = 0;
for (let g = 0; g < 400; g++) {
  const u = new Uno('T', () => {}, { rng });
  const n = 2 + (g % 9);
  for (let i = 0; i < n; i++) assert.strictEqual(u.join('p' + i, 'Kid' + i, '🦄'), null);
  u.setSettings({ target: [0, 200, 500][g % 3] });
  assert.strictEqual(u.start(), null);
  assert.strictEqual(u.join('late', 'Late', '🐱'), 'err.started');
  assert(/^\d$/.test(u.top.v), 'first discard must be a number');
  let steps = 0;
  while (u.phase !== 'final' && steps < 20000) {
    steps++;
    if (u.phase === 'roundover') { rounds++; assert.strictEqual(u.nextRound(), null); assert(/^\d$/.test(u.top.v)); continue; }
    assert.strictEqual(total(u), 108, 'cards lost or duplicated');
    // somebody may catch a missing UNO
    if (u.unoPending && rng() < 0.5) {
      const victim = u.P(u.unoPending), before = victim.hand.length;
      const catcher = u.players.find((p) => p.id !== victim.id);
      assert.strictEqual(u.catchUno(catcher.id), null);
      assert.strictEqual(victim.hand.length, before + 2);
      catches++;
      continue;
    }
    if (u.pending) {
      const target = u.P(u.pending.target), from = u.P(u.pending.from);
      const tb = target.hand.length, fb = from.hand.length, illegal = u.pending.illegal;
      const challenge = rng() < 0.4;
      assert.strictEqual(u.respond(target.id, challenge), null);
      if (!challenge) assert.strictEqual(target.hand.length, tb + 4);
      else if (illegal) { challengesWon++; assert.strictEqual(from.hand.length, fb + 4); assert.strictEqual(u.cur, target, 'challenger should play next'); }
      else { challengesLost++; assert.strictEqual(target.hand.length, tb + 6); }
      continue;
    }
    const p = u.cur;
    // nobody else may act
    const other = u.players.find((x) => x !== p);
    assert.strictEqual(u.draw(other.id), 'err.notYourTurn');
    const view = u.view(p.id).me;
    if (p.hand.length === 2 && rng() < 0.7) assert.strictEqual(u.sayUno(p.id), null);
    if (view.playable.length && rng() < 0.9) {
      const id = view.playable[Math.floor(rng() * view.playable.length)];
      const card = p.hand.find((c) => c.id === id);
      const top = u.top, color = u.color;
      assert(card.c === 'w' || card.c === color || card.v === top.v, 'played an illegal card');
      if (card.v === 'wd4') wd4++;
      // an unplayable card must be refused
      const bad = p.hand.find((c) => c.c !== 'w' && c.c !== color && c.v !== top.v);
      if (bad) assert.strictEqual(u.play(p.id, bad.id), u.drawnCard === null ? 'err.cantPlay' : 'err.onlyDrawn');
      assert.strictEqual(u.play(p.id, id, ['r', 'y', 'g', 'b'][Math.floor(rng() * 4)]), null);
    } else if (view.drawnCard !== null) {
      assert.strictEqual(u.keep(p.id), null);
    } else {
      const before = p.hand.length, deckBefore = u.deck.length;
      assert.strictEqual(u.draw(p.id), null);
      if (deckBefore === 0) reshuffles++;
      assert(p.hand.length <= before + 1);
      if (u.cur === p && u.drawnCard !== null) {
        // only the drawn card may be played now
        const other = p.hand.find((c) => c.id !== u.drawnCard);
        if (other) assert.strictEqual(u.play(p.id, other.id, 'r'), 'err.onlyDrawn');
      }
    }
  }
  assert.strictEqual(u.phase, 'final', 'game did not finish');
  const w = u.P(u.winner);
  assert(w, 'no winner');
  if (u.settings.target) assert(w.score >= u.settings.target, 'winner below target');
  else assert.strictEqual(w.hand.length, 0, 'winner still has cards');
  u.backToLobby();
  games++;
}
// removing a player mid-game keeps every card
{
  const u = new Uno('R', () => {}, { rng });
  for (let i = 0; i < 4; i++) u.join('p' + i, 'K' + i, '🦄');
  u.start();
  u.removePlayer(u.cur.id);
  assert.strictEqual(total(u), 108);
  assert(u.cur, 'turn lost after removal');
}
console.log(`OK — ${games} UNO games (${rounds} extra scored rounds), ${wd4} Wild Draw Fours, challenges ${challengesWon} won / ${challengesLost} lost, ${catches} UNO catches, ${reshuffles} reshuffles; no card ever lost.`);
