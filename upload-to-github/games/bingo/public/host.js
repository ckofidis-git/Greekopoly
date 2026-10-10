// Big screen: lobby with settings, then the bingo caller, called history and leaderboard.
const socket = io('/bingo');
let S = null, code = null, lastEvent = 0, callKey = '', finalShown = false, lastTick = -1;

const joinUrl = () => `${location.origin}/bingo/play?g=${code}`;
const qrSrc = () => `/qr.svg?u=${encodeURIComponent(joinUrl())}`;
const hostDo = (type, extra = {}) => socket.emit('host:do', { type, ...extra }, (r) => r && r.error && toast(t(r.error)));
const fact = (text, answer) => (text.includes('□') ? text.replace('□', `<span class="ans">${num(answer)}</span>`) : `${esc(text)} = <span class="ans">${num(answer)}</span>`);

function boot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('tb_host') || 'null'); } catch (e) {}
  if (saved) socket.emit('host:resume', saved, (r) => (r.error ? create() : enter(r.code, r.state)));
  else create();
}
function create() {
  socket.emit('host:create', { lang: guessLang() }, (r) => {
    try { localStorage.setItem('tb_host', JSON.stringify({ code: r.code, hostKey: r.hostKey })); } catch (e) {}
    enter(r.code, r.state);
  });
}
function enter(c, state) {
  code = c; finalShown = state.phase === 'final';
  lastEvent = state.events.length ? state.events[state.events.length - 1].id : 0;
  render(state);
  if (state.phase === 'lobby' && state.settings.lang !== guessLang()) sendSettings({ lang: guessLang() });
}
socket.on('connect', () => { if (code) boot(); });
socket.on('state', (s) => s.code === code && render(s));
boot();
$('#clock').classList.add('hidden');

// ---------- lobby ----------
const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const OPS = [['mul', 'opMul'], ['div', 'opDiv'], ['missing', 'opMissing']];
function sendSettings(change) { hostDo('settings', { settings: { ...S.settings, ops: { ...S.settings.ops }, ...change } }); }
function setLang(lang) { try { localStorage.setItem('hub_lang', lang); } catch (e) {} sendSettings({ lang }); }

function renderLobby() {
  $('#lobby').classList.remove('hidden');
  $('#show').classList.add('hidden');
  $('#final').classList.add('hidden');
  $('#qr').src = qrSrc();
  $('#code').textContent = code;
  $('#url').textContent = joinUrl();
  $('#kids').innerHTML = S.players.length
    ? S.players.map((p) => `<span class="kid ${p.connected ? '' : 'off'}" style="--oc:${p.color}"><span class="a">${p.avatar}</span>${esc(p.name)}<button class="x" data-kick="${p.id}" title="${t('remove')}">✕</button></span>`).join('')
    : `<div class="waiting">${t('waitingKids')}</div>`;
  const st = S.settings, sel = new Set(st.tables);
  $('#tables').innerHTML = TABLES.map((n) => `<button class="tbl ${sel.has(n) ? 'on' : ''}" data-t="${n}">${n}</button>`).join('') +
    `<button class="quick" data-q="all">${t('qAll')}</button><button class="quick" data-q="tricky">${t('qTricky')}</button><button class="quick" data-q="easy">${t('qEasy')}</button>`;
  $('#ops').innerHTML = OPS.map(([k, l]) => `<button class="${st.ops[k] ? 'on' : ''}" data-op="${k}">${t(l)}</button>`).join('');
  $('#calls').innerHTML = [15, 25, 35].map((n) => `<button class="${st.calls === n ? 'on' : ''}" data-calls="${n}">${n}</button>`).join('');
  $('#secsPick').innerHTML = [8, 12, 15].map((n) => `<button class="${st.secs === n ? 'on' : ''}" data-secs="${n}">${t('secs', { n })}</button>`).join('');
  for (const b of $('#langPick').children) b.classList.toggle('sel', b.dataset.lang === LANG);
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
  } else if (d.calls) sendSettings({ calls: Number(d.calls) });
  else if (d.secs) sendSettings({ secs: Number(d.secs) });
  else if (d.lang) setLang(d.lang);
});
$('#startBtn').onclick = () => { beep([523, 659, 784, 1046], 0.1); hostDo('start', { settings: S.settings }); };
$('#newBtn').onclick = () => askConfirm(t('newCodeQ'), t('newCodeYes'), () => { localStorage.removeItem('tb_host'); create(); });

// ---------- calling ----------
function renderCall() {
  const box = $('#callbox'), c = S.call;
  const key = S.phase + ':' + S.ci;
  if (key === callKey) return;
  callKey = key;
  if (S.phase === 'call') {
    box.innerHTML = `<div class="timer" id="bar"><i></i></div><div class="qtext">${esc(c.text)}${c.text.includes('=') ? '' : ' = ?'}</div><div class="sub">${t('findIt')}</div>`;
    beep([784, 988], 0.08);
    syncTimer(S, S.callMs);
    runTimerBar($('#bar'), (left) => {
      const s = Math.ceil(left / 1000);
      if (s <= 3 && s > 0 && s !== lastTick) { lastTick = s; beep([880], 0.05, 'square'); }
    });
  } else if (S.phase === 'reveal' || S.phase === 'final') {
    cancelAnimationFrame(runTimerBar.raf);
    box.innerHTML = c ? `<div class="qtext">${fact(c.text, c.answer)}</div>` : '';
  }
}

function renderSide() {
  $('#lb').innerHTML = S.players.slice(0, 12).map((p) => `<div class="row-p" style="--oc:${p.color}"><span>${ordinal(p.rank)}</span><span class="av">${p.avatar}</span>
    <span class="nm">${esc(p.name)} ${p.full ? '🌟' : ''}<br><small>${t('linesShort', { n: p.lines })}</small></span><span class="pts">${t('ptsShort', { n: p.points })}</span></div>`).join('');
  $('#hist').innerHTML = S.history.slice().reverse().map((h) => `<span class="chipq">${esc(h.text)} → <b>${num(h.answer)}</b></span>`).join('');
  const newest = S.events.length ? S.events[S.events.length - 1].id : 0;
  if (newest > lastEvent) {
    const fresh = S.events.filter((e) => e.id > lastEvent);
    lastEvent = newest;
    const e = fresh[fresh.length - 1];
    if (e.k !== 'winner') {
      const b = $('#banner');
      b.textContent = t('ev.' + e.k, e.p);
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      confetti(e.k === 'line' ? 25 : 70);
      beep(e.k === 'line' ? [659, 880] : [523, 659, 784, 1046], 0.1);
    }
  }
}

function renderFinal() {
  $('#final').classList.remove('hidden');
  const [a, b, c] = S.players;
  const pod = (p, n) => (p ? `<div class="pod p${n}" style="animation-delay:${(3 - n) * 0.4}s"><div class="av">${p.avatar}</div><div class="nm">${esc(p.name)}</div><div>${t('points', { n: p.points })}</div><div class="block">${n === 1 ? '👑' : n}</div></div>` : '<div class="pod"></div>');
  $('#finalBox').innerHTML = `<h1 style="margin:0">${t('winnerT', { name: a ? `${a.avatar} ${esc(a.name)}` : '' })}</h1>
    <div class="podium">${pod(b, 2)}${pod(a, 1)}${pod(c, 3)}</div>
    <h3 style="text-align:left;margin:8px 0 4px">${t('everyoneH')}</h3>
    <div class="rest">${S.players.map((p) => `<div><b>${ordinal(p.rank)}</b> ${p.avatar} ${esc(p.name)}<span class="grow"></span>${t('linesN', { n: p.lines })} · <b>${t('points', { n: p.points })}</b></div>`).join('')}</div>
    <button class="btn-pink big" id="againBtn" style="margin-top:14px">${t('again')}</button>`;
  $('#againBtn').onclick = () => hostDo('lobby');
  if (!finalShown) { finalShown = true; confetti(120); beep([523, 659, 784, 1046, 1318], 0.14); }
}

function render(state) {
  S = state;
  if (useLang(S.settings.lang)) {
    callKey = '';
    document.title = `${t('titlePlain')} — ${t('bigScreen')}`;
    $('#soundBtn').textContent = t(soundOn ? 'soundOn' : 'soundOff');
    $('#langBtn').textContent = LANG === 'el' ? '🇬🇧 English' : '🇬🇷 Ελληνικά';
  }
  if (S.phase === 'lobby') { finalShown = false; callKey = ''; $('#banner').textContent = ''; return renderLobby(); }
  $('#lobby').classList.add('hidden');
  $('#show').classList.remove('hidden');
  $('#qrSmall').src = qrSrc();
  $('#codeSmall').textContent = code;
  $('#qnum').textContent = S.phase === 'final' ? t('final') : t('callN', { n: S.ci + 1, total: S.total });
  $('#endBtn').classList.toggle('hidden', S.phase === 'final');
  $('#skipBtn').classList.toggle('hidden', S.phase === 'final');
  for (const part of [renderCall, renderSide]) { try { part(); } catch (e) { console.error(e); } }
  if (S.phase === 'final') renderFinal(); else $('#final').classList.add('hidden');
}

$('#skipBtn').onclick = () => hostDo('skip');
$('#endBtn').onclick = () => askConfirm(t('endQ'), t('end'), () => hostDo('end'));
$('#langBtn').onclick = () => setLang(LANG === 'el' ? 'en' : 'el');
$('#fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$('#soundBtn').onclick = (e) => { soundOn = !soundOn; e.target.textContent = t(soundOn ? 'soundOn' : 'soundOff'); };
