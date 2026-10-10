// Phone: join, then answer each question.
const socket = io('/quiz');
let code = (new URLSearchParams(location.search).get('g') || '').toUpperCase();
let me = null, S = null, avatar = null, key = '', typed = '', picked = null;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------- joining ----------
function tryJoin(extra = {}) {
  if (!code) return showJoin();
  socket.emit('player:join', { code, playerId: store.get('ms_p_' + code), ...extra }, (r) => {
    if (r.error) { toast(r.error); if (/No game/.test(r.error)) code = ''; return showJoin(); }
    if (r.needJoin) return showJoin();
    me = r.playerId;
    store.set('ms_p_' + code, me);
    history.replaceState(null, '', '/quiz/play?g=' + code);
    $('#joinScreen').classList.add('hidden');
    $('#gameScreen').classList.remove('hidden');
  });
}
socket.on('connect', () => tryJoin());
socket.on('state', (s) => { if (me && s.code === code) render(s); });

function showJoin() {
  $('#joinScreen').classList.remove('hidden');
  $('#gameScreen').classList.add('hidden');
  $('#codeBox').classList.toggle('hidden', !!code);
  $('#avs').innerHTML = AVATARS.map((a) => `<button class="${a === avatar ? 'sel' : ''}" data-a="${a}">${a}</button>`).join('');
}
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
  if (!code) return toast('Type the game code from the big screen.');
  if (!name) return toast('Type your name first! ✏️');
  if (!avatar) return toast('Pick an avatar! 🦄');
  tryJoin({ name, avatar });
};

// ---------- playing ----------
function send(value) {
  socket.emit('answer', { value }, (r) => { if (r && r.error) toast(r.error); });
}

function header() {
  const p = S.players.find((x) => x.id === me);
  if (!p) return;
  $('#hA').textContent = p.avatar;
  $('#hN').textContent = p.name;
  $('#hS').innerHTML = S.phase === 'lobby' ? '' : `${num(S.me.score)}<small>${ordinal(S.me.rank)} place${S.me.streak >= 2 ? ` · 🔥${S.me.streak}` : ''}</small>`;
}

function render(state) {
  S = state;
  if (!S.me) { store.set('ms_p_' + code, ''); me = null; return showJoin(); } // removed by the host
  header();
  const k = S.phase + ':' + S.qi;
  const fresh = k !== key;
  key = k;
  const main = $('#main');
  $('#bar').classList.toggle('hidden', S.phase !== 'question');

  if (S.phase === 'lobby') {
    const st = S.settings;
    main.innerHTML = `<div class="card"><div class="big-e">${S.players.find((p) => p.id === me).avatar}</div><h2>You're in! 🎉</h2>
      <div class="muted" style="font-size:1.1rem">Look at the big screen — the quiz starts soon!</div>
      <div style="margin-top:14px" class="chip">👫 ${S.players.length} player${S.players.length > 1 ? 's' : ''}</div>
      <div style="margin-top:10px" class="muted">Tables: ${st.tables.length === 11 ? 'all' : st.tables.join(', ')} · ${st.count} questions · ${st.time}s each<br>${st.mode === 'type' ? '⌨️ You will type your answers' : '🍓 You will pick from 4 answers'}</div></div>`;
  } else if (S.phase === 'countdown') {
    if (fresh) { main.innerHTML = `<div class="white" style="font-size:1.6rem;font-weight:600">Get ready! 🚀</div><div class="count">⭐</div>`; navigator.vibrate && navigator.vibrate(80); }
  } else if (S.phase === 'question') {
    syncTimer(S, S.questionMs);
    runTimerBar($('#bar'));
    if (fresh) { typed = ''; picked = null; navigator.vibrate && navigator.vibrate(60); }
    if (S.me.answered) {
      if (fresh || !main.querySelector('.locked')) main.innerHTML = `<div class="card locked"><div class="big-e">🔒</div><h2>Locked in!</h2><div class="muted" style="font-size:1.1rem">${picked !== null ? `You said <b>${num(picked)}</b>. ` : ''}Waiting for the others…</div></div>`;
    } else if (fresh) {
      const q = S.question;
      const qText = esc(q.text) + (q.text.includes('=') ? '' : ' = ?');
      main.innerHTML = q.choices
        ? `<div class="q">${qText}</div><div class="grid4">${q.choices.map((c, i) => `<button class="fruit f${i}" data-v="${c}"><span class="fe">${FRUITS[i]}</span>${num(c)}</button>`).join('')}</div>`
        : `<div class="q">${qText}</div><div class="display empty" id="disp">Type your answer</div>
           <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="del">⌫</button><button data-k="0">0</button><button class="ok" data-k="ok">✓</button></div>`;
    }
  } else if (S.phase === 'reveal') {
    if (!fresh) return;
    const last = S.me.last, q = S.question;
    const fact = q.text.includes('□') ? q.text.replace('□', num(q.answer)) : `${q.text} = ${num(q.answer)}`;
    if (last && last.correct) {
      main.innerHTML = `<div class="card"><div class="big-e">🌟</div><h2>Correct!</h2><div class="pts">+${num(last.points)}</div>
        ${last.bonus ? `<div style="font-size:1.2rem;font-weight:600">🔥 ${S.me.streak} in a row! +${last.bonus} bonus</div>` : ''}
        <div class="muted" style="margin-top:8px">${esc(fact)}</div></div>`;
      beep([659, 784, 1046], 0.09);
      navigator.vibrate && navigator.vibrate([60, 40, 60]);
    } else {
      const timeUp = !last || last.value === null;
      main.innerHTML = `<div class="card"><div class="big-e">${timeUp ? '⏰' : '💪'}</div><h2>${timeUp ? "Time's up!" : 'Not quite!'}</h2>
        <div style="font-size:2rem;font-weight:700;margin-top:6px">${esc(fact)}</div>
        <div class="muted" style="margin-top:6px">${timeUp ? 'Be quicker next time!' : `You said ${num(last.value)}. You'll get the next one!`}</div></div>`;
      beep([392, 330], 0.12);
    }
  } else if (S.phase === 'board') {
    if (!fresh) return;
    const r = S.me.rank;
    main.innerHTML = `<div class="card"><div class="big-e">${r === 1 ? '👑' : r <= 3 ? '🏅' : '⭐'}</div><h2>You're ${ordinal(r)}!</h2>
      <div class="pts" style="color:var(--ink)">${num(S.me.score)} points</div>
      <div class="muted">${r === 1 ? 'You are in the lead! Keep going!' : 'Next question coming… you can catch up!'}</div></div>`;
  } else if (S.phase === 'final') {
    if (!fresh) return;
    const r = S.me.rank, recap = S.me.recap || [];
    const wrong = recap.filter((x) => !x.correct);
    main.innerHTML = `<div class="card"><div class="big-e">${r === 1 ? '👑' : r === 2 ? '🥈' : r === 3 ? '🥉' : '🌟'}</div>
      <h2>${r === 1 ? "You're the Maths Superstar!" : `You came ${ordinal(r)}!`}</h2>
      <div class="pts" style="color:var(--ink)">${num(S.me.score)} points</div>
      <div class="muted" style="font-size:1.1rem">✅ ${S.me.correctCount} of ${recap.length} right${S.me.best >= 3 ? ` · 🔥 best streak ${S.me.best}` : ''}</div></div>
      <div class="panel"><h3 style="margin:0 0 6px">${wrong.length ? '🧠 Practise these' : '🎉 Perfect score!'}</h3>
      <div class="recap">${wrong.length ? wrong.map((x) => `<div><b>${esc(x.text.includes('□') ? x.text.replace('□', num(x.answer)) : `${x.text} = ${num(x.answer)}`)}</b><span class="bad">${x.mine === null ? 'no answer' : `you said ${num(x.mine)}`}</span></div>`).join('') : '<div>You got every single one right. Amazing! 🌟</div>'}</div></div>`;
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
    else if (k === 'ok') { if (!typed) return toast('Type a number first!'); picked = Number(typed); beep([700], 0.05); return send(picked); }
    else if (typed.length < 6) typed += k;
    const d = $('#disp');
    d.textContent = typed ? num(Number(typed)) : 'Type your answer';
    d.classList.toggle('empty', !typed);
  }
});
