// Question generator: times tables, division facts, missing numbers and ×/÷ by 10, 100, 1000.
// Pitched at Year 5 (age 9-10) in the English National Curriculum.

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const shuffle = (arr, rng) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const fmt = (n) => Number(n).toLocaleString('en-GB');

function makeQuestion(kind, tables, rng) {
  const t = pick(tables, rng);
  const n = 2 + Math.floor(rng() * 11); // 2..12
  const [a, b] = rng() < 0.5 ? [t, n] : [n, t];
  switch (kind) {
    case 'mul':
      return { kind, text: `${a} × ${b}`, answer: a * b, a, b };
    case 'div':
      return { kind, text: `${t * n} ÷ ${t}`, answer: n, a: t, b: n };
    case 'missing':
      return rng() < 0.5
        ? { kind, text: `□ × ${t} = ${t * n}`, answer: n, a: n, b: t }
        : { kind, text: `${t} × □ = ${t * n}`, answer: n, a: t, b: n };
    case 'big': {
      const p = pick([10, 100, 1000], rng);
      const x = 2 + Math.floor(rng() * 98); // 2..99
      return rng() < 0.5
        ? { kind, text: `${x} × ${fmt(p)}`, answer: x * p, p }
        : { kind, text: `${fmt(x * p)} ÷ ${fmt(p)}`, answer: x, p };
    }
    default:
      throw new Error('unknown kind ' + kind);
  }
}

// Plausible wrong answers: neighbouring facts, off-by-ten, place-value slips.
function distractors(q, rng) {
  const A = q.answer;
  const c = new Set();
  if (q.kind === 'mul') {
    [(q.a + 1) * q.b, (q.a - 1) * q.b, q.a * (q.b + 1), q.a * (q.b - 1), A + 10, A - 10, A + 1, A - 1].forEach((v) => c.add(v));
    const rev = Number(String(A).split('').reverse().join(''));
    if (A >= 10) c.add(rev);
  } else if (q.kind === 'big') {
    [A * 10, A / 10, A * 100, A / 100, A + q.p, A - q.p].forEach((v) => c.add(v));
  } else {
    [A + 1, A - 1, A + 2, A - 2, A + 3, q.a].forEach((v) => c.add(v));
  }
  const ok = [...c].filter((v) => Number.isInteger(v) && v > 0 && v !== A);
  const chosen = shuffle(ok, rng).slice(0, 3);
  let k = 4;
  while (chosen.length < 3) { if (!chosen.includes(A + k) && A + k !== A) chosen.push(A + k); k++; }
  return chosen;
}

function buildQuiz(settings, rng = Math.random) {
  const tables = settings.tables.length ? settings.tables : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const kinds = [];
  if (settings.ops.mul) kinds.push('mul');
  if (settings.ops.div) kinds.push('div');
  if (settings.ops.missing) kinds.push('missing');
  if (settings.ops.big) kinds.push('big');
  if (!kinds.length) kinds.push('mul');
  const seen = new Set();
  const out = [];
  for (let tries = 0; out.length < settings.count && tries < 5000; tries++) {
    const q = makeQuestion(pick(kinds, rng), tables, rng);
    if (seen.has(q.text)) continue;
    seen.add(q.text);
    q.choices = shuffle([q.answer, ...distractors(q, rng)], rng);
    out.push(q);
  }
  return out;
}

module.exports = { buildQuiz, makeQuestion, distractors };
