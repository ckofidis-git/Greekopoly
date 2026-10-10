// Big screen: lobby with settings, then the island map, leaderboard and news.
const socket = io('/island');
let S = null, code = null, lastEvent = 0, prevOwners = [], finalShown = false;

const joinUrl = () => `${location.origin}/island/play?g=${code}`;
const qrSrc = () => `/qr.svg?u=${encodeURIComponent(joinUrl())}`;
const hostDo = (type, extra = {}) => socket.emit('host:do', { type, ...extra }, (r) => r && r.error && toast(t(r.error)));

function boot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('ti_host') || 'null'); } catch (e) {}
  if (saved) socket.emit('host:resume', saved, (r) => (r.error ? create() : enter(r.code, r.state)));
  else create();
}
function create() {
  socket.emit('host:create', { lang: guessLang() }, (r) => {
    try { localStorage.setItem('ti_host', JSON.stringify({ code: r.code, hostKey: r.hostKey })); } catch (e) {}
    enter(r.code, r.state);
  });
}
function enter(c, state) {
  code = c; finalShown = state.phase === 'final';
  lastEvent = state.events.length ? state.events[state.events.length - 1].id : 0;
  render(state);
  // Coming from the home page with a language picked: a game still in its lobby follows it.
  if (state.phase === 'lobby' && state.settings.lang !== guessLang()) sendSettings({ lang: guessLang() });
}
socket.on('connect', () => { if (code) boot(); });
socket.on('state', (s) => s.code === code && render(s));
boot();

// ---------- lobby ----------
const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const OPS = [['mul', 'opMul'], ['div', 'opDiv'], ['missing', 'opMissing'], ['big', 'opBig']];
function sendSettings(change) {
  hostDo('settings', { settings: { ...S.settings, ops: { ...S.settings.ops }, ...change } });
}
function setLang(lang) {
  try { localStorage.setItem('hub_lang', lang); } catch (e) {}
  sendSettings({ lang });
}

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
  $('#mode').innerHTML = `<button class="${st.mode === 'choices' ? 'on' : ''}" data-mode="choices">${t('modeChoices')}</button><button class="${st.mode === 'type' ? 'on' : ''}" data-mode="type">${t('modeType')}</button>`;
  $('#minutes').innerHTML = [3, 5, 8].map((n) => `<button class="${st.minutes === n ? 'on' : ''}" data-min="${n}">${t('minutes', { n })}</button>`).join('');
  $('#steal').innerHTML = `<button class="${st.steal ? 'on' : ''}" data-steal="1">${t('stealOn')}</button><button class="${!st.steal ? 'on' : ''}" data-steal="0">${t('stealOff')}</button>`;
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
  } else if (d.mode) sendSettings({ mode: d.mode });
  else if (d.min) sendSettings({ minutes: Number(d.min) });
  else if (d.steal) sendSettings({ steal: d.steal === '1' });
  else if (d.lang) setLang(d.lang);
});
$('#startBtn').onclick = () => { beep([523, 659, 784, 1046], 0.1); hostDo('start', { settings: S.settings }); };
$('#newBtn').onclick = () => askConfirm(t('newCodeQ'), t('newCodeYes'), () => { localStorage.removeItem('ti_host'); create(); });

// ---------- the island ----------
function colorOf(id) { const p = S.players.find((x) => x.id === id); return p ? p.color : '#999'; }
function avatarOf(id) { const p = S.players.find((x) => x.id === id); return p ? p.avatar : ''; }

function cellHTML(tile, i, extra = '') {
  if (!tile.land) return '<div class="cell sea"></div>';
  const icon = tile.kind === 'gem' ? '💎' : tile.kind === 'star' ? '⭐' : '';
  if (tile.owner) {
    return `<div class="cell land own ${tile.shield ? 'shield' : ''} ${extra}" data-i="${i}" style="--oc:${colorOf(tile.owner)}">${avatarOf(tile.owner)}${icon ? `<span class="tag">${icon}</span>` : ''}</div>`;
  }
  return `<div class="cell land ${tile.kind === 'plain' ? '' : 'star'} ${extra}" data-i="${i}">${icon || tile.deco}</div>`;
}

function sizeMap() {
  const box = $('#mapBox'), main = $('#main');
  if (!S || !S.W) return;
  const maxW = main.clientWidth * 0.72, maxH = main.clientHeight - 10;
  const w = Math.min(maxW, (maxH * S.W) / S.H * 0.97);
  box.style.width = w + 'px';
}
window.addEventListener('resize', sizeMap);

function renderMap() {
  const map = $('#map');
  map.style.setProperty('--w', S.W);
  map.innerHTML = S.tiles.map((tile, i) => cellHTML(tile, i, prevOwners[i] !== undefined && prevOwners[i] !== tile.owner && tile.owner ? 'pop' : '')).join('');
  prevOwners = S.tiles.map((tile) => tile.owner);
  sizeMap();
}

function renderSide() {
  $('#lb').innerHTML = S.players.map((p) => `<div class="row-p" style="--oc:${p.color}"><span>${ordinal(p.rank)}</span><span class="av">${p.avatar}</span>
    <span class="nm">${esc(p.name)} ${p.streak >= 3 ? '🔥' : ''}<br><small>${t('landShort', { n: p.land })} · 🪙 ${p.coins}</small></span><span class="pts">${t('ptsShort', { n: p.score })}</span></div>`).join('');
  $('#events').innerHTML = S.events.slice().reverse().map((e) => `<div>${esc(t('ev.' + e.k, e.p))}</div>`).join('');
  const newest = S.events.length ? S.events[S.events.length - 1].id : 0;
  if (newest > lastEvent) {
    const fresh = S.events.filter((e) => e.id > lastEvent);
    lastEvent = newest;
    for (const e of fresh) {
      if (e.k === 'gem') { beep([880, 1175, 1568], 0.1); confetti(30); }
      else if (e.k === 'coins') beep([988, 1318], 0.08);
      else if (e.k === 'steal') beep([392, 311], 0.12);
      else if (e.k === 'star') beep([784, 1046], 0.08);
    }
  }
}

let lastSec = -1;
function runClock() {
  syncTimer(S, S.settings.minutes * 60000);
  runTimerBar(null, (left) => {
    const s = Math.ceil(left / 1000);
    const el = $('#clock');
    el.textContent = s ? `⏱️ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : t('timeUp');
    el.classList.toggle('low', s <= 30);
    if (s <= 10 && s > 0 && s !== lastSec) { lastSec = s; beep([880], 0.05, 'square'); }
  });
}

function renderFinal() {
  $('#final').classList.remove('hidden');
  const [a, b, c] = S.players;
  const pod = (p, n) => (p ? `<div class="pod p${n}" style="animation-delay:${(3 - n) * 0.4}s"><div class="av">${p.avatar}</div><div class="nm">${esc(p.name)}</div><div>${t('points', { n: p.score })}</div><div class="block">${n === 1 ? '👑' : n}</div></div>` : '<div class="pod"></div>');
  $('#finalBox').innerHTML = `<h1 style="margin:0">${t('winnerT', { name: a ? `${a.avatar} ${esc(a.name)}` : '' })}</h1>
    <div class="podium">${pod(b, 2)}${pod(a, 1)}${pod(c, 3)}</div>
    <h3 style="text-align:left;margin:8px 0 4px">${t('everyoneH')}</h3>
    <div class="rest">${S.players.map((p) => `<div><b>${ordinal(p.rank)}</b> ${p.avatar} ${esc(p.name)}<span class="grow"></span>${t('squares', { n: p.land })} · <b>${t('points', { n: p.score })}</b></div>`).join('')}</div>
    <button class="btn-gold big" id="againBtn" style="margin-top:14px">${t('again')}</button>`;
  $('#againBtn').onclick = () => hostDo('lobby');
  if (!finalShown) { finalShown = true; confetti(120); beep([523, 659, 784, 1046, 1318], 0.14); }
}

function render(state) {
  S = state;
  if (useLang(S.settings.lang)) {
    document.title = `${t('titlePlain')} — ${t('bigScreen')}`;
    $('#soundBtn').textContent = t(soundOn ? 'soundOn' : 'soundOff');
    $('#langBtn').textContent = LANG === 'el' ? '🇬🇧 English' : '🇬🇷 Ελληνικά';
  }
  if (S.phase === 'lobby') { finalShown = false; prevOwners = []; return renderLobby(); }
  $('#lobby').classList.add('hidden');
  $('#show').classList.remove('hidden');
  $('#qrSmall').src = qrSrc();
  $('#codeSmall').textContent = code;
  $('#endBtn').classList.toggle('hidden', S.phase !== 'playing');
  for (const part of [renderMap, renderSide]) { try { part(); } catch (e) { console.error(e); } }
  if (S.phase === 'playing') { $('#final').classList.add('hidden'); runClock(); }
  else { cancelAnimationFrame(runTimerBar.raf); $('#clock').textContent = t('timeUp'); $('#clock').classList.remove('low'); renderFinal(); }
}

$('#endBtn').onclick = () => askConfirm(t('endQ'), t('end'), () => hostDo('end'));
$('#langBtn').onclick = () => setLang(LANG === 'el' ? 'en' : 'el');
$('#fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$('#soundBtn').onclick = (e) => { soundOn = !soundOn; e.target.textContent = t(soundOn ? 'soundOn' : 'soundOff'); };
