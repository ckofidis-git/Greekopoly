// Bots play bingo with a fake clock; checks calls, marking, lines, scores and fairness.
const assert = require('assert');
const { Bingo, PTS, questionsFor, answerPool, lines } = require('../games/bingo/bingo');

let seed = 9; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let now = 0; const timers = [];
const clock = { rng, now: () => now, schedule: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t; }, cancel: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); } };
const tick = (ms) => { const end = now + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers[0]; if (!t || t.at > end) break; timers.shift(); now = t.at; t.fn(); } now = end; };
const solve = (text) => { let m; if ((m = text.match(/^□ × (\d+) = (\d+)$/)) || (m = text.match(/^(\d+) × □ = (\d+)$/))) return +m[2] / +m[1]; if ((m = text.match(/^(\d+) × (\d+)$/))) return +m[1] * +m[2]; if ((m = text.match(/^(\d+) ÷ (\d+)$/))) return +m[1] / +m[2]; throw new Error(text); };

// every way to make every answer really makes it
for (let i = 0; i < 300; i++) {
  const tables = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(() => rng() < 0.5);
  const ops = { mul: rng() < 0.8, div: rng() < 0.6, missing: rng() < 0.4 };
  if (!tables.length || !Object.values(ops).some(Boolean)) continue;
  for (const v of answerPool(tables, ops)) {
    const qs = questionsFor(v, tables, ops);
    assert(qs.length, 'no question for ' + v);
    for (const q of qs) assert.strictEqual(solve(q), v, q);
  }
}

let games = 0, fulls = 0, bingos = 0;
for (let g = 0; g < 150; g++) {
  const b = new Bingo('T', () => {}, clock);
  const n = 1 + (g % 10);
  for (let i = 0; i < n; i++) assert.strictEqual(b.join('p' + i, 'Kid' + i, '🦄'), null);
  const tables = g % 7 === 0 ? [2] : g % 5 === 0 ? [6, 7, 8] : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  b.setSettings({ tables, calls: [15, 25, 35][g % 3], secs: [8, 12, 15][g % 3], ops: { div: g % 2 === 0, missing: g % 3 === 0 } });
  assert.strictEqual(b.start(), null);
  for (const p of b.players) {
    assert.strictEqual(p.card.length, b.size * b.size);
    assert.strictEqual(new Set(p.card).size, p.card.length, 'duplicate numbers on a card');
  }
  assert(!JSON.stringify(b.view('p0').call).includes('answer"'), 'answer shown during call');
  let calls = 0;
  const seen = new Set();
  while (b.phase !== 'final') {
    if (b.phase === 'call' && !seen.has(b.ci)) {
      seen.add(b.ci);
      calls++;
      const c = b.call;
      assert.strictEqual(solve(c.text), c.answer, 'wrong call ' + c.text);
      for (const p of b.players) {
        const idx = p.card.indexOf(c.answer);
        const pts = p.points;
        if (idx >= 0 && !p.marked[idx] && rng() < 0.8) {
          tick(Math.floor(rng() * 4000));
          if (b.phase !== 'call' || b.call !== c) break; // the delay ran into the next call
          const res = b.mark(p.id, idx);
          assert.strictEqual(res.ok, true, 'mark failed: ' + res.error + ' marked=' + p.marked[idx] + ' lock=' + p.lockCall + ' ci=' + b.ci);
          assert(p.points - pts >= PTS.mark, 'mark scored too little');
          if (p.last.first) bingos++;
          assert.strictEqual(b.mark(p.id, idx).error, 'err.already');
        } else if (rng() < 0.3) {
          const wrong = p.card.findIndex((v, i) => v !== c.answer && !p.marked[i]);
          if (wrong >= 0) {
            b.mark(p.id, wrong);
            assert(p.points === Math.max(0, pts - PTS.wrong), 'wrong tap penalty');
            assert.strictEqual(b.mark(p.id, idx >= 0 ? idx : wrong).error, idx >= 0 && !p.marked[idx] ? 'err.locked' : (idx >= 0 ? 'err.already' : 'err.locked'));
          }
        }
        assert(p.points >= 0, 'negative points');
      }
    }
    tick(1000);
  }
  assert(calls <= b.settings.calls, 'too many calls');
  for (const p of b.players) {
    const shouldLines = lines(b.size).filter((L) => L.every((i) => p.marked[i])).length;
    assert.strictEqual(p.lines.length, shouldLines, 'line count');
    if (p.full) fulls++;
    assert.strictEqual(b.mark(p.id, 0).error, 'err.notCalling');
  }
  assert(b.players.some((p) => p.full) || calls === b.settings.calls, 'ended early without a full card');
  b.backToLobby();
  games++;
}
console.log(`OK — ${games} bingo games, ${bingos} first-bingos, ${fulls} full cards; every call's maths checked; rules held.`);
