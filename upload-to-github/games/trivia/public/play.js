// Phone: vote on answers with your team; the captain gives the final answer; pick a category on a free spin.
const socket = io('/trivia');
let code = (new URLSearchParams(location.search).get('g') || '').toUpperCase();
let me = null, S = null, avatar = null, shownReveal = '', wasTurn = false;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const LETTERS = ['A', 'B', 'C', 'D'];
const LCOL = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];

// ---------- joining ----------
function tryJoin(extra = {}) {
  if (!code) return showJoin();
  socket.emit('player:join', { code, playerId: store.get('tp_p_' + code), ...extra }, (r) => {
    if (r.lang) useLang(r.lang);
    if (r.error) { toast(t(r.error)); if (r.error === 'err.nogame') code = ''; return showJoin(); }
    if (r.needJoin) return showJoin();
    me = r.playerId;
    store.set('tp_p_' + code, me);
    history.replaceState(null, '', '/trivia/play?g=' + code);
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
const TM = (id) => S.teams.find((x) => x.id === id);
const tlabel = (team) => `${team.emoji} ${esc(teamName(team))}`;
function act(type, extra = {}) {
  socket.emit('act', { type, ...extra }, (r) => { if (r && r.error) { toast(t(r.error)); beep([300, 220], 0.12); } });
}

function header() {
  const p = P(me), mine = S.me.team && TM(S.me.team);
  $('#hA').textContent = p.avatar;
  $('#hN').textContent = p.name;
  $('#hT').innerHTML = mine && !mine.solo ? `${pieHTML(mine, 26)}${tlabel(mine)}` : mine ? `${pieHTML(mine, 26)}${t('pointsShort', { n: mine.points })}` : '';
  $('#hT').style.borderLeft = mine ? `6px solid ${mine.color}` : '';
  $('#stat').textContent = '';
}

function answersHTML(interactive) {
  const q = S.question, m = S.me;
  const reveal = S.phase === 'reveal' || S.phase === 'final';
  return `<div class="ans4">${q.a.map((a, i) => {
    let cls = '';
    if (reveal) cls = i === q.correct ? 'right' : i === S.turnPick ? 'wrong' : '';
    else if (S.phase === 'steal' && i === S.turnPick) cls = 'out';
    if (!reveal && m.myVote === i) cls += ' mine';
    const voters = (m.teamVotes[i] || []).map((id) => (P(id) || {}).avatar || '').join('');
    return `<button class="opt ${cls}" data-i="${i}" ${interactive ? '' : 'disabled'}><span class="L" style="background:${LCOL[i]}">${LETTERS[i]}</span>${esc(loc(a))}<span class="votes">${reveal ? '' : voters}</span></button>`;
  }).join('')}</div>`;
}

function render(state) {
  S = state;
  if (!S.me) { store.set('tp_p_' + code, ''); me = null; return showJoin(); } // removed by the host
  if (useLang(S.settings.lang)) { shownReveal = ''; document.title = `${t('titlePlain')} — ${t('player')}`; }
  header();
  const main = $('#main'), m = S.me, mine = m.team && TM(m.team), tt = TM(S.turnTeam);
  const timed = S.phase === 'question' || S.phase === 'steal' || S.phase === 'choose';
  $('#bar').classList.toggle('hidden', !timed);
  if (timed) { syncTimer(S, S.phaseMs); if (!S.paused) runTimerBar($('#bar')); else cancelAnimationFrame(runTimerBar.raf); }

  if (S.phase === 'lobby') {
    main.innerHTML = `<div class="card"><div class="big-e">${P(me).avatar}</div><h2>${t('youreIn')}</h2>
      <div class="muted" style="font-size:1.1rem">${t('lookBig')}</div>
      <div style="margin-top:12px" class="chip">${t('playersN', { n: S.players.length })}</div></div>
      <div class="panel" style="font-size:1rem;line-height:1.5">${t('rules')}</div>`;
    return;
  }
  if (S.phase === 'final') {
    const order = S.ranking || [];
    const place = order.indexOf(m.team) + 1;
    const won = place === 1;
    main.innerHTML = `<div class="card"><div class="big-e">${won ? '👑' : '🥧'}</div>
      <h2>${mine && mine.solo ? (won ? t('youWon') : t('youPlace', { ord: ordinal(place) })) : (won ? t('teamWon') : t('teamPlace', { ord: ordinal(place) }))}</h2>
      ${mine ? `<div style="display:flex;justify-content:center;margin:8px 0">${pieHTML(mine, 110)}</div><div style="font-weight:700">${t('slices', { n: mine.wedges.length })} · ${t('points', { n: mine.points })}</div>` : ''}</div>`;
    if (won && shownReveal !== 'won') { shownReveal = 'won'; confetti(80); }
    return;
  }

  const myTurn = !!mine && mine.id === S.turnTeam;
  if (myTurn && !wasTurn && S.phase === 'spin') { navigator.vibrate && navigator.vibrate([100, 50, 100]); beep([660, 880, 1100], 0.08); }
  wasTurn = myTurn;
  const turnBanner = tt ? `<div class="banner2 ${myTurn ? 'mine' : ''}">${myTurn ? t('yourTurn') + ' ' : ''}${t('turnOf', { team: tlabel(tt) })}</div>` : '';

  if (S.phase === 'spin') {
    main.innerHTML = `${turnBanner}<div class="card"><div class="big-e">🎡</div><h2>${t('spinning')}</h2></div>`;
    return;
  }
  if (S.phase === 'choose') {
    const cap = tt && P(tt.captain);
    main.innerHTML = turnBanner + (m.captain && myTurn
      ? `<div class="card"><h2>${t('pickCat')}</h2><div class="catpick">${S.chooseCats.map((c) => `<button data-cat="${c}" style="background:${CAT_COLOR[c]}">${t('cat.' + c)}</button>`).join('')}</div></div>`
      : `<div class="card"><div class="big-e">🌈</div><h2>${t('cat.free')}</h2><div class="muted">${t('choosing', { who: cap ? `${cap.avatar} ${esc(cap.name)}` : '' })}</div></div>`);
    return;
  }
  const q = S.question;
  if (!q) return;
  if (S.phase === 'reveal') {
    const key = q.q.en + LANG;
    if (shownReveal === key) return;
    shownReveal = key;
    const r = S.result;
    const myRight = myTurn ? r.turnRight : r.stealRight.includes(m.team);
    main.innerHTML = `${turnBanner}<div class="qcard"><span class="catbadge" style="background:${CAT_COLOR[q.cat]}">${t('cat.' + q.cat)}</span>
        <div class="qq">${esc(loc(q.q))}</div>${answersHTML(false)}</div>
      <div class="banner2 ${myRight ? 'mine' : ''}">${r.turnRight ? (r.wedge ? t('rightWedge', { team: tlabel(tt), cat: t('cat.' + r.wedge) }) : t('rightNoWedge', { team: tlabel(tt) })) : t('wrongT')}</div>
      <div class="fact"><b>${t('didYouKnow')}</b> ${esc(loc(q.fact))}</div>`;
    if (myRight) { confetti(myTurn && r.wedge ? 50 : 20); beep([523, 659, 784, 1046], 0.09); navigator.vibrate && navigator.vibrate([60, 40, 60]); }
    return;
  }
  // question or steal
  shownReveal = '';
  const canAnswer = m.canAnswer;
  let hint;
  if (canAnswer) hint = mine.solo ? t('soloHint') : m.captain ? `${t('youCaptain')}<br><span style="font-weight:500">${t('capHint')}</span>` : t('voteHint');
  else if (m.teamFinal !== null && ((S.phase === 'question' && myTurn) || (S.phase === 'steal' && S.stealers.includes(m.team)))) hint = t('locked');
  else hint = S.phase === 'steal' ? t('stealTime') : (S.settings.steal ? t('watchingSteal', { team: tlabel(tt) }) : t('watching', { team: tlabel(tt) }));
  if (S.phase === 'steal' && canAnswer) hint = `${t('stealNow')}<br><span style="font-weight:500">${mine.solo ? '' : m.captain ? t('capHint') : t('voteHint')}</span>`;
  // the captain's final button: their own vote, or the team's favourite
  let finalBtn = '';
  if (canAnswer && m.captain && !mine.solo) {
    const tally = [0, 1, 2, 3].map((i) => (m.teamVotes[i] || []).length);
    const pick = m.myVote !== null ? m.myVote : tally.some(Boolean) ? tally.indexOf(Math.max(...tally)) : null;
    if (pick !== null) finalBtn = `<button class="btn-pink huge" data-final="${pick}">${t('finalBtn', { a: `${LETTERS[pick]} — ${esc(loc(q.a[pick]))}` })}</button>`;
  }
  main.innerHTML = `${turnBanner}<div class="qcard"><span class="catbadge" style="background:${CAT_COLOR[q.cat]}">${t('cat.' + q.cat)}</span>
      <div class="qq">${esc(loc(q.q))}</div>${answersHTML(canAnswer)}</div>
    <div class="banner2 ${canAnswer ? 'mine' : ''}">${hint}</div>${finalBtn}`;
}

$('#main').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !S) return;
  if (b.dataset.cat) { act('choose', { cat: b.dataset.cat }); return; }
  if (b.dataset.final !== undefined) { act('final', { idx: Number(b.dataset.final) }); beep([523, 784], 0.07); return; }
  if (b.dataset.i !== undefined && !b.disabled) { act('vote', { idx: Number(b.dataset.i) }); beep([700], 0.05); }
});
