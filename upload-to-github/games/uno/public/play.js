// Phone: your UNO hand. Tap a card to play it; draw, keep, UNO!, catch and challenge buttons appear when they apply.
const socket = io('/uno');
let code = (new URLSearchParams(location.search).get('g') || '').toUpperCase();
let me = null, S = null, avatar = null, wildCard = null, handKey = '', wasMyTurn = false;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------- joining ----------
function tryJoin(extra = {}) {
  if (!code) return showJoin();
  socket.emit('player:join', { code, playerId: store.get('uno_p_' + code), ...extra }, (r) => {
    if (r.lang) useLang(r.lang);
    if (r.error) { toast(t(r.error)); if (r.error === 'err.nogame') code = ''; return showJoin(); }
    if (r.needJoin) return showJoin();
    me = r.playerId;
    store.set('uno_p_' + code, me);
    history.replaceState(null, '', '/uno/play?g=' + code);
    $('#joinScreen').classList.add('hidden');
    $('#gameScreen').classList.remove('hidden');
  });
}
useLang(guessLang());
document.title = `${t('titlePlain')} — ${t('player')}`;
socket.on('connect', () => tryJoin());
socket.on('state', (s) => { if (me && s.code === code) render(s); });

function showJoin() {
  $('#joinScreen').classList.remove('hidden');
  $('#gameScreen').classList.add('hidden');
  $('#codeBox').classList.toggle('hidden', !!code);
  $('#avs').innerHTML = AVATARS.map((a) => `<button class="${a === avatar ? 'sel' : ''}" data-a="${a}">${a}</button>`).join('');
}
$('#codeIn').addEventListener('input', () => {
  const c = $('#codeIn').value.trim().toUpperCase();
  if (c.length === 4) socket.emit('player:join', { code: c }, (r) => { if (r && r.lang) useLang(r.lang); });
});
$('#avs').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  avatar = b.dataset.a;
  for (const x of $('#avs').children) x.classList.toggle('sel', x === b);
  beep([880], 0.05);
};
$('#joinBtn').onclick = () => {
  const c = $('#codeIn').value.trim().toUpperCase();
  if (!code && c) code = c;
  const name = $('#nameIn').value.trim();
  if (!code) return toast(t('typeCode'));
  if (!name) return toast(t('typeName'));
  if (!avatar) return toast(t('pickAv'));
  tryJoin({ name, avatar });
};

// ---------- playing ----------
const P = (id) => S.players.find((p) => p.id === id);
const nm = (p) => `${p.avatar} ${esc(p.name)}`;
function act(type, extra = {}) {
  socket.emit('act', { type, ...extra }, (r) => { if (r && r.error) { toast(t(r.error)); beep([300, 220], 0.12); } });
}

function header() {
  const p = P(me);
  $('#hA').textContent = p.avatar;
  $('#hN').textContent = p.name;
  $('#hC').textContent = S.phase === 'lobby' ? '' : `🎴 ${S.me.hand.length}`;
  $('#stat').textContent = S.settings.target && S.phase !== 'lobby' ? `${t('roundN', { n: S.round })} · ${t('pointsN', { n: p.score })} · ${t('targetN', { n: S.settings.target })}` : '';
}

function actionsHTML() {
  const m = S.me, out = [];
  if (m.mustRespond) {
    const from = P(S.pending.from);
    out.push(`<div class="panel center"><div style="font-size:1.3rem;font-weight:700">${t('wd4Hit', { who: from ? nm(from) : '' })}</div>
      <div class="muted" style="margin:6px 0 10px">${t('wd4Q')}</div>
      <div class="row"><button class="btn-soft big grow" data-a="accept">${t('accept')}</button><button class="btn-gold big grow" data-a="challenge">${t('challenge')}</button></div></div>`);
  }
  if (m.canUno) out.push(`<button class="unoBtn huge" data-a="uno">${t('unoBtn')}</button><div class="hint">${S.unoPending === me ? t('unoLate') : t('unoHint')}</div>`);
  if (m.saidUno && m.myTurn) out.push(`<div class="hint">${t('unoSaid')}</div>`);
  if (m.canCatch) { const v = P(S.unoPending); if (v) out.push(`<button class="catchBtn big" data-a="catch">${t('catchBtn', { who: nm(v) })}</button>`); }
  if (m.myTurn) {
    if (m.drawnCard !== null) out.push(`<div class="hint">${t('drewPlayable')}</div><button class="btn-soft big" data-a="keep">${t('keepBtn')}</button>`);
    else out.push(`<button class="btn-blue big" data-a="draw">${t('drawBtn')}</button>`);
  }
  return out.join('');
}

function render(state) {
  S = state;
  if (!S.me) { store.set('uno_p_' + code, ''); me = null; return showJoin(); } // removed by the host
  if (useLang(S.settings.lang)) { handKey = ''; document.title = `${t('titlePlain')} — ${t('player')}`; }
  header();
  const main = $('#main');
  if (S.phase === 'lobby') {
    main.innerHTML = `<div class="card"><div class="big-e">${P(me).avatar}</div><h2>${t('youreIn')}</h2>
      <div class="muted" style="font-size:1.1rem">${t('lookBig')}</div>
      <div style="margin-top:12px" class="chip">${t('playersN', { n: S.players.length })}</div>
      <div style="margin-top:10px" class="muted">${t('target' + S.settings.target)}</div></div>
      <div class="panel" style="font-size:1rem;line-height:1.5">${t('rules')}</div>`;
    return;
  }
  if (S.phase === 'final' || S.phase === 'roundover') {
    $('#picker').classList.add('hidden');
    const won = (S.phase === 'final' ? S.winner : S.result && S.result.winner) === me;
    const place = S.standings ? S.standings.indexOf(me) + 1 : 0;
    main.innerHTML = `<div class="card"><div class="big-e">${won ? '👑' : '🎴'}</div>
      <h2>${won ? t('youWon') : S.phase === 'final' ? t('cameRank', { ord: ordinal(place) }) : t('roundOverPh')}</h2>
      ${S.settings.target ? `<div style="font-size:1.4rem;font-weight:700">${t('pointsN', { n: P(me).score })}</div>` : ''}</div>
      ${S.me.hand.length ? `<div class="hand">${S.me.hand.map((c) => unoCard(c)).join('')}</div>` : ''}`;
    if (won && handKey !== 'won' + S.round) { handKey = 'won' + S.round; confetti(80); }
    return;
  }
  // playing
  const m = S.me, cur = P(S.turn);
  if (m.myTurn && !wasMyTurn) { navigator.vibrate && navigator.vibrate([100, 50, 100]); beep([660, 880, 1100], 0.08); }
  wasMyTurn = m.myTurn;
  const lit = new Set(m.lit);
  const help = S.settings.highlight;
  const banner = m.mustRespond ? '' : m.myTurn
    ? `<div class="banner2 mine">${t('yourTurn')} ${m.playable.length ? (m.drawnCard !== null ? '' : `· ${t('tapCard')}`) : `· ${t('noMatch')}`}</div>`
    : `<div class="banner2">${cur ? t('turnOf', { who: nm(cur) }) : ''}</div>`;
  main.innerHTML = `${banner}
    <div class="tableRow">${unoCard(S.top)}<div class="info2">${t('colorNow', { c: `<span class="cdot ${S.color}"></span> ${t('c.' + S.color)}` })}<br><span style="opacity:.85">${S.dir < 0 ? '↺' : '↻'} · ${t('deckN', { n: S.deck })}</span></div></div>
    <div class="acts2">${actionsHTML()}</div>
    <div class="hand">${m.hand.map((c) => unoCard(c, m.myTurn && help ? (lit.has(c.id) ? 'lit' : 'dim') : '')).join('')}</div>`;
}

$('#main').addEventListener('click', (e) => {
  if (!S || S.phase !== 'playing') return;
  const b = e.target.closest('[data-a]');
  if (b) {
    const a = b.dataset.a;
    if (a === 'accept') act('respond', { challenge: false });
    else if (a === 'challenge') act('respond', { challenge: true });
    else if (a === 'uno') { act('uno'); beep([988, 1318, 1568], 0.09); navigator.vibrate && navigator.vibrate(60); }
    else if (a === 'catch') act('catch');
    else if (a === 'draw') act('draw');
    else if (a === 'keep') act('keep');
    return;
  }
  const cardEl = e.target.closest('.hand .ucard');
  if (!cardEl) return;
  const id = Number(cardEl.dataset.id);
  const card = S.me.hand.find((c) => c.id === id);
  if (!card) return;
  if (!S.me.myTurn) return toast(t(S.me.mustRespond ? 'err.respondFirst' : 'err.notYourTurn'));
  if (card.c === 'w') {
    if (!S.me.playable.includes(id)) return toast(t(S.me.drawnCard !== null ? 'err.onlyDrawn' : 'err.cantPlay'));
    wildCard = id;
    $('#picker').classList.remove('hidden');
    return;
  }
  act('play', { card: id });
  beep([700], 0.05);
});

$('#picker').addEventListener('click', (e) => {
  const b = e.target.closest('[data-col]');
  if (b && wildCard !== null) { act('play', { card: wildCard, color: b.dataset.col }); beep([523, 784], 0.07); }
  if (b || e.target.id === 'pickCancel' || e.target.id === 'picker') { wildCard = null; $('#picker').classList.add('hidden'); }
});
