// Big screen: lobby with settings, then the quiz show itself.
const socket = io('/quiz');
let S = null, code = null, stageKey = '', lastTick = -1;

const joinUrl = () => `${location.origin}/quiz/play?g=${code}`;
const qrSrc = () => `/qr.svg?u=${encodeURIComponent(joinUrl())}`;
const hostDo = (type, extra = {}) => socket.emit('host:do', { type, ...extra }, (r) => r && r.error && toast(r.error));

function boot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('ms_host') || 'null'); } catch (e) {}
  if (saved) socket.emit('host:resume', saved, (r) => (r.error ? create() : enter(r.code, r.state)));
  else create();
}
function create() {
  socket.emit('host:create', {}, (r) => {
    try { localStorage.setItem('ms_host', JSON.stringify({ code: r.code, hostKey: r.hostKey })); } catch (e) {}
    enter(r.code, r.state);
  });
}
function enter(c, state) { code = c; stageKey = ''; render(state); }
socket.on('connect', () => { if (code) boot(); });
socket.on('state', (s) => s.code === code && render(s));
boot();

// ---------- lobby ----------
const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const OPS = [['mul', '✖️ Multiply'], ['div', '➗ Divide'], ['missing', '□ Missing number'], ['big', '💯 × ÷ 10, 100, 1000']];
function sendSettings(change) {
  const s = { ...S.settings, ops: { ...S.settings.ops }, ...change };
  hostDo('settings', { settings: s });
}

function renderLobby() {
  $('#lobby').classList.remove('hidden');
  $('#show').classList.add('hidden');
  $('#qr').src = qrSrc();
  $('#code').textContent = code;
  $('#url').textContent = joinUrl();
  $('#kids').innerHTML = S.players.length
    ? S.players.map((p) => `<span class="kid ${p.connected ? '' : 'off'}"><span class="a">${p.avatar}</span>${esc(p.name)}<button class="x" data-kick="${p.id}" title="Remove">✕</button></span>`).join('')
    : '<div class="waiting">Waiting for superstars to join… ✨</div>';
  const st = S.settings;
  const sel = new Set(st.tables);
  $('#tables').innerHTML = TABLES.map((t) => `<button class="tbl ${sel.has(t) ? 'on' : ''}" data-t="${t}">${t}</button>`).join('') +
    `<button class="quick" data-q="all">All</button><button class="quick" data-q="tricky">Tricky: 6 7 8 9 12</button><button class="quick" data-q="easy">Starter: 2 5 10</button>`;
  $('#ops').innerHTML = OPS.map(([k, l]) => `<button class="${st.ops[k] ? 'on' : ''}" data-op="${k}">${l}</button>`).join('');
  $('#mode').innerHTML = `<button class="${st.mode === 'choices' ? 'on' : ''}" data-mode="choices">🍓 Pick from 4</button><button class="${st.mode === 'type' ? 'on' : ''}" data-mode="type">⌨️ Type the answer</button>`;
  $('#count').innerHTML = [5, 10, 15, 20].map((n) => `<button class="${st.count === n ? 'on' : ''}" data-count="${n}">${n}</button>`).join('');
  $('#time').innerHTML = [10, 15, 20, 30].map((n) => `<button class="${st.time === n ? 'on' : ''}" data-time="${n}">${n}s</button>`).join('');
  $('#startBtn').disabled = !S.players.length;
  $('#startBtn').textContent = S.players.length ? `🚀 Start the quiz! (${S.players.length} player${S.players.length > 1 ? 's' : ''})` : '🚀 Waiting for players…';
}

$('#kids').onclick = (e) => { const id = e.target.dataset.kick; if (id) hostDo('kick', { playerId: id }); };
$('#lobby').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !S) return;
  const st = S.settings, d = b.dataset;
  if (d.t) {
    const t = Number(d.t), set = new Set(st.tables);
    set.has(t) ? set.delete(t) : set.add(t);
    if (!set.size) return toast('Pick at least one times table!');
    sendSettings({ tables: [...set] });
  } else if (d.q) sendSettings({ tables: { all: TABLES, tricky: [6, 7, 8, 9, 12], easy: [2, 5, 10] }[d.q] });
  else if (d.op) {
    const ops = { ...st.ops, [d.op]: !st.ops[d.op] };
    if (!Object.values(ops).some(Boolean)) return toast('Pick at least one question type!');
    sendSettings({ ops });
  } else if (d.mode) sendSettings({ mode: d.mode });
  else if (d.count) sendSettings({ count: Number(d.count) });
  else if (d.time) sendSettings({ time: Number(d.time) });
});
$('#startBtn').onclick = () => { beep([523, 659, 784, 1046], 0.1); hostDo('start', { settings: S.settings }); };
$('#newBtn').onclick = () => askConfirm('Make a new game code? Everyone will need to scan again.', 'Yes, new code', () => { localStorage.removeItem('ms_host'); create(); });

// ---------- show ----------
function avatarsHTML(list) { return list.map((p) => `<span title="${esc(p.name)}">${p.avatar}</span>`).join(''); }

function choicesHTML(reveal) {
  const q = S.question;
  if (!q.choices) return `<div class="stat">⌨️ Type your answer on your phone!</div>`;
  return `<div class="choices">${q.choices.map((c, i) => {
    const cls = reveal ? (c === q.answer ? 'good' : 'dim') : '';
    return `<div class="fruit f${i} ${cls}"><span class="fe">${FRUITS[i]}</span>${num(c)}${reveal ? `<span class="n">${S.counts[i]} ✋</span>` : ''}${reveal && c === q.answer ? ' ✓' : ''}</div>`;
  }).join('')}</div>`;
}

function boardHTML(limit) {
  return `<div class="board">${S.players.slice(0, limit).map((p, i) => `
    <div class="bar" style="animation-delay:${i * 0.08}s"><span class="rk">${ordinal(p.rank)}</span><span class="av">${p.avatar}</span>${esc(p.name)}
      ${p.streak >= 3 ? `<span title="streak">🔥${p.streak}</span>` : ''}<span class="pts">${num(p.score)}${p.lastPoints ? `<span class="plus">+${num(p.lastPoints)}</span>` : ''}</span></div>`).join('')}</div>`;
}

function renderStage() {
  const st = $('#stage');
  const key = S.phase + ':' + S.qi;
  const fresh = key !== stageKey;
  stageKey = key;
  const answered = S.players.filter((p) => p.answered);

  if (S.phase === 'countdown') {
    if (!fresh) return;
    st.innerHTML = `<div class="ready">Get ready! Question 1 of ${S.total} 🚀</div><div class="count" id="cd">3</div>`;
    syncTimer(S, 3000);
    runTimerBar(null, (left) => {
      const n = Math.max(1, Math.ceil((left - 500) / 1000));
      const el = $('#cd');
      if (el && el.textContent !== String(n)) { el.textContent = n; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; beep([440], 0.12); }
    });
    beep([440], 0.12);
  } else if (S.phase === 'question') {
    syncTimer(S, S.questionMs);
    if (fresh) {
      st.innerHTML = `<div class="timer" id="bar"><i></i></div><div class="secs" id="secs"></div>
        <div class="qtext">${esc(S.question.text)} ${S.question.text.includes('=') ? '' : '= ?'}</div>
        ${choicesHTML(false)}
        <div class="stat" id="ansCount"></div><div class="answered" id="ansList"></div>`;
      beep([784, 988], 0.08);
    }
    $('#ansCount').textContent = `✋ ${answered.length} of ${S.players.length} answered`;
    $('#ansList').innerHTML = avatarsHTML(answered);
    runTimerBar($('#bar'), (left) => {
      const s = Math.ceil(left / 1000);
      $('#secs') && ($('#secs').textContent = s ? `${s}s` : "Time's up!");
      if (s <= 3 && s > 0 && s !== lastTick) { lastTick = s; beep([880], 0.06, 'square'); }
    });
  } else if (S.phase === 'reveal') {
    if (!fresh) return;
    const q = S.question;
    const shown = q.text.includes('□') ? q.text.replace('□', `<span class="ans">${num(q.answer)}</span>`) : `${esc(q.text)} = <span class="ans">${num(q.answer)}</span>`;
    const got = S.players.filter((p) => p.lastPoints > 0);
    st.innerHTML = `<div class="qtext">${shown}</div>${choicesHTML(true)}
      <div class="stat">${got.length === S.players.length ? '🎉 Everyone got it! Amazing!' : got.length ? `🎉 ${got.length} of ${S.players.length} got it right!` : '😮 Tricky one! Nobody got it this time.'}</div>
      <div class="answered">${avatarsHTML(got)}</div>`;
    beep(got.length ? [659, 784, 1046] : [392, 330], 0.1);
  } else if (S.phase === 'board') {
    if (!fresh) return;
    st.innerHTML = `<div class="ready">⭐ Leaderboard ⭐</div>${boardHTML(Math.min(6, S.players.length))}
      <div class="stat" style="opacity:.85">Next: question ${S.qi + 2} of ${S.total}</div>`;
  } else if (S.phase === 'final') {
    if (!fresh) return;
    const [a, b, c] = S.players;
    const pod = (p, n) => (p ? `<div class="pod p${n}" style="animation-delay:${(3 - n) * 0.5}s"><div class="av">${p.avatar}</div><div class="nm">${esc(p.name)}</div><div class="sc">${num(p.score)} pts</div><div class="block">${n === 1 ? '👑' : n}</div></div>` : '<div class="pod"></div>');
    const hard = S.hardest || [];
    st.innerHTML = `<div class="ready">🌟 Our Maths Superstar is… ${a ? esc(a.name) : ''}! 🌟</div>
      <div class="podium">${pod(b, 2)}${pod(a, 1)}${pod(c, 3)}</div>
      <div class="final-row">
        <div class="panel"><h3 style="margin:0 0 6px">🏅 Everyone</h3><div class="rest">${S.players.map((p) => `<div><b>${ordinal(p.rank)}</b> ${p.avatar} ${esc(p.name)}<span class="grow"></span><b>${num(p.score)}</b></div>`).join('')}</div></div>
        <div class="panel"><h3 style="margin:0 0 6px">🧠 Tricky ones to practise</h3><div class="hard">${hard.length ? hard.map((h) => `<div><span>${esc(h.text.includes('□') ? h.text.replace('□', h.answer) : `${h.text} = ${num(h.answer)}`)}</span><span class="muted">${h.right} of ${h.tried} got it</span></div>`).join('') : '<div>Everyone got everything right! 🎉</div>'}</div></div>
      </div>
      <div class="row"><button class="btn-gold big" id="againBtn">🔁 Play again (same players)</button></div>`;
    $('#againBtn').onclick = () => hostDo('lobby');
    confetti(120);
    beep([523, 659, 784, 1046, 1318], 0.14);
  }
}

function render(state) {
  S = state;
  if (S.phase === 'lobby') { stageKey = ''; return renderLobby(); }
  $('#lobby').classList.add('hidden');
  $('#show').classList.remove('hidden');
  $('#qrSmall').src = qrSrc();
  $('#codeSmall').textContent = code;
  $('#qnum').textContent = S.phase === 'final' ? '🏁 Final results' : `Question ${Math.max(1, S.qi + 1)} of ${S.total}`;
  $('#skipBtn').classList.toggle('hidden', S.phase === 'final');
  $('#endBtn').classList.toggle('hidden', S.phase === 'final');
  renderStage();
}

$('#skipBtn').onclick = () => hostDo('skip');
$('#endBtn').onclick = () => askConfirm('End the quiz now and show the winners?', '🏁 End quiz', () => hostDo('end'));
$('#fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$('#soundBtn').onclick = (e) => { soundOn = !soundOn; e.target.textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off'; };
