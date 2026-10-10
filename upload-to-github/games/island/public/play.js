// Phone: answer questions to earn gold, then spend it on the island map.
const socket = io('/island');
let code = (new URLSearchParams(location.search).get('g') || '').toUpperCase();
let me = null, S = null, avatar = null, tab = 'earn', sel = null;
let qShown = null, lastShown = 0, foundShown = 0, typed = '', phaseShown = '';
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------- joining ----------
function tryJoin(extra = {}) {
  if (!code) return showJoin();
  socket.emit('player:join', { code, playerId: store.get('ti_p_' + code), ...extra }, (r) => {
    if (r.lang) useLang(r.lang);
    if (r.error) { toast(t(r.error)); if (r.error === 'err.nogame') code = ''; return showJoin(); }
    if (r.needJoin) return showJoin();
    me = r.playerId;
    store.set('ti_p_' + code, me);
    history.replaceState(null, '', '/island/play?g=' + code);
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

// ---------- helpers ----------
const fact = (text, answer) => (text.includes('□') ? text.replace('□', num(answer)) : `${text} = ${num(answer)}`);
const P = (id) => S.players.find((p) => p.id === id);

function header() {
  const p = P(me);
  $('#hA').textContent = p.avatar;
  $('#hN').textContent = p.name;
  const c = $('#hC');
  const txt = `🪙 ${num(S.me.coins)}`;
  if (c.textContent !== txt) { c.textContent = txt; c.className = 'coin'; void c.offsetWidth; c.className = 'coin bump'; }
  $('#stat').textContent = S.phase === 'lobby' ? '' : t('statLine', { land: S.me.land, pts: S.me.score, ord: ordinal(S.me.rank) });
  $('#clk').classList.toggle('hidden', S.phase !== 'playing');
  $('#tabs').classList.toggle('hidden', S.phase !== 'playing');
  $('#tabEarn').textContent = t('tabEarn');
  const canBuy = S.me.coins >= S.cost.plain;
  $('#tabMap').innerHTML = `${t('tabMap')}${tab === 'earn' && canBuy ? '<span class="dot">🪙!</span>' : ''}`;
  for (const b of $('#tabs').children) b.classList.toggle('on', b.dataset.tab === tab);
}

function runClock() {
  syncTimer(S, S.settings.minutes * 60000);
  runTimerBar(null, (left) => {
    const s = Math.ceil(left / 1000);
    $('#clk').textContent = `⏱️ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
}

// ---------- earn ----------
function renderEarn(force) {
  const main = $('#main'), q = S.me.q;
  if (!q) return;
  if (force || qShown !== q.seq) {
    qShown = q.seq; typed = '';
    const qText = esc(q.text) + (q.text.includes('=') ? '' : ' = ?');
    main.innerHTML = `<div class="fb" id="fb"></div><div class="q">${qText}</div>` + (q.choices
      ? `<div class="grid4">${q.choices.map((c, i) => `<button class="fruit f${i}" data-v="${c}"><span class="fe">${FRUITS[i]}</span>${num(c)}</button>`).join('')}</div>`
      : `<div class="display empty" id="disp">${t('typeAnswer')}</div>
         <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="del">⌫</button><button data-k="0">0</button><button class="ok" data-k="ok">✓</button></div>`);
    showFeedback(true);
  }
}

function showFeedback(redraw) {
  const l = S.me.last, fb = $('#fb');
  if (!fb || !l) return;
  if (!redraw && l.seq === lastShown) return;
  const fresh = l.seq !== lastShown;
  lastShown = l.seq;
  fb.className = 'fb ' + (l.correct ? 'good' : 'bad');
  fb.innerHTML = l.correct
    ? `${t('correctPlus', { n: l.gained })}${l.fast ? ` ${t('fast')}` : ''}${l.streak >= 3 ? ` 🔥${l.streak}` : ''}`
    : esc(t('wrongFact', { fact: fact(l.text, l.answer) }));
  if (fresh) {
    if (l.correct) { beep([784, 1046], 0.07); navigator.vibrate && navigator.vibrate(30); } else beep([392, 330], 0.1);
  }
}

$('#main').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !S || S.phase !== 'playing') return;
  if (b.dataset.v !== undefined) {
    document.querySelectorAll('.grid4 .fruit').forEach((x) => { x.disabled = true; });
    socket.emit('answer', { value: Number(b.dataset.v) }, (r) => r && r.error && toast(t(r.error)));
  } else if (b.dataset.k) {
    const k = b.dataset.k;
    if (k === 'del') typed = typed.slice(0, -1);
    else if (k === 'ok') {
      if (!typed) return toast(t('typeFirst'));
      return socket.emit('answer', { value: Number(typed) }, (r) => r && r.error && toast(t(r.error)));
    } else if (typed.length < 6) typed += k;
    const d = $('#disp');
    d.textContent = typed ? num(Number(typed)) : t('typeAnswer');
    d.classList.toggle('empty', !typed);
  } else if (b.id === 'claimBtn') {
    const idx = sel;
    socket.emit('claim', { idx }, (r) => {
      if (r && r.error) { toast(t(r.error)); beep([300, 220], 0.12); return; }
      beep([660, 880, 1100], 0.08);
      navigator.vibrate && navigator.vibrate([40, 30, 40]);
      toast(t('claimed'));
    });
  }
});

// ---------- map ----------
function renderMap() {
  const main = $('#main');
  const cells = S.tiles.map((tile, i) => {
    if (!tile.land) return '<div class="cell sea"></div>';
    const icon = tile.kind === 'gem' ? '💎' : tile.kind === 'star' ? '⭐' : '';
    const s = i === sel ? 'sel' : '';
    if (tile.owner) {
      const o = P(tile.owner);
      return `<div class="cell land own ${tile.owner === me ? 'mine' : ''} ${tile.shield ? 'shield' : ''} ${s}" data-i="${i}" style="--oc:${o ? o.color : '#999'}">${o ? o.avatar : ''}${icon ? `<span class="tag">${icon}</span>` : ''}</div>`;
    }
    return `<div class="cell land ${tile.kind === 'plain' ? '' : 'star'} ${s}" data-i="${i}">${icon || tile.deco}</div>`;
  }).join('');
  main.innerHTML = `<div class="phone-map"><div class="sea-bg"><div class="mapwrap"><div class="map" style="--w:${S.W}">${cells}</div></div></div></div><div class="info" id="info">${infoHTML()}</div>`;
}

function infoHTML() {
  if (sel === null || !S.tiles[sel] || !S.tiles[sel].land) return `<div class="hint" style="color:var(--ink)">${t('tapTile')}</div>`;
  const tile = S.tiles[sel], c = S.cost;
  if (tile.owner === me) return `<b>${t('yoursTile')}</b>`;
  let label, cost;
  if (tile.owner) {
    if (!S.settings.steal) return `<b>${t('noStealTile')}</b>`;
    if (tile.shield > 0) return `<b>${t('shielded', { s: Math.ceil(tile.shield / 1000) })}</b>`;
    const o = P(tile.owner);
    cost = c.steal; label = t('claimSteal', { who: o ? `${o.avatar} ${esc(o.name)}` : '?', c: cost });
  } else if (tile.kind === 'plain') { cost = c.plain; label = t('claimFree', { c: cost }); } else { cost = c.star; label = t('claimStar', { c: cost }); }
  const short = cost - S.me.coins;
  return `<button class="btn-gold big" id="claimBtn" ${short > 0 ? 'disabled' : ''}>${label}</button>${short > 0 ? `<div class="muted">${t('needMore', { n: short })}</div>` : ''}`;
}

$('#main').addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('.cell.land');
  if (!cell || tab !== 'map') return;
  sel = Number(cell.dataset.i);
  beep([700], 0.04);
  renderMap();
});

$('#tabs').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b || b.dataset.tab === tab) return;
  tab = b.dataset.tab;
  render(S, true);
};

// ---------- main render ----------
function render(state, force = false) {
  S = state;
  if (!S.me) { store.set('ti_p_' + code, ''); me = null; return showJoin(); } // removed by the host
  if (useLang(S.settings.lang)) { force = true; document.title = `${t('titlePlain')} — ${t('player')}`; }
  if (S.phase !== phaseShown) { phaseShown = S.phase; force = true; if (S.phase === 'playing') { tab = 'earn'; sel = null; } }
  header();
  const main = $('#main');
  if (S.phase === 'lobby') {
    const st = S.settings;
    main.innerHTML = `<div class="card"><div class="big-e">${P(me).avatar}</div><h2>${t('youreIn')}</h2>
      <div class="muted" style="font-size:1.1rem">${t('lookBig')}</div>
      <div style="margin-top:12px" class="chip">${t('playersN', { n: S.players.length })}</div>
      <div style="margin-top:10px" class="muted">${t('summary', { tables: st.tables.length === 11 ? t('all') : st.tables.join(', '), min: st.minutes })}</div></div>
      <div class="panel" style="font-size:1rem;line-height:1.5">${t('rules')}</div>`;
    return;
  }
  if (S.phase === 'playing') {
    runClock();
    if (tab === 'earn') { renderEarn(force); showFeedback(false); } else renderMap();
    const f = S.me.found;
    if (f && f.seq !== foundShown) {
      if (foundShown) { toast(f.type === 'gem' ? t('foundGem') : t('foundCoins', { n: f.n })); confetti(25); beep([880, 1175, 1568], 0.1); }
      foundShown = f.seq;
    }
    return;
  }
  // final
  cancelAnimationFrame(runTimerBar.raf);
  if (!force) return;
  const r = S.me.rank, wrong = S.me.wrong || [];
  main.innerHTML = `<div class="card"><div class="big-e">${r === 1 ? '👑' : r === 2 ? '🥈' : r === 3 ? '🥉' : '🏝️'}</div>
      <h2>${r === 1 ? t('kingYou') : t('cameRank', { ord: ordinal(r) })}</h2>
      <div style="font-size:1.6rem;font-weight:700">${t('points', { n: S.me.score })} · ${t('squares', { n: S.me.land })}</div>
      <div class="muted" style="font-size:1.05rem">${t('rightOf', { c: S.me.right, t: S.me.tried })}${S.me.best >= 3 ? t('bestStreak', { n: S.me.best }) : ''}</div></div>
    <div class="panel ${S.me.tried ? '' : 'hidden'}"><h3 style="margin:0 0 6px">${t(wrong.length ? 'practise' : 'perfect')}</h3>
      <div class="recap">${wrong.length ? wrong.map((x) => `<div><b>${esc(fact(x.text, x.answer))}</b><span class="bad">${t('youSaidShort', { v: num(x.mine) })}</span></div>`).join('') : `<div>${t('allCorrect')}</div>`}</div></div>`;
  if (r === 1) confetti(80);
}
