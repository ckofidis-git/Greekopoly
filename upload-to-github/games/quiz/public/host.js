// Big screen: lobby with settings, then the quiz show itself.
const socket = io('/quiz');
let S = null, code = null, stageKey = '', lastTick = -1;

const joinUrl = () => `${location.origin}/quiz/play?g=${code}`;
const qrSrc = () => `/qr.svg?u=${encodeURIComponent(joinUrl())}`;
const hostDo = (type, extra = {}) => socket.emit('host:do', { type, ...extra }, (r) => r && r.error && toast(t(r.error)));

function boot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('ms_host') || 'null'); } catch (e) {}
  if (saved) socket.emit('host:resume', saved, (r) => (r.error ? create() : enter(r.code, r.state)));
  else create();
}
function create() {
  socket.emit('host:create', { lang: guessLang() }, (r) => {
    try { localStorage.setItem('ms_host', JSON.stringify({ code: r.code, hostKey: r.hostKey })); } catch (e) {}
    enter(r.code, r.state);
  });
}
function enter(c, state) {
  code = c; stageKey = ''; render(state);
  // Coming from the home page with a language picked: a quiz still in its lobby follows it.
  if (state.phase === 'lobby' && state.settings.lang !== guessLang()) sendSettings({ lang: guessLang() });
}
socket.on('connect', () => { if (code) boot(); });
socket.on('state', (s) => s.code === code && render(s));
boot();

// ---------- lobby ----------
const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const OPS = [['mul', 'opMul'], ['div', 'opDiv'], ['missing', 'opMissing'], ['big', 'opBig']];
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
    ? S.players.map((p) => `<span class="kid ${p.connected ? '' : 'off'}"><span class="a">${p.avatar}</span>${esc(p.name)}<button class="x" data-kick="${p.id}" title="${t('remove')}">✕</button></span>`).join('')
    : `<div class="waiting">${t('waitingKids')}</div>`;
  const st = S.settings;
  const sel = new Set(st.tables);
  $('#tables').innerHTML = TABLES.map((t) => `<button class="tbl ${sel.has(t) ? 'on' : ''}" data-t="${t}">${t}</button>`).join('') +
    `<button class="quick" data-q="all">${t('qAll')}</button><button class="quick" data-q="tricky">${t('qTricky')}</button><button class="quick" data-q="easy">${t('qEasy')}</button>`;
  $('#ops').innerHTML = OPS.map(([k, l]) => `<button class="${st.ops[k] ? 'on' : ''}" data-op="${k}">${t(l)}</button>`).join('');
  $('#mode').innerHTML = `<button class="${st.mode === 'choices' ? 'on' : ''}" data-mode="choices">${t('modeChoices')}</button><button class="${st.mode === 'type' ? 'on' : ''}" data-mode="type">${t('modeType')}</button>`;
  for (const b of $('#langPick').children) b.classList.toggle('sel', b.dataset.lang === LANG);
  $('#count').innerHTML = [5, 10, 15, 20].map((n) => `<button class="${st.count === n ? 'on' : ''}" data-count="${n}">${n}</button>`).join('');
  $('#time').innerHTML = [10, 15, 20, 30].map((n) => `<button class="${st.time === n ? 'on' : ''}" data-time="${n}">${n}s</button>`).join('');
  $('#startBtn').disabled = !S.players.length;
  $('#startBtn').textContent = S.players.length ? t('start', { n: S.players.length }) : t('waitingPlayers');
}

$('#kids').onclick = (e) => { const id = e.target.dataset.kick; if (id) hostDo('kick', { playerId: id }); };
$('#lobby').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !S) return;
  const st = S.settings, d = b.dataset;
  if (d.t) {
    const tb = Number(d.t), set = new Set(st.tables);
    set.has(tb) ? set.delete(tb) : set.add(tb);
    if (!set.size) return toast(t('pickTable'));
    sendSettings({ tables: [...set] });
  } else if (d.q) sendSettings({ tables: { all: TABLES, tricky: [6, 7, 8, 9, 12], easy: [2, 5, 10] }[d.q] });
  else if (d.op) {
    const ops = { ...st.ops, [d.op]: !st.ops[d.op] };
    if (!Object.values(ops).some(Boolean)) return toast(t('pickType'));
    sendSettings({ ops });
  } else if (d.mode) sendSettings({ mode: d.mode });
  else if (d.count) sendSettings({ count: Number(d.count) });
  else if (d.time) sendSettings({ time: Number(d.time) });
  else if (d.lang) setLang(d.lang);
});
$('#startBtn').onclick = () => { beep([523, 659, 784, 1046], 0.1); hostDo('start', { settings: S.settings }); };
function setLang(lang) {
  try { localStorage.setItem('hub_lang', lang); } catch (e) {}
  sendSettings({ lang });
}
$('#langBtn').onclick = () => setLang(LANG === 'el' ? 'en' : 'el');
$('#newBtn').onclick = () => askConfirm(t('newCodeQ'), t('newCodeYes'), () => { localStorage.removeItem('ms_host'); create(); });

// ---------- show ----------
function avatarsHTML(list) { return list.map((p) => `<span title="${esc(p.name)}">${p.avatar}</span>`).join(''); }

function choicesHTML(reveal) {
  const q = S.question;
  if (!q.choices) return `<div class="stat">${t('typeOnPhone')}</div>`;
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
    st.innerHTML = `<div class="ready">${t('getReady', { total: S.total })}</div><div class="count" id="cd">3</div>`;
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
    $('#ansCount').textContent = t('answeredCount', { n: answered.length, total: S.players.length });
    $('#ansList').innerHTML = avatarsHTML(answered);
    runTimerBar($('#bar'), (left) => {
      const s = Math.min(S.settings.time, Math.ceil(left / 1000)); // the server adds a short grace period
      $('#secs') && ($('#secs').textContent = s ? t('secs', { n: s }) : t('timeUp'));
      if (s <= 3 && s > 0 && s !== lastTick) { lastTick = s; beep([880], 0.06, 'square'); }
    });
  } else if (S.phase === 'reveal') {
    if (!fresh) return;
    const q = S.question;
    const shown = q.text.includes('□') ? q.text.replace('□', `<span class="ans">${num(q.answer)}</span>`) : `${esc(q.text)} = <span class="ans">${num(q.answer)}</span>`;
    const got = S.players.filter((p) => p.lastPoints > 0);
    st.innerHTML = `<div class="qtext">${shown}</div>${choicesHTML(true)}
      <div class="stat">${got.length === S.players.length ? t('everyone') : got.length ? t('someGot', { n: got.length, total: S.players.length }) : t('nobody')}</div>
      <div class="answered">${avatarsHTML(got)}</div>`;
    beep(got.length ? [659, 784, 1046] : [392, 330], 0.1);
  } else if (S.phase === 'board') {
    if (!fresh) return;
    st.innerHTML = `<div class="ready">${t('leaderboard')}</div>${boardHTML(Math.min(6, S.players.length))}
      <div class="stat" style="opacity:.85">${t('nextQ', { n: S.qi + 2, total: S.total })}</div>`;
  } else if (S.phase === 'final') {
    if (!fresh) return;
    const [a, b, c] = S.players;
    const pod = (p, n) => (p ? `<div class="pod p${n}" style="animation-delay:${(3 - n) * 0.5}s"><div class="av">${p.avatar}</div><div class="nm">${esc(p.name)}</div><div class="sc">${t('pts', { n: num(p.score) })}</div><div class="block">${n === 1 ? '👑' : n}</div></div>` : '<div class="pod"></div>');
    const hard = S.hardest || [];
    st.innerHTML = `<div class="ready">${t('superstar', { name: a ? esc(a.name) : '' })}</div>
      <div class="podium">${pod(b, 2)}${pod(a, 1)}${pod(c, 3)}</div>
      <div class="final-row">
        <div class="panel"><h3 style="margin:0 0 6px">${t('everyoneH')}</h3><div class="rest">${S.players.map((p) => `<div><b>${ordinal(p.rank)}</b> ${p.avatar} ${esc(p.name)}<span class="grow"></span><b>${num(p.score)}</b></div>`).join('')}</div></div>
        <div class="panel"><h3 style="margin:0 0 6px">${t('trickyH')}</h3><div class="hard">${hard.length ? hard.map((h) => `<div><span>${esc(h.text.includes('□') ? h.text.replace('□', h.answer) : `${h.text} = ${num(h.answer)}`)}</span><span class="muted">${t('gotIt', { r: h.right, t: h.tried })}</span></div>`).join('') : `<div>${t('allRight')}</div>`}</div></div>
      </div>
      <div class="row"><button class="btn-gold big" id="againBtn">${t('again')}</button></div>`;
    $('#againBtn').onclick = () => hostDo('lobby');
    confetti(120);
    beep([523, 659, 784, 1046, 1318], 0.14);
  }
}

function render(state) {
  S = state;
  if (useLang(S.settings.lang)) {
    stageKey = ''; // redraw the stage in the new language
    document.title = `${t('titlePlain')} — ${t('bigScreen')}`;
    $('#soundBtn').textContent = t(soundOn ? 'soundOn' : 'soundOff');
    $('#langBtn').textContent = LANG === 'el' ? '🇬🇧 English' : '🇬🇷 Ελληνικά';
  }
  if (S.phase === 'lobby') { stageKey = ''; return renderLobby(); }
  $('#lobby').classList.add('hidden');
  $('#show').classList.remove('hidden');
  $('#qrSmall').src = qrSrc();
  $('#codeSmall').textContent = code;
  $('#qnum').textContent = S.phase === 'final' ? t('final') : t('qnum', { n: Math.max(1, S.qi + 1), total: S.total });
  $('#skipBtn').classList.toggle('hidden', S.phase === 'final');
  $('#endBtn').classList.toggle('hidden', S.phase === 'final');
  renderStage();
}

$('#skipBtn').onclick = () => hostDo('skip');
$('#endBtn').onclick = () => askConfirm(t('endQ'), t('end'), () => hostDo('end'));
$('#fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$('#soundBtn').onclick = (e) => { soundOn = !soundOn; e.target.textContent = t(soundOn ? 'soundOn' : 'soundOff'); };
