// Big screen: lobby with settings, then the card table (seats, piles, direction, news).
const socket = io('/uno');
let S = null, code = null, lastEvent = 0, shownTop = '', overShown = '';

const joinUrl = () => `${location.origin}/uno/play?g=${code}`;
const qrSrc = () => `/qr.svg?u=${encodeURIComponent(joinUrl())}`;
const hostDo = (type, extra = {}) => socket.emit('host:do', { type, ...extra }, (r) => r && r.error && toast(t(r.error)));
const P = (id) => S.players.find((p) => p.id === id);
const nm = (p) => `${p.avatar} ${esc(p.name)}`;

function boot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('uno_host') || 'null'); } catch (e) {}
  if (saved) socket.emit('host:resume', saved, (r) => (r.error ? create() : enter(r.code, r.state)));
  else create();
}
function create() {
  socket.emit('host:create', { lang: guessLang() }, (r) => {
    try { localStorage.setItem('uno_host', JSON.stringify({ code: r.code, hostKey: r.hostKey })); } catch (e) {}
    enter(r.code, r.state);
  });
}
function enter(c, state) {
  code = c;
  lastEvent = state.events.length ? state.events[state.events.length - 1].id : 0;
  overShown = state.phase === 'final' || state.phase === 'roundover' ? state.phase + state.round : '';
  render(state);
  if (state.phase === 'lobby' && state.settings.lang !== guessLang()) sendSettings({ lang: guessLang() });
}
socket.on('connect', () => { if (code) boot(); });
socket.on('state', (s) => s.code === code && render(s));
boot();

// ---------- lobby ----------
function sendSettings(change) { hostDo('settings', { settings: { ...S.settings, ...change } }); }
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
  const st = S.settings;
  $('#target').innerHTML = [0, 200, 500].map((n) => `<button class="${st.target === n ? 'on' : ''}" data-target="${n}">${t('target' + n)}</button>`).join('');
  $('#help').innerHTML = `<button class="${st.highlight ? 'on' : ''}" data-help="1">${t('helpOn')}</button><button class="${!st.highlight ? 'on' : ''}" data-help="0">${t('helpOff')}</button>`;
  for (const b of $('#langPick').children) b.classList.toggle('sel', b.dataset.lang === LANG);
  $('#startBtn').disabled = S.players.length < 2;
  $('#startBtn').textContent = S.players.length >= 2 ? t('start', { n: S.players.length }) : t('waitingPlayers');
}

$('#kids').onclick = (e) => { const id = e.target.dataset.kick; if (id) hostDo('kick', { playerId: id }); };
$('#lobby').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !S) return;
  const d = b.dataset;
  if (d.target !== undefined) sendSettings({ target: Number(d.target) });
  else if (d.help !== undefined) sendSettings({ highlight: d.help === '1' });
  else if (d.lang) setLang(d.lang);
});
$('#startBtn').onclick = () => { beep([523, 659, 784, 1046], 0.1); hostDo('start', { settings: S.settings }); };
$('#newBtn').onclick = () => askConfirm(t('newCodeQ'), t('newCodeYes'), () => { localStorage.removeItem('uno_host'); create(); });

// ---------- the table ----------
function eventText(e) {
  const p = { ...e.p };
  if (e.k === 'play') p.card = cardName(e.p.card) + (e.p.card.c === 'w' ? ` → ${t('c.' + e.p.color)}` : '');
  return t('ev.' + e.k, p);
}

function renderTable() {
  $('#seats').innerHTML = S.players.map((p) => `<div class="seat ${p.id === S.turn ? 'turn' : ''}">
      <div class="av">${p.avatar}</div><div class="nm">${esc(p.name)}</div>
      <div class="fan">${'<i></i>'.repeat(Math.min(p.count, 12))}</div>
      <div class="cnt">${t('myCards', { n: p.count })}${p.connected ? '' : ' 📵'}</div>
      ${p.count === 1 ? '<div class="uno">UNO!</div>' : ''}</div>`).join('');
  $('#deckCard').innerHTML = CARD_BACK;
  $('#deckN').textContent = t('deckN', { n: S.deck });
  const key = JSON.stringify(S.top) + S.color;
  const top = $('#topCard');
  top.innerHTML = unoCard(S.top, key !== shownTop ? 'new' : '');
  top.className = 'glow-' + S.color;
  if (key !== shownTop && shownTop) beep([660, 880], 0.06);
  shownTop = key;
  $('#colorNow').innerHTML = `${t('colorNow', { c: `<span class="cdot ${S.color}"></span> ${t('c.' + S.color)}` })}`;
  $('#dir').className = 'dir' + (S.dir < 0 ? ' ccw' : '');
  $('#dir').textContent = S.dir < 0 ? '↺' : '↻';
  const cur = P(S.turn);
  $('#turnmsg').innerHTML = cur ? t('turnOf', { who: nm(cur) }) : '';
  let alert = '';
  if (S.pending) alert = t('deciding', { who: nm(P(S.pending.target)) });
  else if (S.unoPending && P(S.unoPending)) alert = t('catchable', { who: nm(P(S.unoPending)) });
  $('#alert').innerHTML = alert;
  $('#roundN').textContent = t('roundN', { n: S.round }) + (S.settings.target ? ` · ${t('targetN', { n: S.settings.target })}` : '');
}

function renderSide() {
  $('#scores').innerHTML = S.settings.target
    ? `<b>${t('scoresH')}</b>` + S.players.slice().sort((a, b) => b.score - a.score).map((p) => `<div><span>${nm(p)}</span><b>${p.score}</b></div>`).join('')
    : '';
  $('#scores').classList.toggle('hidden', !S.settings.target);
  $('#events').innerHTML = S.events.slice().reverse().map((e) => `<div>${esc(eventText(e))}</div>`).join('');
  const newest = S.events.length ? S.events[S.events.length - 1].id : 0;
  if (newest > lastEvent) {
    const fresh = S.events.filter((e) => e.id > lastEvent);
    lastEvent = newest;
    for (const e of fresh) {
      if (e.k === 'uno') beep([988, 1318, 1568], 0.09);
      else if (e.k === 'caught' || e.k === 'drew4' || e.k === 'drew2') beep([392, 311], 0.1);
      else if (e.k === 'reversed') beep([523, 440, 523], 0.07);
    }
  }
}

function renderOver() {
  const key = S.phase + S.round;
  $('#final').classList.remove('hidden');
  const r = S.result;
  const winner = P(S.phase === 'final' ? S.winner : r && r.winner);
  const hands = r ? r.hands.filter((h) => h.cards.length).map((h) => {
    const p = P(h.id);
    return p ? `<div><b>${nm(p)}</b><span class="grow"></span><span class="mini">${h.cards.map((c) => unoCard(c)).join('')}</span><b>${t('pointsN', { n: h.pts })}</b></div>` : '';
  }).join('') : '';
  const standings = S.phase === 'final' && S.standings
    ? S.standings.map((id, i) => { const p = P(id); return p ? `<div><b>${ordinal(i + 1)}</b> ${nm(p)}<span class="grow"></span>${S.settings.target ? `<b>${t('pointsN', { n: p.score })}</b>` : t('cardsLeft', { n: p.count })}</div>` : ''; }).join('')
    : '';
  $('#finalBox').innerHTML = S.phase === 'final'
    ? `<h1 style="margin:0">${t('winnerT', { name: winner ? nm(winner) : '' })}</h1>
       <h3 style="text-align:left;margin:12px 0 4px">${t('everyoneH')}</h3><div class="rest">${standings}</div>
       ${hands ? `<div class="rest hands" style="margin-top:10px">${hands}</div>` : ''}
       <button class="btn-pink big" id="againBtn" style="margin-top:14px">${t('again')}</button>`
    : `<h1 style="margin:0">${t('roundOver', { who: winner ? nm(winner) : '', n: S.round })}</h1>
       <div class="rest hands" style="margin-top:10px">${hands}</div>
       <h3 style="text-align:left;margin:12px 0 4px">${t('scoresH')} · ${t('targetN', { n: S.settings.target })}</h3>
       <div class="rest">${S.players.slice().sort((a, b) => b.score - a.score).map((p) => `<div>${nm(p)}<span class="grow"></span><b>${p.score}</b></div>`).join('')}</div>
       <button class="btn-pink big" id="nextBtn" style="margin-top:14px">${t('next')}</button>`;
  if ($('#againBtn')) $('#againBtn').onclick = () => hostDo('lobby');
  if ($('#nextBtn')) $('#nextBtn').onclick = () => hostDo('next');
  if (overShown !== key) { overShown = key; confetti(S.phase === 'final' ? 120 : 50); beep([523, 659, 784, 1046, 1318], 0.12); }
}

function render(state) {
  S = state;
  if (useLang(S.settings.lang)) {
    shownTop = '';
    document.title = `${t('titlePlain')} — ${t('bigScreen')}`;
    $('#soundBtn').textContent = t(soundOn ? 'soundOn' : 'soundOff');
    $('#langBtn').textContent = LANG === 'el' ? '🇬🇧 English' : '🇬🇷 Ελληνικά';
  }
  if (S.phase === 'lobby') { overShown = ''; shownTop = ''; return renderLobby(); }
  $('#lobby').classList.add('hidden');
  $('#show').classList.remove('hidden');
  $('#qrSmall').src = qrSrc();
  $('#codeSmall').textContent = code;
  $('#endBtn').classList.toggle('hidden', S.phase === 'final');
  for (const part of [renderTable, renderSide]) { try { part(); } catch (e) { console.error(e); } }
  if (S.phase === 'roundover' || S.phase === 'final') renderOver(); else $('#final').classList.add('hidden');
}

$('#endBtn').onclick = () => askConfirm(t('endQ'), t('end'), () => hostDo('end'));
$('#langBtn').onclick = () => setLang(LANG === 'el' ? 'en' : 'el');
$('#fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$('#soundBtn').onclick = (e) => { soundOn = !soundOn; e.target.textContent = t(soundOn ? 'soundOn' : 'soundOff'); };
