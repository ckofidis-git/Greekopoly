// Plays many quizzes with a fake clock and random bots; checks the rules hold.
const assert = require('assert');
const { Quiz } = require('../games/quiz/quiz');
const { buildQuiz } = require('../games/quiz/questions');

let seed = 7; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// 1) Question generator: right answers, 4 distinct choices, no repeats, only chosen tables.
for (let i = 0; i < 2000; i++) {
  const tables = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(() => rng() < 0.5);
  const ops = { mul: rng() < 0.7, div: rng() < 0.7, missing: rng() < 0.5, big: rng() < 0.3 };
  const qs = buildQuiz({ tables: tables.length ? tables : [7], ops, count: 20, lang: i % 2 ? 'el' : 'en' }, rng);
  assert(new Set(qs.map((q) => q.text)).size === qs.length, 'repeat question');
  for (const q of qs) {
    assert(Number.isInteger(q.answer) && q.answer > 0, 'bad answer ' + q.text);
    assert.strictEqual(new Set(q.choices).size, 4, 'choices not distinct ' + q.text);
    assert(q.choices.includes(q.answer), 'answer missing ' + q.text);
    assert(q.choices.every((c) => Number.isInteger(c) && c > 0), 'bad choice ' + q.text + ' ' + q.choices);
    // check the maths in the text
    const t = q.text.replace(/[,.]/g, ''); // thousands separators: 1,000 (English) or 1.000 (Greek)
    let m;
    if ((m = t.match(/^(\d+) × (\d+)$/))) assert.strictEqual(+m[1] * +m[2], q.answer, q.text);
    else if ((m = t.match(/^(\d+) ÷ (\d+)$/))) assert.strictEqual(+m[1] / +m[2], q.answer, q.text);
    else if ((m = t.match(/^□ × (\d+) = (\d+)$/))) assert.strictEqual(+m[2] / +m[1], q.answer, q.text);
    else if ((m = t.match(/^(\d+) × □ = (\d+)$/))) assert.strictEqual(+m[2] / +m[1], q.answer, q.text);
    else throw new Error('unparsed ' + q.text);
  }
}

// 2) Full games with a fake clock.
let now = 0; const timers = [];
const clock = { rng, now: () => now, schedule: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t; }, cancel: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); } };
const tick = (ms) => { const end = now + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers[0]; if (!t || t.at > end) break; timers.shift(); now = t.at; t.fn(); } now = end; };

for (let g = 0; g < 200; g++) {
  const quiz = new Quiz('T', () => {}, clock);
  const n = 1 + (g % 12);
  for (let i = 0; i < n; i++) assert.strictEqual(quiz.join('p' + i, 'Kid' + i, '🦄'), null);
  assert.strictEqual(quiz.join('x', 'kid0', '🐱'), 'err.nameTaken', 'duplicate name allowed');
  quiz.setSettings({ count: [5, 10, 15, 20][g % 4], time: [10, 15, 20, 30][g % 4], mode: g % 2 ? 'type' : 'choices', ops: { missing: true } });
  assert.strictEqual(quiz.start(), null);
  const shown = new Set();
  while (quiz.phase !== 'final') {
    if (quiz.phase === 'question' && !shown.has(quiz.qi)) {
      shown.add(quiz.qi);
      const view = quiz.view('p0');
      assert.strictEqual(view.question.answer, undefined, 'answer leaked during question');
      for (const p of quiz.players) {
        if (rng() < 0.15) continue; // some kids don't answer in time
        tick(Math.floor(rng() * 3000));
        if (quiz.phase !== 'question') break;
        const right = rng() < 0.7;
        assert.strictEqual(quiz.answer(p.id, right ? quiz.q.answer : quiz.q.answer + 1), null);
        assert(quiz.answer(p.id, 1), 'double answer allowed');
      }
    }
    tick(1000);
  }
  assert.strictEqual(shown.size, quiz.questions.length, 'skipped a question');
  for (const p of quiz.players) {
    const sum = p.answers.reduce((s, a) => s + a.points, 0);
    assert.strictEqual(sum, p.score, 'score mismatch');
    assert(p.answers.every((a) => (a.correct ? a.points >= 500 && a.points <= 1100 : a.points === 0)), 'points out of range');
  }
  const r = quiz.ranking();
  for (let i = 1; i < r.length; i++) assert(r[i - 1].score >= r[i].score, 'ranking order');
  quiz.backToLobby();
  assert(quiz.players.length === n && quiz.players.every((p) => p.score === 0), 'reset failed');
}
console.log('OK — 2000 quizzes generated in English and Greek (maths checked), 200 games played with a fake clock, all rules held.');
