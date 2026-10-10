// Bots fight monsters with a fake clock; checks damage, knockouts, ranking and the timer.
const assert = require('assert');
const { Battle } = require('../games/monster/battle');

let seed = 5; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let now = 0; const timers = [];
const clock = { rng, now: () => now, schedule: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t; }, cancel: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); } };
const tick = (ms) => { const end = now + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers[0]; if (!t || t.at > end) break; timers.shift(); now = t.at; t.fn(); } now = end; };

let kos = 0, crits = 0;
for (let g = 0; g < 120; g++) {
  const b = new Battle('T', () => {}, clock);
  const n = 1 + (g % 12);
  for (let i = 0; i < n; i++) assert.strictEqual(b.join('p' + i, 'Kid' + i, '🦄'), null);
  b.setSettings({ minutes: [3, 5, 8][g % 3], mode: g % 2 ? 'type' : 'choices', lang: g % 2 ? 'el' : 'en', ops: { missing: true } });
  assert.strictEqual(b.start(), null);
  let lastMax = 0;
  while (b.phase === 'playing') {
    for (const p of b.players) {
      const before = p.dmg, hp = b.monster.hp, mon = b.monster.n, q = p.q;
      const right = rng() < 0.75;
      assert.strictEqual(b.answer(p.id, right ? q.answer : q.answer + 1).ok, true);
      const d = p.dmg - before;
      if (right) {
        assert(d >= 10 && d <= 40, 'damage out of range ' + d);
        if (p.last.crit) { crits++; assert.strictEqual(p.streak % 5, 0, 'crit off-streak'); }
        if (p.last.ko) { kos++; assert.strictEqual(b.monster.n, mon + 1, 'no new monster'); assert(b.monster.max > lastMax, 'next monster not tougher'); }
        else assert.strictEqual(b.monster.hp, hp - d, 'hp mismatch');
      } else assert.strictEqual(d, 0, 'miss did damage');
      lastMax = b.monster.max;
    }
    tick(800 + Math.floor(rng() * 3000));
  }
  assert.strictEqual(b.phase, 'final');
  assert.strictEqual(b.answer('p0', 1).error, 'err.notPlaying');
  assert.strictEqual(b.defeated.length, b.monster.n, 'defeated count');
  const r = b.ranking();
  for (let i = 1; i < r.length; i++) assert(r[i - 1].dmg >= r[i].dmg, 'ranking');
  assert.strictEqual(b.view().teamDmg, b.players.reduce((s, p) => s + p.dmg, 0));
  b.backToLobby();
  assert(b.players.every((p) => p.dmg === 0), 'reset');
}
console.log(`OK — 120 monster battles, ${kos} monsters beaten, ${crits} critical hits; rules held.`);
