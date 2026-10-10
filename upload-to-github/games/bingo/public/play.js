// Phone: your bingo card. Tap the answer to the question on the big screen.
const socket = io('/bingo');
let code = (new URLSearchParams(location.search).get('g') || '').toUpperCase();
let me = null, S = null, avatar = null, lastSeen = null, eventSeen = 0, finalDrawn = false;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------- joining ----------
function tryJoin(extra = {}) {
  if (!code) return showJoin();
  socket.emit('player:join', { code, playerId: store.get('tb_p_' + code), ...extra }, (r) => {
    if (r.lang) useLang(r.lang);
    if (r.error) { toast(t(r.error)); if (r.error === 'err.nogame') code = ''; return showJoin(); }
    if (r.needJoin) return showJoin();
    me = r.playerId;
    store.set('tb_p_' + code, me);
    history.replaceState(null, '', '/bingo/play?g=' + code);
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
const fact = (text, answer) => (text.includes('□') ? text.replace('□', num(answer)) : `${text} = ${num(answer)}`);

function header() {
  const p = P(me);
  $('#hA').textContent = p.avatar;
  $('#hN').textContent = p.name;
  const c = $('#hC'), txt = `⭐ ${num(S.me.points)}`;
  if (c.textContent !== txt) { c.textContent = txt; c.className = 'coin'; void c.offsetWidth; c.className = 'coin bump'; }
  $('#stat').textContent = S.phase === 'lobby' ? '' : t('statLine', { pts: S.me.points, ord: ordinal(S.me.rank) });
}

function feedback() {
  const l = S.me.last;
  if (S.phase === 'reveal') return { cls: '', html: esc(t('answerWas', { fact: fact(S.call.text, S.call.answer) })) };
  if (!l) return { cls: '', html: S.me.locked ? t('locked') : t('tapAnswer') };
  if (!l.ok) return { cls: 'bad', html: esc(t(l.lost ? 'wrongTap' : 'wrongTap0', { v: num(l.value), n: l.lost })) };
  let html = t('good', { n: l.gained }) + (l.fast ? ` ${t('fast')}` : '');
  if (l.full) html += ` ${t('gotFull')}`; else if (l.first) html += ` ${t('gotFirst')}`; else if (l.lines) html += ` ${t('gotLine')}`;
  return { cls: 'good', html };
}

function cardHTML() {
  const n = S.size, lineCells = new Set((S.me.lines || []).flat());
  return `<div class="card4 ${S.me.locked && S.phase === 'call' ? 'locked' : ''}" style="--n:${n}">${S.me.card.map((v, i) =>
    `<button data-c="${i}" class="${S.me.marked[i] ? (lineCells.has(i) ? 'on line' : 'on') : ''}">${num(v)}</button>`).join('')}</div>`;
}

function render(state) {
  S = state;
  if (!S.me) { store.set('tb_p_' + code, ''); me = null; return showJoin(); } // removed by the host
  if (useLang(S.settings.lang)) { finalDrawn = false; document.title = `${t('titlePlain')} — ${t('player')}`; }
  header();
  const main = $('#main');
  if (S.phase === 'lobby') {
    finalDrawn = false;
    const st = S.settings;
    main.innerHTML = `<div class="card"><div class="big-e">${P(me).avatar}</div><h2>${t('youreIn')}</h2>
      <div class="muted" style="font-size:1.1rem">${t('lookBig')}</div>
      <div style="margin-top:12px" class="chip">${t('playersN', { n: S.players.length })}</div>
      <div style="margin-top:10px" class="muted">${t('summary', { tables: st.tables.length === 11 ? t('all') : st.tables.join(', '), calls: st.calls })}</div></div>
      <div class="panel" style="font-size:1rem;line-height:1.5">${t('rules')}</div>`;
    return;
  }
  if (S.phase === 'final') {
    if (finalDrawn) return;
    finalDrawn = true;
    const r = S.me.rank, missed = S.me.missed || [];
    main.innerHTML = `<div class="card"><div class="big-e">${r === 1 ? '👑' : r === 2 ? '🥈' : r === 3 ? '🥉' : '🎱'}</div>
        <h2>${r === 1 ? t('kingYou') : t('cameRank', { ord: ordinal(r) })}</h2>
        <div style="font-size:1.6rem;font-weight:700">${t('points', { n: S.me.points })}</div>
        <div class="muted" style="font-size:1.05rem">${t('markedOf', { m: S.me.marks, l: S.me.lines.length })}</div></div>
      ${cardHTML()}
      <div class="panel"><h3 style="margin:0 0 6px">${t(missed.length ? 'practise' : 'perfect')}</h3>
        <div class="recap">${missed.map((x) => `<div><b>${esc(fact(x.text, x.answer))}</b></div>`).join('')}</div></div>`;
    if (r === 1) confetti(80);
    return;
  }
  // call or reveal
  const c = S.call;
  const fb = feedback();
  main.innerHTML = `<div class="callq"><small>${t('callN', { n: S.ci + 1, total: S.total })}</small>${S.phase === 'reveal' ? esc(fact(c.text, c.answer)) : esc(c.text) + (c.text.includes('=') ? '' : ' = ?')}</div>
    <div class="fb ${fb.cls}">${fb.html}</div>${cardHTML()}`;
  // sounds for new results
  const key = S.ci + ':' + JSON.stringify(S.me.last);
  if (S.me.last && key !== lastSeen) {
    lastSeen = key;
    if (S.me.last.ok) {
      beep(S.me.last.lines ? [523, 659, 784, 1046] : [784, 1046], 0.08);
      navigator.vibrate && navigator.vibrate(S.me.last.lines ? [80, 40, 80, 40, 80] : 40);
      if (S.me.last.lines || S.me.last.full) confetti(S.me.last.full ? 90 : 40);
    } else { beep([392, 330], 0.12); navigator.vibrate && navigator.vibrate(150); }
  }
}

$('#main').addEventListener('click', (e) => {
  const b = e.target.closest('[data-c]');
  if (!b || !S || S.phase !== 'call') return;
  const i = Number(b.dataset.c);
  if (S.me.marked[i]) return toast(t('err.already'));
  if (S.me.locked) return toast(t('locked'));
  socket.emit('mark', { cell: i }, (r) => {
    if (r && r.error) toast(t(r.error));
  });
});
