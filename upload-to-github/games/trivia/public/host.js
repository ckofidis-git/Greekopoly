// Big screen: lobby with settings, then the wheel, questions, team pies, and the host tools.
const socket = io('/trivia');
let S = null, code = null, stageKey = '', wheelTurns = 0, lastEvent = 0, finalShown = false, adminOpen = false;

const joinUrl = () => `${location.origin}/trivia/play?g=${code}`;
const qrSrc = () => `/qr.svg?u=${encodeURIComponent(joinUrl())}`;
const hostDo = (type, extra = {}, playerId) => socket.emit('host:do', { type, extra, playerId, settings: extra.settings }, (r) => r && r.error && toast(t(r.error)));
const P = (id) => S.players.find((p) => p.id === id);
const TM = (id) => S.teams.find((x) => x.id === id);
const tlabel = (team) => `${team.emoji} ${esc(teamName(team))}`;
const LETTERS = ['A', 'B', 'C', 'D'];
const LCOL = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];

function boot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('tp_host') || 'null'); } catch (e) {}
  if (saved) socket.emit('host:resume', saved, (r) => (r.error ? create() : enter(r.code, r.state)));
  else create();
}
function create() {
  socket.emit('host:create', { lang: guessLang() }, (r) => {
    try { localStorage.setItem('tp_host', JSON.stringify({ code: r.code, hostKey: r.hostKey })); } catch (e) {}
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

// ---------- lobby ----------
function sendSettings(change) { socket.emit('host:do', { type: 'settings', settings: { ...S.settings, ...change } }, (r) => r && r.error && toast(t(r.error))); }
function setLang(lang) { try { localStorage.setItem('hub_lang', lang); } catch (e) {} sendSettings({ lang }); }
const opt = (attr, val, on, label) => `<button class="${on ? 'on' : ''}" data-${attr}="${val}">${label}</button>`;

function renderLobby() {
  $('#lobby').classList.remove('hidden');
  $('#show').classList.add('hidden');
  $('#final').classList.add('hidden');
  $('#adminPanel').classList.add('hidden');
  $('#qr').src = qrSrc();
  $('#code').textContent = code;
  $('#url').textContent = joinUrl();
  $('#kids').innerHTML = S.players.length
    ? S.players.map((p) => `<span class="kid ${p.connected ? '' : 'off'}" style="--oc:#6366f1"><span class="a">${p.avatar}</span>${esc(p.name)}<button class="x" data-kick="${p.id}" title="${t('remove')}">✕</button></span>`).join('')
    : `<div class="waiting">${t('waitingKids')}</div>`;
  const st = S.settings;
  $('#audience').innerHTML = opt('aud', 'greece', st.audience === 'greece', t('audGreece')) + opt('aud', 'world', st.audience === 'world', t('audWorld'));
  $('#level').innerHTML = opt('lvl', 'kids', st.level === 'kids', t('kids')) + opt('lvl', 'adults', st.level === 'adults', t('adults'));
  $('#mode').innerHTML = opt('mode', 'teams', st.mode === 'teams', t('teams')) + opt('mode', 'solo', st.mode === 'solo', t('solo'));
  $('#teamCountBox').classList.toggle('hidden', st.mode !== 'teams');
  $('#teamCount').innerHTML = [2, 3, 4, 5, 6].map((n) => opt('tc', n, st.teamCount === n, n)).join('');
  $('#wedges').innerHTML = [3, 4, 6].map((n) => opt('wedges', n, st.wedges === n, t('w' + n))).join('');
  $('#timer').innerHTML = [20, 30, 45].map((n) => opt('timer', n, st.timer === n, t('secs', { n }))).join('');
  $('#steal').innerHTML = opt('steal', 1, st.steal, t('on')) + opt('steal', 0, !st.steal, t('off'));
  for (const b of $('#langPick').children) b.classList.toggle('sel', b.dataset.lang === LANG);
  $('#startBtn').disabled = !S.players.length;
  $('#startBtn').textContent = S.players.length ? t('start', { n: S.players.length }) : t('waitingPlayers');
}

$('#kids').onclick = (e) => { const id = e.target.dataset.kick; if (id) hostDo('kick', {}, id); };
$('#lobby').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !S) return;
  const d = b.dataset;
  if (d.aud) sendSettings({ audience: d.aud });
  else if (d.lvl) sendSettings({ level: d.lvl });
  else if (d.mode) sendSettings({ mode: d.mode });
  else if (d.tc) sendSettings({ teamCount: Number(d.tc) });
  else if (d.wedges) sendSettings({ wedges: Number(d.wedges) });
  else if (d.timer) sendSettings({ timer: Number(d.timer) });
  else if (d.steal !== undefined) sendSettings({ steal: d.steal === '1' });
  else if (d.lang) setLang(d.lang);
});
$('#startBtn').onclick = () => { beep([523, 659, 784, 1046], 0.1); socket.emit('host:do', { type: 'start', settings: S.settings }, (r) => r && r.error && toast(t(r.error))); };
$('#newBtn').onclick = () => askConfirm(t('newCodeQ'), t('newCodeYes'), () => { localStorage.removeItem('tp_host'); create(); });

// ---------- stage ----------
const SEGS = [...CAT_ORDER, 'free'];
function wheelHTML() {
  const seg = 360 / SEGS.length;
  const stops = SEGS.map((c, i) => `${c === 'free' ? '#ffffff' : CAT_COLOR[c]} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ');
  const labels = SEGS.map((c, i) => {
    const a = (i + 0.5) * seg;
    const icon = c === 'free' ? '🌈' : t('cat.' + c).split(' ')[0];
    const r = a * Math.PI / 180;
    return `<span class="lab" style="left:${50 + 36 * Math.sin(r)}%;top:${50 - 36 * Math.cos(r)}%">${icon}</span>`;
  }).join('');
  return `<div class="pointer">🔻</div><div class="wheel" id="wheel" style="background:conic-gradient(${stops})">${labels}</div><div class="landed" id="landed"></div>`;
}

function turnLine() {
  const tt = TM(S.turnTeam);
  if (!tt) return '';
  const cap = P(tt.captain);
  return `<div class="turnline">${pieHTML(tt, 56)}<span>${t('turnOf', { team: tlabel(tt) })}</span>${!tt.solo && cap ? `<span style="font-size:.7em;opacity:.9">${t('captainIs', { who: `${cap.avatar} ${esc(cap.name)}` })}</span>` : ''}</div>`;
}

function answersHTML() {
  const q = S.question, reveal = S.phase === 'reveal' || S.phase === 'final';
  return `<div class="ans4">${q.a.map((a, i) => {
    let cls = '';
    if (reveal) cls = i === q.correct ? 'right' : i === S.turnPick ? 'wrong' : '';
    else if (S.phase === 'steal' && i === S.turnPick) cls = 'out';
    return `<div class="opt ${cls}"><span class="L" style="background:${LCOL[i]}">${LETTERS[i]}</span>${esc(loc(a))}</div>`;
  }).join('')}</div>`;
}

function renderStage() {
  const st = $('#stage');
  const key = S.phase + ':' + (S.spin ? S.spin.seq : 0) + ':' + (S.question ? S.question.q.en : '') + ':' + LANG;
  const fresh = key !== stageKey;
  stageKey = key;
  const tt = TM(S.turnTeam);
  if (S.phase === 'spin') {
    if (!fresh) return;
    st.innerHTML = turnLine() + wheelHTML();
    const idx = SEGS.indexOf(S.spin.result), seg = 360 / SEGS.length;
    wheelTurns += 5;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const w = $('#wheel');
      if (w) w.style.transform = `rotate(${wheelTurns * 360 - (idx + 0.5) * seg}deg)`;
    }));
    beep([300, 400, 500, 600, 700, 800], 0.18);
    setTimeout(() => { const l = $('#landed'); if (l && S.phase === 'spin') { l.textContent = t('cat.' + S.spin.result); beep([784, 1046], 0.1); } }, 3700);
  } else if (S.phase === 'choose') {
    if (!fresh) return;
    const cap = tt && P(tt.captain);
    st.innerHTML = `${turnLine()}<div class="landed">${t('cat.free')}</div><div class="status">${t('choosing', { who: cap ? `${cap.avatar} ${esc(cap.name)}` : '' })}</div>
      <div class="row wrap" style="justify-content:center">${S.chooseCats.map((c) => `<span class="catbadge" style="background:${CAT_COLOR[c]}">${t('cat.' + c)}</span>`).join('')}</div>`;
  } else if (S.phase === 'question' || S.phase === 'steal' || S.phase === 'reveal') {
    const q = S.question;
    if (fresh) {
      st.innerHTML = `${turnLine()}<div class="qbox"><span class="catbadge" style="background:${CAT_COLOR[q.cat]}">${t('cat.' + q.cat)}</span>
        <div class="qq">${esc(loc(q.q))}</div>${answersHTML()}<div class="timer" id="bar"><i></i></div></div>
        <div class="status" id="status"></div><div id="after"></div>`;
      if (S.phase === 'question') beep([784, 988], 0.08);
    }
    // status line
    let status = '';
    if (S.phase === 'question' && tt) status = t('votedN', { n: tt.voters, m: tt.members.length });
    if (S.phase === 'steal') {
      const pick = S.turnPick;
      status = (pick === null ? t('noAnswer', { team: tlabel(tt) }) : t('wrongPick', { team: tlabel(tt), ans: esc(loc(q.a[pick])) })) + '<br>' + t('stealTime');
    }
    $('#status').innerHTML = status;
    if (S.phase === 'reveal' && fresh) {
      const r = S.result;
      const stole = r.stealRight.map((id) => TM(id)).filter(Boolean).map(tlabel).join(', ');
      $('#after').innerHTML = `<div class="landed" style="font-size:4vh">${r.turnRight ? (r.wedge ? t('rightWedge', { team: tlabel(tt), cat: t('cat.' + r.wedge) }) : t('rightNoWedge', { team: tlabel(tt) })) : t('wrongT') + ' ' + t('answerWas', { a: esc(loc(q.a[q.correct])) })}</div>
        ${stole ? `<div class="status">${t('stoleBy', { teams: stole })}</div>` : ''}
        ${r.overridden ? `<div class="status">${t('overridden')}</div>` : ''}
        <div class="fact"><b>${t('didYouKnow')}</b> ${esc(loc(q.fact))}</div>`;
      if (r.turnRight) { confetti(r.wedge ? 60 : 25); beep([523, 659, 784, 1046], 0.1); } else beep([392, 330], 0.12);
    }
    if (S.phase !== 'reveal') {
      syncTimer(S, S.phaseMs);
      if (!S.paused) runTimerBar($('#bar')); else cancelAnimationFrame(runTimerBar.raf);
    } else { cancelAnimationFrame(runTimerBar.raf); const b = $('#bar'); if (b) b.classList.add('hidden'); }
  }
}

function renderTeams() {
  $('#teams').innerHTML = S.teams.map((tm) => `<div class="tcard ${tm.id === S.turnTeam ? 'turn' : ''}" style="--tc:${tm.color}">${pieHTML(tm, 52)}
    <div style="min-width:0"><div class="nm">${tlabel(tm)}</div>
      ${tm.solo ? '' : `<div class="mem">${tm.members.map((id) => { const p = P(id); return p ? `<span title="${esc(p.name)}">${tm.captain === id ? '👑' : ''}${p.avatar}</span>` : ''; }).join('')}</div>`}</div>
    <div class="pts">${t('pointsShort', { n: tm.points })}</div></div>`).join('');
  $('#events').innerHTML = S.events.slice().reverse().map((e) => {
    const p = { ...e.p };
    if (p.team) { const tm = TM(p.team); p.team = tm ? tlabel(tm) : '?'; }
    if (p.cat) p.cat = t('cat.' + p.cat);
    return `<div>${t('ev.' + e.k, p)}</div>`;
  }).join('');
}

// ---------- host tools ----------
function renderAdmin() {
  const box = $('#adminPanel');
  box.classList.toggle('hidden', !adminOpen || S.phase === 'final');
  if (!adminOpen) return;
  const others = (tm) => S.teams.filter((x) => x !== tm && !x.solo);
  box.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">${t('adminT')}</h3><button class="btn-soft" data-close>${t('close')}</button></div>
    ${S.settings.mode === 'teams' ? `<button class="btn-soft" data-reshuffle style="margin:8px 0">${t('reshuffle')}</button>` : ''}
    <div class="muted" style="margin-bottom:8px">${t('wedgeTip')}</div>
    ${S.teams.map((tm) => `<div class="ateam" style="--tc:${tm.color}">
      <div class="row">${pieHTML(tm, 70, true)}<div class="grow"><b>${tlabel(tm)}</b><br>${t('pointsShort', { n: tm.points })}</div>
        <button class="btn-soft" data-pts="-10" data-team="${tm.id}">−10</button><button class="btn-soft" data-pts="10" data-team="${tm.id}">+10</button>
        <button class="btn-soft" data-rename="${tm.id}">${t('rename')}</button></div>
      ${tm.members.map((id) => { const p = P(id); if (!p) return ''; return `<div class="pm">${p.avatar} ${esc(p.name)} ${tm.captain === id ? '👑' : ''}<span class="grow"></span>
        ${!tm.solo && tm.captain !== id ? `<button class="btn-soft" data-cap="${id}" data-team="${tm.id}">${t('makeCaptain')}</button>` : ''}
        ${!tm.solo && others(tm).length ? `<select data-move="${id}"><option value="">${t('moveTo')}</option>${others(tm).map((o) => `<option value="${o.id}">${o.emoji} ${esc(teamName(o))}</option>`).join('')}</select>` : ''}
        <button class="btn-soft" data-kickp="${id}" title="${t('remove')}">✕</button></div>`; }).join('')}
    </div>`).join('')}`;
}

$('#adminPanel').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if ('close' in d) { adminOpen = false; renderAdmin(); }
  else if ('reshuffle' in d) askConfirm(t('reshuffleQ'), t('reshuffle'), () => hostDo('reshuffle'));
  else if (d.pts) hostDo('points', { teamId: d.team, delta: Number(d.pts) });
  else if (d.cat) hostDo('wedge', { teamId: d.team, cat: d.cat });
  else if (d.cap) hostDo('captain', { teamId: d.team, playerId: d.cap });
  else if (d.kickp) hostDo('kick', {}, d.kickp);
  else if (d.rename) {
    const tm = TM(d.rename);
    const el = document.createElement('div');
    el.className = 'overlay';
    el.innerHTML = `<div class="panel" style="width:min(420px,92vw)"><h3 style="margin-top:0">${t('renameQ')}</h3>
      <input id="rn" maxlength="18" value="${esc(teamName(tm))}" style="font:inherit;font-size:1.3rem;width:100%;padding:10px;border-radius:12px;border:3px solid #c7d2fe">
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn-soft" data-no>${t('cancel')}</button><button class="btn-pink" data-yes>${t('save')}</button></div></div>`;
    el.onclick = (ev) => {
      if (ev.target === el || ev.target.closest('[data-no]')) el.remove();
      else if (ev.target.closest('[data-yes]')) { hostDo('rename', { teamId: tm.id, name: el.querySelector('#rn').value }); el.remove(); }
    };
    document.body.appendChild(el);
    el.querySelector('#rn').focus();
  }
});
$('#adminPanel').addEventListener('change', (e) => {
  const s = e.target.closest('select[data-move]');
  if (s && s.value) hostDo('move', { playerId: s.dataset.move, teamId: s.value });
});

function renderControls() {
  const playing = S.phase !== 'final' && S.phase !== 'lobby';
  for (const id of ['#manageBtn', '#pauseBtn', '#skipBtn', '#endBtn']) $(id).classList.toggle('hidden', !playing);
  $('#extendBtn').classList.toggle('hidden', !(S.phase === 'question' || S.phase === 'steal' || S.phase === 'choose'));
  $('#overrideBtn').classList.toggle('hidden', S.phase !== 'reveal');
  if (S.phase === 'reveal') $('#overrideBtn').textContent = S.result && S.result.turnRight ? t('undoRight') : t('override');
  $('#pauseBtn').textContent = S.paused ? t('resume') : t('pause');
  $('#pauseBtn').classList.toggle('hidden', !playing || !S.remainingMs);
}

function renderFinal() {
  $('#final').classList.remove('hidden');
  const order = S.ranking.map(TM).filter(Boolean);
  const win = order[0];
  $('#finalBox').innerHTML = `<h1 style="margin:0">${t('winnerT', { team: win ? tlabel(win) : '' })}</h1>
    <div style="display:flex;justify-content:center;margin:10px 0">${win ? pieHTML(win, 130) : ''}</div>
    <h3 style="text-align:left;margin:8px 0 4px">${t('everyoneH')}</h3>
    <div class="rest">${order.map((tm, i) => `<div><b>${ordinal(i + 1)}</b> ${pieHTML(tm, 30)} ${tlabel(tm)}<span class="grow"></span>${t('slices', { n: tm.wedges.length })} · <b>${t('points', { n: tm.points })}</b></div>`).join('')}</div>
    <details style="text-align:left;margin-top:10px"><summary><b>${t('recapH')}</b> (${S.history.length})</summary>
      <div class="rest">${S.history.map((h) => `<div><span>${h.right ? '✅' : '❌'}</span> <span class="catbadge" style="background:${CAT_COLOR[h.cat]};padding:1px 8px;font-size:.8rem">${t('cat.' + h.cat).split(' ')[0]}</span> ${esc(loc(h.q))} <b>→ ${esc(loc(h.answer))}</b></div>`).join('')}</div></details>
    <button class="btn-pink big" id="againBtn" style="margin-top:14px">${t('again')}</button>`;
  $('#againBtn').onclick = () => hostDo('lobby');
  if (!finalShown) { finalShown = true; confetti(120); beep([523, 659, 784, 1046, 1318], 0.14); }
}

function render(state) {
  S = state;
  if (useLang(S.settings.lang)) {
    stageKey = '';
    document.title = `${t('titlePlain')} — ${t('bigScreen')}`;
    $('#soundBtn').textContent = t(soundOn ? 'soundOn' : 'soundOff');
    $('#langBtn').textContent = LANG === 'el' ? '🇬🇧 English' : '🇬🇷 Ελληνικά';
  }
  if (S.phase === 'lobby') { finalShown = false; stageKey = ''; return renderLobby(); }
  $('#lobby').classList.add('hidden');
  $('#show').classList.remove('hidden');
  $('#qrSmall').src = qrSrc();
  $('#codeSmall').textContent = code;
  for (const part of [renderStage, renderTeams, renderAdmin, renderControls]) { try { part(); } catch (e) { console.error(e); } }
  if (S.phase === 'final') renderFinal(); else $('#final').classList.add('hidden');
}

$('#manageBtn').onclick = () => { adminOpen = !adminOpen; renderAdmin(); };
$('#overrideBtn').onclick = () => hostDo('override');
$('#pauseBtn').onclick = () => hostDo('pause');
$('#extendBtn').onclick = () => hostDo('extend');
$('#skipBtn').onclick = () => hostDo('skip');
$('#endBtn').onclick = () => askConfirm(t('endQ'), t('end'), () => hostDo('end'));
$('#langBtn').onclick = () => setLang(LANG === 'el' ? 'en' : 'el');
$('#fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$('#soundBtn').onclick = (e) => { soundOn = !soundOn; e.target.textContent = t(soundOn ? 'soundOn' : 'soundOff'); };
