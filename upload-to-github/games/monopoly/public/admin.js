// Big screen: shows the lobby QR code, then the board.
const socket = io('/monopoly');
let S = null;            // latest state
let code = null;
let soundOn = true;
const shown = { pos: {}, diceSeq: null, cardSeq: null, owners: {}, over: false };
const sfx = (n, d) => soundOn && beep(n, d);

const joinUrl = () => `${location.origin}/monopoly/play?g=${code}`;
const qrSrc = () => `/qr.svg?u=${encodeURIComponent(joinUrl())}`;

function adminDo(type, extra = {}) {
  socket.emit('admin:do', { type, ...extra }, (r) => r && r.error && toast(r.error));
}

function boot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('gk_admin') || 'null'); } catch (e) {}
  if (saved) {
    socket.emit('admin:resume', saved, (r) => (r.error ? createGame() : enter(r.code, r.state)));
  } else createGame();
}
function createGame() {
  socket.emit('admin:create', {}, (r) => {
    try { localStorage.setItem('gk_admin', JSON.stringify({ code: r.code, adminKey: r.adminKey })); } catch (e) {}
    enter(r.code, r.state);
  });
}
function enter(c, state) {
  code = c;
  for (const k of Object.keys(shown.pos)) delete shown.pos[k];
  shown.diceSeq = state.diceSeq; shown.cardSeq = state.card ? state.card.seq : 0; shown.over = state.phase === 'over';
  shown.owners = { ...state.owners };
  render(state);
}
socket.on('connect', () => { if (code) boot(); });
socket.on('state', render);
boot();

// ---------- lobby ----------
function renderLobby() {
  $('#lobby').classList.remove('hidden');
  $('#game').classList.add('hidden');
  $('#qr').src = qrSrc();
  $('#code').textContent = code;
  $('#url').textContent = joinUrl();
  const slots = S.players.map((p) => `<div class="panel lp" style="border:4px solid ${p.color}">
      <button class="x" data-kick="${p.id}" title="Remove">✕</button>
      <div class="e">${p.emoji}</div><div class="n">${esc(p.name)}</div>
      <div class="muted">${p.connected ? 'Ready! 💖' : 'Reconnecting…'}</div></div>`);
  for (let i = S.players.length; i < 8; i++) slots.push(`<div class="empty-slot">${i + 1}<small>waiting for a friend…</small></div>`);
  $('#playerCount').textContent = `👫 Players: ${S.players.length} of 8`;
  $('#lobbyPlayers').innerHTML = slots.join('');
  $('#jackpot').checked = S.settings.jackpot;
  $('#themePick').innerHTML = Object.values(window.BOARD.THEMES).map((t) => `<button data-theme="${t.id}" class="${t.id === S.settings.theme ? 'sel' : ''}">
      <span class="ti">${t.icon}</span><span><b>${t.title}</b><small>${esc(t.tagline)}</small></span></button>`).join('');
  $('#startBtn').disabled = S.players.length < 2;
  $('#startHint').textContent = S.players.length < 2 ? 'Waiting for at least 2 players (2 to 8 can play)…' : S.players.length === 8 ? "8 players — the game is full! Let's go!" : `${S.players.length} players ready — more friends can still join (up to 8)!`;
}
$('#lobbyPlayers').addEventListener('click', (e) => {
  const id = e.target.dataset.kick;
  if (id) adminDo('kick', { playerId: id });
});
$('#themePick').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme]');
  if (b) { sfx([660, 990], 0.08); adminDo('settings', { settings: { jackpot: $('#jackpot').checked, theme: b.dataset.theme } }); }
});
$('#jackpot').onchange = (e) => adminDo('settings', { settings: { jackpot: e.target.checked, theme: S.settings.theme } });
$('#startBtn').onclick = () => { sfx([523, 659, 784, 1046], 0.12); adminDo('start', { settings: { jackpot: $('#jackpot').checked, theme: S.settings.theme } }); };
$('#newBtn').onclick = () => askConfirm('Start a brand new game with a new code? Everyone will need to scan again.', 'Yes, new game', () => { localStorage.removeItem('gk_admin'); createGame(); });
$('#againBtn').onclick = () => { $('#over').classList.add('hidden'); adminDo('reset'); };

// ---------- board ----------
function cellOf(i) {
  if (i <= 10) return [11, 11 - i];
  if (i <= 20) return [11 - (i - 10), 1];
  if (i <= 30) return [1, 1 + (i - 20)];
  return [1 + (i - 30), 11];
}
function sideOf(i) { return i < 10 ? 'b' : i < 20 ? 'l' : i < 30 ? 't' : 'r'; }

function buildBoard() {
  const board = $('#board');
  board.querySelectorAll('.tile').forEach((t) => t.remove());
  SPACES.forEach((sp, i) => {
    const t = document.createElement('div');
    const [r, c] = cellOf(i);
    t.style.gridArea = `${r} / ${c}`;
    t.id = 't' + i;
    const corner = i % 10 === 0;
    const hasBand = sp.type === 'street';
    t.className = `tile side-${sideOf(i)} ${corner ? 'corner' : ''} ${hasBand ? '' : 'special'}`;
    t.innerHTML = `${hasBand ? `<div class="band" style="background:${GROUPS[sp.group].color}"></div>` : ''}
      <div class="info"><div class="em">${sp.emoji}</div><div class="nm">${esc(sp.name)}</div>
      ${sp.price ? `<div class="pr">${eur(sp.price)}</div>` : sp.amount ? `<div class="pr">pay ${eur(sp.amount)}</div>` : ''}</div>`;
    board.appendChild(t);
  });
}
buildBoard();

// Dress the screen in the chosen theme (names, flags, wording, decorations).
let themeShown = null;
function applyTheme() {
  useTheme(S.settings.theme);
  if (themeShown === TH.id) return;
  themeShown = TH.id;
  buildBoard();
  document.title = `${TH.title} — Big Screen`;
  $('#lobbyLogo').textContent = TH.title; $('#lobbyTag').textContent = TH.tagline;
  $('#boardLogo').textContent = TH.title; $('#boardTag').textContent = TH.boardTag;
  document.querySelectorAll('[data-d]').forEach((el) => { el.textContent = TH.deco[el.dataset.d]; });
  $('#jackpotLabel').innerHTML = `${TH.parkingIco} <b>${TH.parkingName} jackpot</b> <span class="muted">(house rule — taxes & fines go to ${TH.parkingName}; land there to win them!)</span>`;
}

function tokenXY(pos, idx, count, inJail) {
  const t = $('#t' + pos);
  const w = t.offsetWidth, h = t.offsetHeight, size = Math.min($('#board').offsetWidth, $('#board').offsetHeight) * 0.054;
  const cols = count > 4 ? 3 : 2;
  const r = Math.floor(idx / cols), c = idx % cols;
  const spread = Math.min(w, h) * 0.36;
  let cx = t.offsetLeft + w / 2 + (c - (Math.min(count, cols) - 1) / 2) * spread;
  let cy = t.offsetTop + h / 2 + (r - (Math.ceil(count / cols) - 1) / 2) * spread;
  if (pos === 10) { // jail corner: prisoners inside, visitors on the edge
    if (inJail) { cx += w * 0.12; cy -= h * 0.12; } else { cx -= w * 0.22; cy += h * 0.22; }
  }
  return [cx - size / 2, cy - size / 2];
}

function placeTokens() {
  const layer = $('#tokens');
  const live = S.players.filter((p) => !p.bankrupt);
  for (const el of [...layer.children]) if (!live.some((p) => 'k' + p.id === el.id)) el.remove();
  const byPos = {};
  for (const p of live) {
    const pos = shown.pos[p.id] ?? p.pos;
    (byPos[pos] = byPos[pos] || []).push(p);
  }
  for (const [pos, list] of Object.entries(byPos)) {
    list.forEach((p, i) => {
      let el = $('#k' + p.id);
      if (!el) { el = document.createElement('div'); el.id = 'k' + p.id; el.className = 'tok'; layer.appendChild(el); }
      el.style.borderColor = p.color;
      el.innerHTML = p.emoji + (p.inJail && Number(pos) === 10 ? '<span class="lock">🔒</span>' : '');
      el.classList.toggle('cur', S.phase === 'playing' && S.players[S.turn].id === p.id);
      const [x, y] = tokenXY(Number(pos), i, list.length, p.inJail);
      el.style.left = x + 'px'; el.style.top = y + 'px';
    });
  }
}

const walking = {};
function animateTokens() {
  for (const p of S.players) {
    if (p.bankrupt) continue;
    if (shown.pos[p.id] === undefined) { shown.pos[p.id] = p.pos; continue; }
    if (walking[p.id] || shown.pos[p.id] === p.pos) continue;
    walk(p.id);
  }
}
function walk(id) {
  const p = S.players.find((x) => x.id === id);
  if (!p) return;
  const from = shown.pos[id], to = p.pos;
  if (from === to) { walking[id] = false; placeTokens(); return; }
  walking[id] = true;
  const fwd = (to - from + 40) % 40, back = (from - to + 40) % 40;
  if (p.inJail && to === 10) shown.pos[id] = to;           // whisked into the Maze
  else if (back <= 3) shown.pos[id] = (from + 39) % 40;    // "go back 3 spaces"
  else shown.pos[id] = (from + 1) % 40;
  sfx([shown.pos[id] === 0 ? 1046 : 520 + (shown.pos[id] % 5) * 40], 0.05);
  placeTokens();
  setTimeout(() => walk(id), fwd > 14 ? 110 : 200);
}

function renderDice() {
  const box = $('#dice');
  box.innerHTML = dieHTML(S.dice[0]) + dieHTML(S.dice[1], 'pink');
  if (shown.diceSeq !== S.diceSeq) {
    shown.diceSeq = S.diceSeq;
    box.classList.remove('rolling'); void box.offsetWidth; box.classList.add('rolling');
    sfx([300, 380, 300, 420], 0.05);
  }
}

let popupTimer;
function popup(html, ms = 6000) {
  const el = $('#popup');
  el.innerHTML = `<div>${html}</div>`;
  el.classList.remove('hidden');
  clearTimeout(popupTimer);
  popupTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
$('#popup').onclick = () => $('#popup').classList.add('hidden');

function stepText(cur) {
  const name = `${esc(cur.name)}`;
  switch (S.step) {
    case 'roll': return cur.inJail ? `${name} is stuck in ${esc(TH.jail)} ${TH.jailIco} — pay ${eur(50)}, use a card, or try for doubles!` : `Roll the dice on your phone! 🎲`;
    case 'buy': { const sp = SPACES[S.pendingBuy]; return `Buy <b>${esc(sp.name)}</b> for ${eur(sp.price)}? 🤔`; }
    case 'auction': return 'Auction! Everyone bids on their phone 🔨';
    case 'debt': { const d = S.debts[0]; const p = d && S.players.find((x) => x.id === d.from); if (!p) return ''; return `${p.emoji} ${esc(p.name)} needs ${eur(d.amount)} — sell houses or mortgage places! 😟`; }
    case 'endturn': return S.canRollAgain ? 'Roll again!' : `Tap <b>End turn</b> when you're done 👍`;
    default: return '';
  }
}

function renderAuction() {
  const a = S.auction, box = $('#auctionBox');
  if (!a) { box.classList.add('hidden'); $('#turnBox').classList.remove('hidden'); return; }
  $('#turnBox').classList.add('hidden');
  box.classList.remove('hidden');
  const top = S.players.find((p) => p.id === a.bidder);
  box.innerHTML = `<h2>🔨 Auction: ${SPACES[a.pos].emoji} ${esc(SPACES[a.pos].name)}</h2>
    <div class="muted" style="font-size:1.8cqmin">Worth ${eur(SPACES[a.pos].price)}</div>
    <div class="bid">${a.bid ? eur(a.bid) : 'No bids yet'}</div>
    <div style="font-size:2.2cqmin">${top ? `Top bid: ${top.emoji} <b>${esc(top.name)}</b>` : 'Who wants it?'}</div>
    <div class="row wrap" style="justify-content:center;margin-top:1cqmin">${a.inIds.map((id) => {
      const p = S.players.find((x) => x.id === id); return `<span class="chip">${p.emoji} ${esc(p.name)}</span>`; }).join('')}</div>`;
}

function renderPlayers() {
  $('#players').classList.toggle('many', S.players.length > 5);
  $('#players').innerHTML = S.players.map((p, i) => {
    const props = Object.keys(S.owners).filter((k) => S.owners[k] === p.id).map(Number).sort((a, b) => a - b);
    const debt = S.debts.find((d) => d.from === p.id);
    return `<div class="pl ${i === S.turn && S.phase === 'playing' ? 'cur' : ''} ${p.bankrupt ? 'out' : ''}">
      <div class="e" style="border-color:${p.color}">${p.emoji}</div>
      <div class="grow" style="min-width:0"><div class="n">${esc(p.name)} ${p.inJail ? '🔒' : ''} ${TH.escapeIco.repeat(p.jailCards.length)} ${p.connected ? '' : '📵'}</div>
        <div class="sw">${props.map((pos) => `<span title="${esc(SPACES[pos].name)}" style="background:${spaceColor(pos)};${S.mortgaged[pos] ? 'opacity:.35' : ''}"></span>`).join('')}</div></div>
      <div class="cash money">${p.bankrupt ? 'out' : eur(p.cash)}${debt ? `<div style="color:var(--red);font-size:.85rem">owes ${eur(debt.amount)}</div>` : ''}</div></div>`;
  }).join('');
}

function renderTiles() {
  SPACES.forEach((sp, i) => {
    const t = $('#t' + i);
    const ownerId = S.owners[i];
    let o = t.querySelector('.owner');
    if (ownerId) {
      const p = S.players.find((x) => x.id === ownerId);
      if (!o) { o = document.createElement('div'); o.className = 'owner'; t.appendChild(o); }
      o.textContent = p.emoji; o.style.borderColor = p.color;
    } else if (o) o.remove();
    t.classList.toggle('mort', !!S.mortgaged[i]);
    const band = t.querySelector('.band');
    if (band) { const h = S.houses[i] || 0; band.textContent = h === 5 ? '🏨' : '🏠'.repeat(h); }
    const cur = S.phase === 'playing' && S.players[S.turn];
    t.classList.toggle('hl', !!cur && (S.pendingBuy === i || (S.auction && S.auction.pos === i)));
  });
}

function renderOver() {
  if (S.phase === 'over' && !shown.over) {
    shown.over = true;
    confetti(120); sfx([523, 659, 784, 1046, 1318], 0.15);
  }
  if (S.phase === 'over') {
    const medals = ['👑', '🥈', '🥉', '🌸', '🌸', '🌸', '🌸', '🌸'];
    $('#ranking').innerHTML = S.ranking.map((r, i) => {
      const p = S.players.find((x) => x.id === r.id);
      return `<div class="rank"><span>${medals[i]}</span><span style="font-size:2rem">${p.emoji}</span><span class="grow" style="text-align:left">${esc(p.name)}</span><span class="money">${p.bankrupt ? 'out' : eur(r.worth)}</span></div>`;
    }).join('');
    $('#over').classList.remove('hidden');
  }
}

function render(state) {
  if (!state || state.code !== code) return;
  const prev = S;
  S = state;
  applyTheme();
  if (S.phase === 'lobby') {
    // Fresh start (also after "Home screen"): forget the old game's animations.
    for (const k of Object.keys(shown.pos)) delete shown.pos[k];
    shown.owners = {}; shown.over = false; shown.cardSeq = S.card ? S.card.seq : 0;
    $('#over').classList.add('hidden');
    $('#tokens').innerHTML = '';
    return renderLobby();
  }
  $('#lobby').classList.add('hidden');
  $('#game').classList.remove('hidden');
  renderOver(); // first, so the results always appear even if something below fails
  $('#qrSmall').src = qrSrc();
  $('#codeSmall').textContent = code;

  for (const part of [renderTiles, renderDice, renderPlayers, renderAuction, animateTokens, placeTokens]) {
    try { part(); } catch (e) { console.error(e); }
  }

  const cur = S.players[S.turn];
  $('#who').innerHTML = `${cur.emoji} ${esc(cur.name)}'s turn`;
  $('#who').style.color = cur.color;
  $('#what').innerHTML = stepText(cur);
  $('#last').textContent = S.log[S.log.length - 1] || '';
  $('#log').innerHTML = S.log.slice().reverse().map((l) => `<div>${esc(l)}</div>`).join('');
  $('#bank').textContent = `Bank: 🏠 ${S.housesLeft} houses · 🏨 ${S.hotelsLeft} hotels`;
  $('#potBox').classList.toggle('hidden', !S.settings.jackpot);
  $('#potBox').textContent = `${TH.parkingIco} ${TH.parkingName} jackpot: ${eur(S.pot)}`;
  $('#endAuctionBtn').classList.toggle('hidden', !S.auction);

  // New card drawn
  if (S.card && S.card.seq !== shown.cardSeq) {
    shown.cardSeq = S.card.seq;
    setTimeout(() => popup(cardHTML(S.card)), 900);
    sfx([784, 988, 1175], 0.1);
  }
  // Something got bought
  for (const [pos, id] of Object.entries(S.owners)) {
    if (shown.owners[pos] !== id && !shown.owners[pos]) { confetti(25); sfx([660, 880, 1100], 0.08); popup(deedHTML(Number(pos), S), 3500); }
  }
  shown.owners = { ...S.owners };
  if (prev && prev.turn !== S.turn) sfx([523, 784], 0.12);

}

window.addEventListener('resize', () => S && S.phase !== 'lobby' && placeTokens());
$('#fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$('#soundBtn').onclick = (e) => { soundOn = !soundOn; e.target.textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off'; };
$('#endAuctionBtn').onclick = () => askConfirm('Close the auction now? The top bidder wins (or the bank keeps it if nobody bid).', 'Close auction', () => adminDo('endAuction'));
$('#endGameBtn').onclick = () => askConfirm('Finish the game now? The richest player (money + places + houses) wins!', '🏁 Finish game', () => adminDo('endGame'));
