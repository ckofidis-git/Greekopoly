// Bots play Treasure Island with a fake clock; checks money, land, shields and secrecy rules.
const assert = require('assert');
const { Island, COST, SHIELD_MS } = require('../games/island/island');

let seed = 11; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let now = 0; const timers = [];
const clock = { rng, now: () => now, schedule: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t; }, cancel: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); } };
const tick = (ms) => { const end = now + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers[0]; if (!t || t.at > end) break; timers.shift(); now = t.at; t.fn(); } now = end; };

let games = 0, claims = 0, steals = 0, surprises = 0;
for (let g = 0; g < 120; g++) {
  const isl = new Island('T', () => {}, clock);
  const n = 1 + (g % 10);
  for (let i = 0; i < n; i++) assert.strictEqual(isl.join('p' + i, 'Kid' + i, '🦄'), null);
  assert.strictEqual(isl.join('dup', 'kid0', '🐱'), 'err.nameTaken');
  isl.setSettings({ minutes: [3, 5, 8][g % 3], steal: g % 4 !== 0, mode: g % 2 ? 'type' : 'choices', lang: g % 2 ? 'el' : 'en', ops: { missing: true, big: g % 3 === 0 } });
  assert.strictEqual(isl.start(), null);
  const land = isl.tiles.filter((t) => t.land).length;
  assert(land > 60, 'island too small: ' + land);
  const secret = isl.tiles.filter((t) => t.surprise).length;
  assert(secret > 0, 'no surprises');
  // nothing about surprises may reach the clients
  assert(!JSON.stringify(isl.view('p0')).includes('surprise'), 'surprise leaked');
  if (g === 5) assert.strictEqual(isl.join('late', 'Late', '🐢'), null), assert(isl.P('late').q, 'late joiner has no question');
  while (isl.phase === 'playing') {
    for (const p of isl.players) {
      const before = p.coins, q = p.q;
      const right = rng() < 0.75;
      assert.strictEqual(isl.answer(p.id, right ? q.answer : q.answer + 1).ok, true);
      if (right) assert(p.coins - before >= 10 && p.coins - before <= 20, 'gain out of range');
      else assert.strictEqual(p.coins, before, 'wrong answer changed coins');
      assert.notStrictEqual(p.q, q, 'no new question');
      if (rng() < 0.4) {
        const t = isl.tiles[Math.floor(rng() * isl.tiles.length)];
        const owner = t.owner, coins = p.coins, hadSurprise = !!t.surprise;
        const err = isl.claim(p.id, isl.tiles.indexOf(t));
        if (!err) {
          claims++;
          if (owner) { steals++; assert(isl.settings.steal, 'stole with stealing off'); }
          if (hadSurprise) surprises++;
          assert.strictEqual(t.owner, p.id);
        } else {
          assert.strictEqual(t.owner, owner, 'failed claim changed owner');
          assert.strictEqual(p.coins, coins, 'failed claim changed coins');
          if (owner && owner !== p.id && isl.settings.steal && now < t.shieldUntil) assert.strictEqual(err, 'err.shield');
        }
      }
      assert(p.coins >= 0, 'negative coins');
    }
    tick(700 + Math.floor(rng() * 2500));
  }
  assert.strictEqual(isl.phase, 'final');
  assert(isl.players.every((p) => !p.q), 'questions after the end');
  assert.strictEqual(isl.answer('p0', 1).error, 'err.notPlaying');
  for (const t of isl.tiles) if (t.owner) assert(isl.P(t.owner), 'tile owned by nobody');
  const r = isl.ranking();
  for (let i = 1; i < r.length; i++) assert(isl.score(r[i - 1]) >= isl.score(r[i]), 'ranking order');
  isl.backToLobby();
  assert(isl.players.every((p) => p.coins === 0 && p.wrong.length === 0), 'reset failed');
  games++;
}
// shields: a fresh claim can't be stolen for SHIELD_MS
{
  const isl = new Island('S', () => {}, clock);
  isl.join('a', 'A', '🦄'); isl.join('b', 'B', '🐱'); isl.start();
  const i = isl.tiles.findIndex((t) => t.land && t.kind === 'plain' && !t.surprise);
  isl.P('a').coins = 500; isl.P('b').coins = 500;
  assert.strictEqual(isl.claim('a', i), null);
  assert.strictEqual(isl.P('a').coins, 500 - COST.plain);
  assert.strictEqual(isl.claim('b', i), 'err.shield');
  tick(SHIELD_MS + 10);
  assert.strictEqual(isl.claim('b', i), null);
  assert.strictEqual(isl.P('b').coins, 500 - COST.steal);
  isl.removePlayer('b');
  assert.strictEqual(isl.tiles[i].owner, null, 'leaver kept land');
}
console.log(`OK — ${games} island games, ${claims} claims, ${steals} steals, ${surprises} surprises found; rules held.`);
