// Phone: join, then answer each question.
const socket = io('/quiz');
let code = (new URLSearchParams(location.search).get('g') || '').toUpperCase();
let me = null, S = null, avatar = null, key = '', typed = '', picked = null;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------- joining ----------
function tryJoin(extra = {}) {
  if (!code) return showJoin();
  socket.emit('player:join', { code, playerId: store.get('ms_p_' + code), ...extra }, (r) => {
    if (r.lang) useLang(r.lang);
    if (r.error) { toast(t(r.error)); if (r.error === 'err.nogame') code = ''; return showJoin(); }
    if (r.needJoin) return showJoin();
    me = r.playerId;
    store.set('ms_p_' + code, me);
    history.replaceState(null, '', '/quiz/play?g=' + code);
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
// Typing a code by hand: as soon as it's complete, switch to that game's language.
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
function send(value) {
  socket.emit('answer', { value }, (r) => { if (r && r.error) toast(t(r.error)); });
}

function header() {
  const p = S.players.find((x) => x.id === me);
  if (!p) return;
  $('#hA').textContent = p.avatar;
  $('#hN').textContent = p.name;
  $('#hS').innerHTML = S.phase === 'lobby' ? '' : `${num(S.me.score)}<small>${t('place', { ord: ordinal(S.me.rank) })}${S.me.streak >= 2 ? ` · 🔥${S.me.streak}` : ''}</small>`;
}

function render(state) {
  S = state;
  if (useLang(S.settings.lang)) { key = ''; document.title = `${t('titlePlain')} — ${t('player')}`; }
  if (!S.me) { store.set('ms_p_' + code, ''); me = null; return showJoin(); } // removed by the host
  header();
  const k = S.phase + ':' + S.qi;
  const fresh = k !== key;
  key = k;
  const main = $('#main');
  $('#bar').classList.toggle('hidden', S.phase !== 'question');

  if (S.phase === 'lobby') {
    const st = S.settings;
    main.innerHTML = `<div class="card"><div class="big-e">${S.players.find((p) => p.id === me).avatar}</div><h2>${t('youreIn')}</h2>
      <div class="muted" style="font-size:1.1rem">${t('lookBig')}</div>
      <div style="margin-top:14px" class="chip">${t('playersN', { n: S.players.length })}</div>
      <div style="margin-top:10px" class="muted">${t('summary', { tables: st.tables.length === 11 ? t('all') : st.tables.join(', '), count: st.count, time: st.time })}<br>${t(st.mode === 'type' ? 'willType' : 'willPick')}</div></div>`;
  } else if (S.phase === 'countdown') {
    if (fresh) { main.innerHTML = `<div class="white" style="font-size:1.6rem;font-weight:600">${t('getReadyPh')}</div><div class="count">⭐</div>`; navigator.vibrate && navigator.vibrate(80); }
  } else if (S.phase === 'question') {
    syncTimer(S, S.questionMs);
    runTimerBar($('#bar'));
    if (fresh) { typed = ''; picked = null; navigator.vibrate && navigator.vibrate(60); }
    if (S.me.answered) {
      if (fresh || !main.querySelector('.locked')) main.innerHTML = `<div class="card locked"><div class="big-e">🔒</div><h2>${t('locked')}</h2><div class="muted" style="font-size:1.1rem">${picked !== null ? t('youSaid', { v: num(picked) }) : ''}${t('waitingOthers')}</div></div>`;
    } else if (fresh) {
      const q = S.question;
      const qText = esc(q.text) + (q.text.includes('=') ? '' : ' = ?');
      main.innerHTML = q.choices
        ? `<div class="q">${qText}</div><div class="grid4">${q.choices.map((c, i) => `<button class="fruit f${i}" data-v="${c}"><span class="fe">${FRUITS[i]}</span>${num(c)}</button>`).join('')}</div>`
        : `<div class="q">${qText}</div><div class="display empty" id="disp">${t('typeAnswer')}</div>
           <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="del">⌫</button><button data-k="0">0</button><button class="ok" data-k="ok">✓</button></div>`;
    }
  } else if (S.phase === 'reveal') {
    if (!fresh) return;
    const last = S.me.last, q = S.question;
    const fact = q.text.includes('□') ? q.text.replace('□', num(q.answer)) : `${q.text} = ${num(q.answer)}`;
    if (last && last.correct) {
      main.innerHTML = `<div class="card"><div class="big-e">🌟</div><h2>${t('correct')}</h2><div class="pts">+${num(last.points)}</div>
        ${last.bonus ? `<div style="font-size:1.2rem;font-weight:600">${t('streakBonus', { n: S.me.streak, b: last.bonus })}</div>` : ''}
        <div class="muted" style="margin-top:8px">${esc(fact)}</div></div>`;
      beep([659, 784, 1046], 0.09);
      navigator.vibrate && navigator.vibrate([60, 40, 60]);
    } else {
      const timeUp = !last || last.value === null;
      main.innerHTML = `<div class="card"><div class="big-e">${timeUp ? '⏰' : '💪'}</div><h2>${t(timeUp ? 'timeUp' : 'notQuite')}</h2>
        <div style="font-size:2rem;font-weight:700;margin-top:6px">${esc(fact)}</div>
        <div class="muted" style="margin-top:6px">${timeUp ? t('quicker') : t('youSaidNext', { v: num(last.value) })}</div></div>`;
      beep([392, 330], 0.12);
    }
  } else if (S.phase === 'board') {
    if (!fresh) return;
    const r = S.me.rank;
    main.innerHTML = `<div class="card"><div class="big-e">${r === 1 ? '👑' : r <= 3 ? '🏅' : '⭐'}</div><h2>${t('youreRank', { ord: ordinal(r) })}</h2>
      <div class="pts" style="color:var(--ink)">${t('points', { n: num(S.me.score) })}</div>
      <div class="muted">${t(r === 1 ? 'lead' : 'catchUp')}</div></div>`;
  } else if (S.phase === 'final') {
    if (!fresh) return;
    const r = S.me.rank, recap = S.me.recap || [];
    const wrong = recap.filter((x) => !x.correct);
    main.innerHTML = `<div class="card"><div class="big-e">${r === 1 ? '👑' : r === 2 ? '🥈' : r === 3 ? '🥉' : '🌟'}</div>
      <h2>${r === 1 ? t('superstarYou') : t('cameRank', { ord: ordinal(r) })}</h2>
      <div class="pts" style="color:var(--ink)">${t('points', { n: num(S.me.score) })}</div>
      <div class="muted" style="font-size:1.1rem">${t('rightOf', { c: S.me.correctCount, t: recap.length })}${S.me.best >= 3 ? t('bestStreak', { n: S.me.best }) : ''}</div></div>
      <div class="panel"><h3 style="margin:0 0 6px">${t(wrong.length ? 'practise' : 'perfect')}</h3>
      <div class="recap">${wrong.length ? wrong.map((x) => `<div><b>${esc(x.text.includes('□') ? x.text.replace('□', num(x.answer)) : `${x.text} = ${num(x.answer)}`)}</b><span class="bad">${x.mine === null ? t('noAnswer') : t('youSaidShort', { v: num(x.mine) })}</span></div>`).join('') : `<div>${t('allCorrect')}</div>`}</div></div>`;
    if (r === 1) confetti(80);
  }
}

$('#main').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !S || S.phase !== 'question' || S.me.answered) return;
  if (b.dataset.v !== undefined) {
    picked = Number(b.dataset.v);
    for (const x of document.querySelectorAll('.grid4 .fruit')) x.classList.toggle(x === b ? 'picked' : 'faded', true);
    beep([700], 0.05);
    send(picked);
  } else if (b.dataset.k) {
    const k = b.dataset.k;
    if (k === 'del') typed = typed.slice(0, -1);
    else if (k === 'ok') { if (!typed) return toast(t('typeFirst')); picked = Number(typed); beep([700], 0.05); return send(picked); }
    else if (typed.length < 6) typed += k;
    const d = $('#disp');
    d.textContent = typed ? num(Number(typed)) : t('typeAnswer');
    d.classList.toggle('empty', !typed);
  }
});
