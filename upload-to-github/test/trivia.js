// Bots play Trivia Pursuit with a fake clock and a made-up question bank; checks turns, votes, steals, wedges and admin tools.
// Also checks every real question file: well formed, 4 different answers, both languages present.
const assert = require('assert');
const path = require('path');
const { Trivia, CATS, loadBank, PTS } = require('../games/trivia/trivia');

let seed = 21; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let now = 0; const timers = [];
const clock = { rng, now: () => now, schedule: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t; }, cancel: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); } };
const tick = (ms) => { const end = now + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers[0]; if (!t || t.at > end) break; timers.shift(); now = t.at; t.fn(); } now = end; };

// made-up bank: 5 questions per audience/level/category
const fake = {};
for (const aud of ['greece', 'world']) for (const lvl of ['kids', 'adults']) for (const cat of CATS) {
  fake[`${aud}-${lvl}-${cat}`] = Array.from({ length: 5 }, (_, i) => ({ id: `${aud}${lvl}${cat}${i}`, cat, q: { en: `Q${i}?`, el: `Ε${i};` }, a: [0, 1, 2, 3].map((k) => ({ en: `A${k}`, el: `Α${k}` })), fact: { en: 'f', el: 'φ' } }));
}

let games = 0, wedgesWon = 0, steals = 0, overrides = 0, moves = 0;
for (let g = 0; g < 200; g++) {
  const tv = new Trivia('T', () => {}, { ...clock, questions: fake });
  const n = 1 + (g % 11);
  for (let i = 0; i < n; i++) assert.strictEqual(tv.join('p' + i, 'Kid' + i, '🦄'), null);
  tv.setSettings({ mode: g % 3 === 0 ? 'solo' : 'teams', teamCount: 2 + (g % 5), wedges: [3, 4, 6][g % 3], steal: g % 4 !== 0, audience: g % 2 ? 'world' : 'greece', level: g % 5 ? 'kids' : 'adults' });
  assert.strictEqual(tv.start(), null);
  // every player is in exactly one team; team sizes differ by at most one
  const all = tv.teams.flatMap((t) => t.members);
  assert.strictEqual(new Set(all).size, n, 'player missing or in two teams');
  const sizes = tv.teams.map((t) => t.members.length);
  assert(Math.max(...sizes) - Math.min(...sizes) <= 1, 'unbalanced teams');
  if (g === 7) { assert.strictEqual(tv.join('late', 'Late', '🐢'), null); assert(tv.teamOf('late'), 'late joiner has no team'); }
  let steps = 0;
  while (tv.phase !== 'final' && steps++ < 5000) {
    if (tv.phase === 'choose') {
      const cap = tv.turnTeam.captain;
      assert.strictEqual(tv.choose('nobody', CATS[0]), 'err.captainOnly');
      assert.strictEqual(tv.choose(cap, tv.missing(tv.turnTeam)[0] || CATS[0]), null);
    }
    if (tv.phase === 'question') {
      const t = tv.turnTeam, q = tv.question;
      assert(!JSON.stringify(tv.view('p0').question).includes('"correct":'), 'answer leaked');
      const other = tv.teams.find((x) => x !== t);
      if (other) assert.strictEqual(tv.vote(other.members[0], 0), 'err.notYourTeam');
      for (const m of t.members) if (tv.phase === 'question' && rng() < 0.8) tv.vote(m, rng() < 0.6 ? q.correct : (q.correct + 1) % 4);
      if (tv.phase === 'question' && t.members.length > 1) {
        const notCap = t.members.find((m) => m !== t.captain);
        if (notCap) assert.strictEqual(tv.finalAnswer(notCap, 0), 'err.captainOnly');
        if (rng() < 0.7) tv.finalAnswer(t.captain, rng() < 0.6 ? q.correct : (q.correct + 2) % 4);
      }
      const wedgesBefore = t.wedges.length, cat = q.cat;
      if (tv.phase === 'question') tick(tv.settings.timer * 1000 + 10);
      if (tv.result && tv.result.turnRight) { assert(t.wedges.includes(cat)); if (t.wedges.length > wedgesBefore) wedgesWon++; }
    }
    if (tv.phase === 'steal') {
      assert(tv.settings.steal, 'steal with steals off');
      const q = tv.question;
      for (const id of tv.stealers) {
        const s = tv.T(id);
        if (tv.turnPick !== null) assert.strictEqual(tv.vote(s.captain, tv.turnPick), 'err.alreadyWrong');
        if (tv.phase === 'steal' && s.final === null) tv.finalAnswer(s.captain, rng() < 0.5 ? q.correct : [0, 1, 2, 3].find((x) => x !== q.correct && x !== tv.turnPick));
      }
      if (tv.phase === 'steal') tick(16000);
      steals += tv.result.stealRight.length;
    }
    if (tv.phase === 'reveal' && rng() < 0.05) {
      const t = tv.turnTeam, before = t.points, was = tv.result.turnRight;
      assert.strictEqual(tv.admin('override'), null);
      assert.strictEqual(tv.result.turnRight, !was);
      assert.strictEqual(t.points, !was ? before + PTS.correct : Math.max(0, before - PTS.correct));
      overrides++;
    }
    if (tv.phase === 'spin' && rng() < 0.08 && tv.settings.mode === 'teams' && tv.players.length > 2) {
      const p = tv.players[Math.floor(rng() * tv.players.length)], to = tv.teams.find((x) => !x.members.includes(p.id));
      if (to) { assert.strictEqual(tv.admin('move', { playerId: p.id, teamId: to.id }), null); moves++; }
      assert.strictEqual(tv.admin('rename', { teamId: tv.teams[0].id, name: 'Stars' }), null);
      assert.strictEqual(new Set(tv.teams.flatMap((t) => t.members)).size, tv.players.length, 'move lost a player');
      assert(tv.teams.every((t) => t.members.length), 'empty team left in play');
    }
    tick(1000);
  }
  assert.strictEqual(tv.phase, 'final', 'game did not end');
  assert(tv.ranking()[0].wedges.length >= tv.settings.wedges, 'winner without enough wedges');
  games++;
}
// pause, extend and skip
{
  const tv = new Trivia('P', () => {}, { ...clock, questions: fake });
  tv.join('a', 'A', '🦄'); tv.join('b', 'B', '🐱'); tv.setSettings({ mode: 'solo' }); tv.start();
  tick(5000); if (tv.phase === 'choose') tv.choose(tv.turnTeam.captain, 'geo');
  assert.strictEqual(tv.phase, 'question');
  assert.strictEqual(tv.admin('pause'), null);
  tick(120000);
  assert.strictEqual(tv.phase, 'question', 'timer ran while paused');
  assert.strictEqual(tv.admin('pause'), null);
  assert.strictEqual(tv.admin('extend'), null);
  const qid = tv.question.id;
  assert.strictEqual(tv.admin('skip'), null);
  assert.notStrictEqual(tv.question.id, qid, 'skip kept the same question');
}
// the real question files: well formed, both languages, 4 distinct answers
const real = loadBank(path.join(__dirname, '..', 'games', 'trivia', 'questions'));
let realCount = 0;
const texts = new Set();
for (const [key, list] of Object.entries(real)) {
  for (const q of list) {
    realCount++;
    for (const l of ['en', 'el']) {
      assert(q.q[l] && q.q[l].trim(), `${q.id}: missing ${l} question`);
      assert(q.fact && q.fact[l], `${q.id}: missing ${l} fact`);
      const ans = q.a.map((x) => (x[l] || '').trim().toLowerCase());
      assert(ans.every(Boolean), `${q.id}: empty ${l} answer`);
      assert.strictEqual(new Set(ans).size, 4, `${q.id}: duplicate ${l} answers: ${ans.join(' | ')}`);
    }
    assert(/[α-ωάέήίόύώ]/i.test(q.q.el), `${q.id}: Greek question is not in Greek`);
    texts.add(key + q.q.en.toLowerCase());
  }
}
console.log(`OK — ${games} trivia games, ${wedgesWon} wedges won, ${steals} steals, ${overrides} admin overrides, ${moves} player moves; pause/extend/skip work; ${realCount} real questions checked.`);
