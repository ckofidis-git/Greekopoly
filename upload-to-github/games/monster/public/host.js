// Big screen: lobby with settings, then the monster arena with health bar, hits and heroes.
const socket = io('/monster');
let S = null, code = null, lastHit = 0, shownMonster = -1, finalShown = false;

const joinUrl = () => `${location.origin}/monster/play?g=${code}`;
const qrSrc = () => `/qr.svg?u=${encodeURIComponent(joinUrl())}`;
const hostDo = (type, extra = {}) => socket.emit('host:do', { type, ...extra }, (r) => r && r.error && toast(t(r.error)));
const monsterName = (m) => (m.super ? t('superPrefix').repeat(m.super) : '') + t('m.' + m.k);

function boot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('mb_host') || 'null'); } catch (e) {}
  if (saved) socket.emit('host:resume', saved, (r) => (r.error ? create() : enter(r.code, r.state)));
  else create();
}
function create() {
  socket.emit('host:create', { lang: guessLang() }, (r) => {
    try { localStorage.setItem('mb_host', JSON.stringify({ code: r.code, hostKey: r.hostKey })); } catch (e) {}
    enter(r.code, r.state);
  });
}
function enter(c, state) {
  code = c; finalShown = state.phase === 'final';
  lastHit = state.hits.length ? state.hits[state.hits.length - 1].id : 0;
  shownMonster = state.monster ? state.monster.n : -1;
  render(state);
  if (state.phase === 'lobby' && state.settings.lang !== guessLang()) sendSettings({ lang: guessLang() });
}
socket.on('connect', () => { if (code) boot(); });
socket.on('state', (s) => s.code === code && render(s));
boot();

// ---------- lobby ----------
const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const OPS = [['mul', 'opMul'], ['div', 'opDiv'], ['missing', 'opMissing'], ['big', 'opBig']];
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
  $('#mode').innerHTML = `<button class="${st.mode === 'choices' ? 'on' : ''}" data-mode="choices">${t('modeChoices')}</button><button class="${st.mode === 'type' ? 'on' : ''}" data-mode="type">${t('modeType')}</button>`;
  $('#minutes').innerHTML = [3, 5, 8].map((n) => `<button class="${st.minutes === n ? 'on' : ''}" data-min="${n}">${t('minutes', { n })}</button>`).join('');
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
  else if (d.lang) setLang(d.lang);
});
$('#startBtn').onclick = () => { beep([523, 659, 784, 1046], 0.1); hostDo('start', { settings: S.settings }); };
$('#newBtn').onclick = () => askConfirm(t('newCodeQ'), t('newCodeYes'), () => { localStorage.removeItem('mb_host'); create(); });

// ---------- arena ----------
function announce(html) {
  const a = $('#ann');
  a.innerHTML = html;
  a.classList.remove('pop'); void a.offsetWidth; a.classList.add('pop');
}

function renderArena() {
  const m = S.monster;
  const mon = $('#mon');
  if (m.n !== shownMonster) {
    // the previous monster was beaten: spin it away, then bring in the next one
    if (shownMonster >= 0 && S.defeated.length) {
      const d = S.defeated[S.defeated.length - 1];
      announce(esc(t('koBy', { monster: `${d.e} ${monsterName(d)}`, who: d.by })));
      confetti(50);
      beep([523, 659, 784, 1046, 1318], 0.1);
    }
    shownMonster = m.n;
    mon.textContent = m.e;
    mon.className = 'mon enter';
  }
  $('#mname').textContent = `${t('monsterN', { n: m.n + 1 })}: ${monsterName(m)}`;
  const pct = Math.max(0, m.hp) / m.max;
  const bar = $('#hp');
  bar.querySelector('i').style.width = pct * 100 + '%';
  bar.className = 'hpbar' + (pct < 0.25 ? ' low' : pct < 0.55 ? ' mid' : '');
  $('#hpnum').textContent = `${num(Math.max(0, m.hp))} / ${num(m.max)}`;
  $('#trophies').innerHTML = S.defeated.map((d) => `<span title="${esc(monsterName(d))}">${d.e}</span>`).join('');
  // flying damage numbers for new hits
  const fresh = S.hits.filter((h) => h.id > lastHit);
  if (fresh.length) {
    lastHit = fresh[fresh.length - 1].id;
    mon.classList.remove('hit', 'enter'); void mon.offsetWidth; mon.classList.add('hit');
    fresh.slice(-6).forEach((h, i) => {
      const el = document.createElement('div');
      el.className = 'dmg' + (h.crit ? ' crit' : '');
      el.textContent = `${h.avatar} −${h.dmg}${h.crit ? ' ⚡' : ''}`;
      el.style.left = 30 + Math.random() * 40 + '%';
      el.style.top = 35 + Math.random() * 25 + '%';
      el.style.animationDelay = i * 0.08 + 's';
      $('#floats').appendChild(el);
      setTimeout(() => el.remove(), 1500);
    });
    beep(fresh.some((h) => h.crit) ? [180, 120, 880] : [220, 160], 0.06, 'square');
  }
}

function renderSide() {
  $('#team').innerHTML = `<div>${t('beaten', { n: S.defeated.length })}</div><div>${t('teamDmg', { n: num(S.teamDmg) })}</div>`;
  $('#lb').innerHTML = S.players.slice(0, 10).map((p) => `<div class="row-p" style="--oc:${p.color}"><span>${ordinal(p.rank)}</span><span class="av">${p.avatar}</span>
    <span class="nm">${esc(p.name)} ${p.streak >= 3 ? '🔥' : ''}</span><span class="pts">${t('dmgShort', { n: num(p.dmg) })}</span></div>`).join('');
}

function runClock() {
  syncTimer(S, S.settings.minutes * 60000);
  let lastSec = -1;
  runTimerBar(null, (left) => {
    const s = Math.ceil(left / 1000), el = $('#clock');
    el.textContent = s ? `⏱️ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : t('timeUp');
    el.classList.toggle('low', s <= 30);
    if (s <= 10 && s > 0 && s !== lastSec) { lastSec = s; beep([880], 0.05, 'square'); }
  });
}

function renderFinal() {
  $('#final').classList.remove('hidden');
  const [a, b, c] = S.players;
  const pod = (p, n) => (p ? `<div class="pod p${n}" style="animation-delay:${(3 - n) * 0.4}s"><div class="av">${p.avatar}</div><div class="nm">${esc(p.name)}</div><div>${t('damage', { n: num(p.dmg) })}</div><div class="block">${n === 1 ? '👑' : n}</div></div>` : '<div class="pod"></div>');
  $('#finalBox').innerHTML = `<h2 style="margin:0 0 6px">${S.defeated.length ? t('teamResult', { n: S.defeated.length }) : t('teamNone')}</h2>
    <div style="font-size:2.4rem">${S.defeated.map((d) => d.e).join(' ')}</div>
    <h1 style="margin:6px 0">${t('winnerT', { name: a ? `${a.avatar} ${esc(a.name)}` : '' })}</h1>
    <div class="podium">${pod(b, 2)}${pod(a, 1)}${pod(c, 3)}</div>
    <h3 style="text-align:left;margin:8px 0 4px">${t('everyoneH')}</h3>
    <div class="rest">${S.players.map((p) => `<div><b>${ordinal(p.rank)}</b> ${p.avatar} ${esc(p.name)}<span class="grow"></span><b>${t('damage', { n: num(p.dmg) })}</b></div>`).join('')}</div>
    <button class="btn-pink big" id="againBtn" style="margin-top:14px">${t('again')}</button>`;
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
  if (S.phase === 'lobby') { finalShown = false; shownMonster = -1; $('#ann').textContent = ''; return renderLobby(); }
  $('#lobby').classList.add('hidden');
  $('#show').classList.remove('hidden');
  $('#qrSmall').src = qrSrc();
  $('#codeSmall').textContent = code;
  $('#endBtn').classList.toggle('hidden', S.phase !== 'playing');
  for (const part of [renderArena, renderSide]) { try { part(); } catch (e) { console.error(e); } }
  if (S.phase === 'playing') { $('#final').classList.add('hidden'); runClock(); }
  else { cancelAnimationFrame(runTimerBar.raf); $('#clock').textContent = t('timeUp'); $('#clock').classList.remove('low'); renderFinal(); }
}

$('#endBtn').onclick = () => askConfirm(t('endQ'), t('end'), () => hostDo('end'));
$('#langBtn').onclick = () => setLang(LANG === 'el' ? 'en' : 'el');
$('#fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$('#soundBtn').onclick = (e) => { soundOn = !soundOn; e.target.textContent = t(soundOn ? 'soundOn' : 'soundOff'); };
