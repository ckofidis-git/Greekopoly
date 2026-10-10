// Phone controller for one player.
const socket = io('/monopoly');
let code = (new URLSearchParams(location.search).get('g') || '').toUpperCase();
let me = null;        // my player id
let S = null;
let tab = 'Play';
let pickedToken = null;
let seenCard = null;
let wasMyTurn = false;
let draft = freshDraft();

function freshDraft() { return { to: null, giveProps: [], getProps: [], giveCash: 0, getCash: 0, giveCards: 0, getCards: 0 }; }
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const meP = () => S && S.players.find((p) => p.id === me);
const P = (id) => S.players.find((p) => p.id === id);
const myProps = (id = me) => Object.keys(S.owners).filter((k) => S.owners[k] === id).map(Number).sort((a, b) => a - b);
const groupOf = (g) => SPACES.map((s, i) => (s.group === g ? i : -1)).filter((i) => i >= 0);

function act(type, extra = {}) {
  socket.emit('act', { type, ...extra }, (r) => {
    if (r && r.error) { toast(t(r.error)); beep([300, 220], 0.12); }
  });
}

// ---------- joining ----------
function tryJoin(extra = {}) {
  if (!code) { showJoin(); return; }
  const playerId = store.get('gk_p_' + code);
  socket.emit('player:join', { code, playerId, ...extra }, (r) => {
    if (r.error && !r.state) { toast(t(r.error)); code = ''; showJoin(); return; }
    if (r.error) { toast(t(r.error)); S = r.state; showJoin(); return; }
    if (r.needJoin) { S = r.state; showJoin(); return; }
    me = r.playerId;
    store.set('gk_p_' + code, me);
    history.replaceState(null, '', '/monopoly/play?g=' + code);
    render(r.state);
  });
}
socket.on('connect', () => tryJoin());
socket.on('state', (s) => { if (me && s.code === code) render(s); });

function show(id) {
  for (const s of ['joinScreen', 'waitScreen', 'gameScreen']) $('#' + s).classList.toggle('hidden', s !== id);
}

let shownLang = null;
function themeUI() {
  if (S) useTheme(S.settings.theme, S.settings.lang);
  if (shownLang !== TH.id + LANG) { shownLang = TH.id + LANG; applyStatic(); }
  document.title = `${TH.title} — ${t('ui.player')}`;
  document.querySelectorAll('h1.logo').forEach((h) => { h.textContent = TH.title; });
  $('#joinTag').textContent = TH.tagline;
}

function showJoin() {
  themeUI();
  show('joinScreen');
  $('#codeBox').classList.toggle('hidden', !!code && !!S);
  if (code) $('#codeIn').value = code;
  const taken = S ? S.players.map((p) => p.token) : [];
  if (taken.includes(pickedToken)) pickedToken = null;
  $('#tokenPick').innerHTML = TOKENS.map((tk) => `<button data-t="${tk.id}" class="${pickedToken === tk.id ? 'sel' : ''}" ${taken.includes(tk.id) ? 'disabled' : ''}>${tk.emoji}<small>${LANG === 'el' ? tk.nameEl : tk.name}</small></button>`).join('');
  if (S && S.phase !== 'lobby') toast(t('ph.alreadyStarted'));
}
$('#tokenPick').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  pickedToken = b.dataset.t;
  beep([880], 0.06);
  for (const x of $('#tokenPick').children) x.classList.toggle('sel', x === b);
};
$('#joinBtn').onclick = () => {
  const c = $('#codeIn').value.trim().toUpperCase();
  if (c) code = c;
  const name = $('#nameIn').value.trim();
  if (!code) return toast(t('ph.typeCode'));
  if (!name) return toast(t('ph.typeName'));
  if (!pickedToken) return toast(t('ph.pickChar'));
  tryJoin({ name, token: pickedToken });
};
$('#codeIn').addEventListener('input', () => {
  const c = $('#codeIn').value.trim().toUpperCase();
  if (c.length === 4) socket.emit('peek', { code: c }, (r) => { if (r.state) { code = c; S = r.state; showJoin(); } else toast(t(r.error)); });
});

// ---------- main render ----------
function render(state) {
  const prevPhase = S && S.phase;
  S = state;
  themeUI();
  if (S.phase === 'lobby' && prevPhase && prevPhase !== 'lobby') { draft = freshDraft(); setTab('Play'); $('#modal').classList.add('hidden'); }
  const m = meP();
  if (!m) { store.set('gk_p_' + code, ''); me = null; S = state; showJoin(); return; }
  if (S.phase === 'lobby') {
    show('waitScreen');
    $('#waitMe').textContent = m.emoji;
    $('#waitList').innerHTML = S.players.map((p) => `<div style="font-size:1.3rem;padding:6px">${p.emoji} ${esc(p.name)} ${p.id === me ? `<span class="chip">${t('ph.you')}</span>` : ''}</div>`).join('');
    return;
  }
  show('gameScreen');
  $('#hMe').textContent = m.emoji;
  $('#hMe').style.borderColor = m.color;
  $('#hName').textContent = m.name;
  $('#hSub').textContent = m.bankrupt ? t('ph.outOfGame') : t('ph.sub', { n: myProps().length, place: SPACES[m.pos].name }) + (m.inJail ? ' 🔒' : '');
  $('#hCash').textContent = eur(m.cash);
  $('#tradeDot').classList.toggle('hidden', !S.trades.some((t) => t.to === me));

  const myTurn = S.phase === 'playing' && S.players[S.turn].id === me;
  if (myTurn && !wasMyTurn) { navigator.vibrate && navigator.vibrate([120, 60, 120]); beep([660, 880, 1100], 0.09); if (tab !== 'Play') setTab('Play'); }
  wasMyTurn = myTurn;

  renderPlay();
  renderMine();
  renderTrade();

  if (S.card && S.card.seq !== seenCard) {
    const first = seenCard === null;
    seenCard = S.card.seq;
    if (!first && S.card.playerId === me) {
      modal(`${cardHTML(S.card)}<button class="btn-pink huge" style="margin-top:14px" data-close>${t('ph.ok')}</button>`);
    }
  }
}

function modal(html) {
  const el = $('#modal');
  el.innerHTML = `<div style="width:100%;max-width:420px">${html}</div>`;
  el.classList.remove('hidden');
}
$('#modal').onclick = (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) $('#modal').classList.add('hidden'); };

function setTab(t) {
  tab = t;
  for (const b of document.querySelectorAll('nav button')) b.classList.toggle('on', b.dataset.tab === t);
  for (const n of ['Play', 'Mine', 'Trade']) $('#tab' + n).classList.toggle('hidden', n !== t);
  window.scrollTo(0, 0);
}
document.querySelector('nav').onclick = (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); };

// ---------- Play tab ----------
function offerHTML(tr0) {
  const from = P(tr0.from), to = P(tr0.to);
  const list = (props, cash, cards) => {
    const items = props.map((pos) => `<li>${SPACES[pos].emoji} ${esc(SPACES[pos].name)}${S.mortgaged[pos] ? ' 💤' : ''}</li>`);
    if (cash) items.push(`<li class="money">${eur(cash)}</li>`);
    if (cards) items.push(`<li>${t('ph.escapeCount', { n: cards })}</li>`);
    return items.length ? `<ul>${items.join('')}</ul>` : `<div class="muted">${t('ph.nothing')}</div>`;
  };
  const mine = tr0.to === me;
  return `<div class="panel offer"><div style="font-weight:700;font-size:1.15rem">🤝 ${mine ? t('ph.wantsTrade', { who: `${from.emoji} ${esc(from.name)}` }) : t('ph.yourOffer', { who: `${to.emoji} ${esc(to.name)}` })}</div>
    <div class="row" style="align-items:flex-start;margin-top:6px">
      <div class="grow"><b>${t(mine ? 'ph.youGet' : 'ph.youGive')}</b>${list(tr0.giveProps, tr0.giveCash, tr0.giveCards)}</div>
      <div class="grow"><b>${t(mine ? 'ph.youGive' : 'ph.youGet')}</b>${list(tr0.getProps, tr0.getCash, tr0.getCards)}</div>
    </div>
    ${mine ? `<div class="row"><button class="btn-green big grow" data-reply="${tr0.id}" data-yes="1">${t('ph.yes')}</button><button class="btn-red big grow" data-reply="${tr0.id}">${t('ph.noThanks')}</button></div>`
           : `<button class="btn-soft" data-reply="${tr0.id}">${t('ph.cancelOffer')}</button><span class="muted">${t('ph.waitingAnswer')}</span>`}
  </div>`;
}

function renderPlay() {
  const m = meP(), el = $('#tabPlay');
  if (S.phase === 'over') {
    const medals = ['👑', '🥈', '🥉', '🌸', '🌸', '🌸', '🌸', '🌸'];
    el.innerHTML = `<div class="panel center"><div style="font-size:3.5rem">🎉</div><h2 class="logo" style="font-size:2.2rem;margin:0">${t('ui.gameOver')}</h2>
      ${S.ranking.map((r, i) => { const p = P(r.id); return `<div style="font-size:1.3rem;margin:8px 0">${medals[i]} ${p.emoji} ${esc(p.name)} <span class="money">${p.bankrupt ? '' : eur(r.worth)}</span></div>`; }).join('')}
      <div class="muted">${t('ph.thanks')}</div></div>`;
    return;
  }
  if (m.bankrupt) {
    el.innerHTML = `<div class="panel center"><div style="font-size:3.5rem">🌅</div><h2>${t('ph.broke')}</h2><p class="muted">${t('ph.brokeSub')}</p></div>`;
    return;
  }
  const cur = S.players[S.turn];
  const myTurn = cur.id === me;
  const parts = [];
  parts.push(`<div class="turn-banner ${myTurn ? 'mine' : 'other'}">${myTurn ? t('ph.yourTurn') : t('ui.turnOf', { who: `${cur.emoji} ${esc(cur.name)}` })}</div>`);

  for (const tr0 of S.trades.filter((x) => x.to === me)) parts.push(offerHTML(tr0));

  const debtIdx = S.debts.findIndex((d) => d.from === me);
  const a = S.auction;
  if (debtIdx === 0) {
    const d = S.debts[0];
    const to = d.to ? P(d.to) : null;
    const need = d.amount - m.cash;
    parts.push(`<div class="panel stack center"><div style="font-size:3rem">😟</div>
      <div style="font-size:1.3rem;font-weight:600">${t('ph.needPay', { m: eur(d.amount) })}</div>
      <div class="muted">${t('ph.forReason', { reason: esc(d.reason), to: to ? `${to.emoji} ${esc(to.name)}` : t('ph.theBank') })}</div>
      ${need > 0 ? `<div>${t('ph.needMore', { m: eur(need) })}</div>
        <button class="btn-blue big" data-go="Mine">${t('ph.goMine')}</button>` : ''}
      <button class="btn-green huge" data-act="payDebt" ${need > 0 ? 'disabled' : ''}>${t('ph.payBtn', { m: eur(d.amount) })}</button>
      <button class="btn-red" data-giveup>${t('ph.giveUp')}</button></div>`);
  } else if (debtIdx > 0) {
    parts.push(`<div class="panel center">${t('ph.paySoon', { m: eur(S.debts[debtIdx].amount) })}</div>`);
  } else if (S.debts.length) {
    const d = S.debts[0], p = P(d.from);
    parts.push(waitingHTML(p.emoji, t('ph.finding', { name: esc(p.name), m: eur(d.amount) })));
  } else if (a) {
    const top = a.bidder ? P(a.bidder) : null;
    const inIt = a.inIds.includes(me);
    const imTop = a.bidder === me;
    parts.push(`<div class="panel stack center"><div style="font-size:1.4rem;font-weight:700">${t('ph.auctionTime')}</div>
      ${deedHTML(a.pos, S)}
      <div style="font-size:1.2rem">${a.bid ? t('ph.topBidBy', { m: eur(a.bid), who: `${top.emoji} ${esc(top.name)}` }) : t('ph.noBidsYet')}</div>
      ${!inIt ? `<div class="muted">${t('ph.stopped')}</div>` : imTop ? `<div style="font-size:1.2rem;font-weight:600;color:var(--pink)">${t('ph.youTop')}</div><div class="muted">${t('ph.waitOthers')}</div>` : `
        <div class="bidbtns">${[10, 50, 100].map((inc) => `<button class="btn-pink big" data-bid="${inc}" ${m.cash < a.bid + inc ? 'disabled' : ''}>+${inc}<div style="font-size:.85rem">= ${eur(a.bid + inc)}</div></button>`).join('')}</div>
        <button class="btn-soft big" data-act="pass">${t('ph.noMore')}</button>`}</div>`);
  } else if (myTurn) {
    parts.push(myTurnHTML(m));
  } else {
    const what = { roll: t('ph.wRoll'), buy: t('ph.wBuy', { place: S.pendingBuy !== null ? esc(SPACES[S.pendingBuy].name) : '' }), endturn: t('ph.wEnd') }[S.step] || t('ph.wPlay');
    parts.push(waitingHTML(cur.emoji, `${esc(cur.name)} ${what}`));
  }

  parts.push(`<div class="panel" style="margin-top:14px"><div class="mini-dice">${dieHTML(S.dice[0])}${dieHTML(S.dice[1], 'pink')}</div>
    <div class="center" style="margin-top:10px">${esc(S.log[S.log.length - 1] || '')}</div></div>`);
  el.innerHTML = `<div class="stack">${parts.join('')}</div>`;
}

function waitingHTML(emoji, text) {
  return `<div class="panel center"><div class="wait-anim">${emoji}</div><div style="font-size:1.2rem">${text}</div>
    <div class="hint" style="margin-top:8px">${t('ph.whileWait')}</div></div>`;
}

function myTurnHTML(m) {
  if (S.step === 'roll') {
    if (m.inJail) {
      return `<div class="panel stack center"><div style="font-size:3rem">${TH.jailIco}</div>
        <div style="font-size:1.25rem;font-weight:600">${t('ph.stuck')}</div>
        <div class="muted">${t('ph.tryN', { n: m.jailTurns + 1 })}</div>
        <button class="btn-pink huge" data-act="roll">${t('ph.tryDoubles')}</button>
        <button class="btn-gold big" data-act="payJail" ${m.cash < 50 ? 'disabled' : ''}>${t('ph.payOut', { m: eur(50) })}</button>
        ${m.jailCards.length ? `<button class="btn-purple big" data-act="useCard">${t('ph.useCard')}</button>` : ''}</div>`;
    }
    return `<div class="stack"><button class="btn-pink huge" data-act="roll" style="padding:38px 20px;font-size:2.4rem">${t('ph.roll')}</button>
      ${S.canRollAgain ? `<div class="center" style="font-weight:600">${t('ph.rollAgain')}</div>` : ''}</div>`;
  }
  if (S.step === 'buy') {
    const sp = SPACES[S.pendingBuy];
    const can = m.cash >= sp.price;
    return `<div class="stack">${deedHTML(S.pendingBuy, S)}
      <button class="btn-green huge" data-act="buy" ${can ? '' : 'disabled'}>${t('ph.buyFor', { m: eur(sp.price) })}</button>
      ${can ? '' : `<div class="hint">${t('ph.cantAfford')}</div>`}
      <button class="btn-soft big" data-act="decline">${t('ph.decline')}</button></div>`;
  }
  if (S.step === 'endturn') {
    return `<div class="stack"><button class="btn-blue huge" data-act="endTurn">${t('ph.endTurn')}</button>
      <div class="hint">${t('ph.endHint')}</div></div>`;
  }
  return '';
}

$('#tabPlay').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.act) { act(b.dataset.act); if (b.dataset.act === 'roll') beep([400, 500, 600], 0.05); }
  else if (b.dataset.bid) act('bid', { inc: Number(b.dataset.bid) });
  else if (b.dataset.go) setTab(b.dataset.go);
  else if (b.dataset.reply) act('tradeReply', { id: b.dataset.reply, accept: !!b.dataset.yes });
  else if ('giveup' in b.dataset) {
    modal(`<div class="panel center stack"><div style="font-size:3rem">😢</div><div style="font-size:1.2rem">${t('ph.sure')}</div>
      <button class="btn-soft big" data-close>${t('ph.trySelling')}</button>
      <button class="btn-red big" id="confirmGiveUp">${t('ph.yesGiveUp')}</button></div>`);
    $('#confirmGiveUp').onclick = () => { $('#modal').classList.add('hidden'); act('bankrupt'); };
  }
};

// ---------- My places tab ----------
function renderMine() {
  const m = meP(), el = $('#tabMine');
  const mine = myProps();
  if (!mine.length) {
    el.innerHTML = `<div class="panel center"><div style="font-size:3rem">🏝️</div><h3>${t('ph.noPlaces')}</h3>
      <p class="muted">${t('ph.noPlacesSub')}</p>
      ${m.jailCards.length ? `<p>${t('ph.youHave', { n: m.jailCards.length })}</p>` : ''}</div>`;
    return;
  }
  const order = [...Object.keys(GROUPS), 'rail', 'util'];
  const groups = {};
  for (const pos of mine) { const k = SPACES[pos].group || SPACES[pos].type; (groups[k] = groups[k] || []).push(pos); }
  let html = `<div class="hint" style="margin-bottom:10px">${t('ph.mineHint')}</div>`;
  if (m.jailCards.length) html += `<div class="panel" style="margin-bottom:12px">${t('ph.youHave', { n: m.jailCards.length })}</div>`;
  for (const k of order) {
    if (!groups[k]) continue;
    const isGroup = !!GROUPS[k];
    const total = isGroup ? groupOf(k).length : k === 'rail' ? 4 : 2;
    const full = isGroup && groupOf(k).every((i) => S.owners[i] === me);
    const title = isGroup ? GROUPS[k].name : k === 'rail' ? TH.rails : TH.utils;
    const color = isGroup ? GROUPS[k].color : spaceColor(groups[k][0]);
    html += `<div class="grp"><div class="grp-h"><i style="background:${color}"></i>${title} <span class="muted">(${groups[k].length}/${total})</span>${full ? ` <span class="chip">${t('ph.fullSet')}</span>` : ''}</div>`;
    for (const pos of groups[k]) html += propHTML(pos, m, full);
    html += `</div>`;
  }
  el.innerHTML = html;
}

function propHTML(pos, m, fullSet) {
  const sp = SPACES[pos];
  const h = S.houses[pos] || 0;
  const mort = !!S.mortgaged[pos];
  const btns = [];
  if (sp.type === 'street') {
    const grp = groupOf(sp.group);
    const hs = grp.map((i) => S.houses[i] || 0);
    const canBuild = fullSet && !grp.some((i) => S.mortgaged[i]) && h < 5 && h === Math.min(...hs) && m.cash >= sp.house;
    const canSell = h > 0 && h === Math.max(...hs);
    if (fullSet) btns.push(`<button class="btn-green" data-a="build" data-p="${pos}" ${canBuild ? '' : 'disabled'}>${t(h === 4 ? 'ph.addHotel' : 'ph.addHouse')} ${eur(sp.house)}</button>`);
    if (h > 0) btns.push(`<button class="btn-soft" data-a="sell" data-p="${pos}" ${canSell ? '' : 'disabled'}>${t('ph.sell')} ${h === 5 ? '🏨' : '🏠'} +${eur(sp.house / 2)}</button>`);
  }
  const groupBuilt = sp.type === 'street' && groupOf(sp.group).some((i) => (S.houses[i] || 0) > 0);
  if (mort) btns.push(`<button class="btn-gold" data-a="unmortgage" data-p="${pos}" ${m.cash < Math.ceil(sp.price / 2 * 1.1) ? 'disabled' : ''}>${t('ph.unmortgage', { m: eur(Math.ceil(sp.price / 2 * 1.1)) })}</button>`);
  else if (!groupBuilt) btns.push(`<button class="btn-soft" data-a="mortgage" data-p="${pos}">${t('ph.mortgage', { m: eur(sp.price / 2) })}</button>`);
  btns.push(`<button class="btn-soft" data-deed="${pos}">ℹ️</button>`);
  const rentNow = sp.type === 'street' ? (h ? sp.rent[h] : sp.rent[0] * (fullSet ? 2 : 1)) : null;
  return `<div class="prop ${mort ? 'mort' : ''}" style="border-color:${spaceColor(pos)}">
    <div class="top"><span>${sp.emoji}</span><span class="grow">${esc(sp.name)}</span><span>${h === 5 ? '🏨' : '🏠'.repeat(h)}</span></div>
    <div class="muted" style="font-size:.9rem">${mort ? t('ph.mortNoRent') : rentNow !== null ? t('ph.rentNow', { m: eur(rentNow) }) : ''}</div>
    <div class="acts">${btns.join('')}</div></div>`;
}

$('#tabMine').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.deed) return modal(`${deedHTML(Number(b.dataset.deed), S)}<button class="btn-pink huge" style="margin-top:12px" data-close>${t('ph.close')}</button>`);
  if (b.dataset.a) { act(b.dataset.a, { pos: Number(b.dataset.p) }); if (b.dataset.a === 'build') beep([700, 900], 0.07); }
};

// ---------- Trade tab ----------
function tradeable(pos) {
  const sp = SPACES[pos];
  return sp.type !== 'street' || !groupOf(sp.group).some((i) => (S.houses[i] || 0) > 0);
}
function chips(list, key) {
  if (!list.length) return `<span class="muted">${t('ph.noTrade')}</span>`;
  return list.map((pos) => `<button data-chip="${key}" data-p="${pos}" class="${draft[key].includes(pos) ? 'sel' : ''}" ${tradeable(pos) ? '' : 'disabled'} style="border-left:8px solid ${spaceColor(pos)}">${SPACES[pos].emoji} ${esc(SPACES[pos].name)}${S.mortgaged[pos] ? ' 💤' : ''}</button>`).join('');
}
function stepper(key, max) {
  return `<div class="stepper"><button class="btn-soft" data-step="${key}" data-d="-50">−50</button><button class="btn-soft" data-step="${key}" data-d="-10">−10</button>
    <b class="money">${eur(draft[key])}</b><button class="btn-soft" data-step="${key}" data-d="10">+10</button><button class="btn-soft" data-step="${key}" data-d="50">+50</button></div>`;
}

function renderTrade() {
  const m = meP(), el = $('#tabTrade');
  if (S.phase !== 'playing' || m.bankrupt) { el.innerHTML = `<div class="panel center muted">${t('ph.tradeClosed')}</div>`; return; }
  const others = S.players.filter((p) => p.id !== me && !p.bankrupt);
  if (draft.to && !others.some((p) => p.id === draft.to)) draft = freshDraft();
  const them = draft.to ? P(draft.to) : null;
  // drop selections that are no longer valid
  draft.giveProps = draft.giveProps.filter((pos) => S.owners[pos] === me);
  draft.getProps = them ? draft.getProps.filter((pos) => S.owners[pos] === them.id) : [];
  draft.giveCash = Math.min(draft.giveCash, m.cash);
  if (them) draft.getCash = Math.min(draft.getCash, them.cash);
  draft.giveCards = Math.min(draft.giveCards, m.jailCards.length);
  if (them) draft.getCards = Math.min(draft.getCards, them.jailCards.length);

  let html = '';
  for (const tr0 of S.trades.filter((x) => x.to === me || x.from === me)) html += offerHTML(tr0);
  html += `<div class="panel stack" style="margin-top:12px"><div style="font-weight:700;font-size:1.2rem">${t('ph.newOffer')}</div>
    <div><div class="label" style="margin-top:0">${t('ph.tradeWith')}</div><div class="pick-players">${others.map((p) => `<button data-to="${p.id}" class="${draft.to === p.id ? 'sel' : ''}">${p.emoji} ${esc(p.name)}</button>`).join('')}</div></div>`;
  if (them) {
    html += `<div><div class="label">${t('ph.iGive')}</div><div class="tchips">${chips(myProps(), 'giveProps')}</div>
        <div style="margin-top:8px">${stepper('giveCash')}</div>
        ${m.jailCards.length ? `<label style="display:block;margin-top:6px"><input type="checkbox" data-card="giveCards" ${draft.giveCards ? 'checked' : ''}> ${t('ph.myCard')}</label>` : ''}</div>
      <div><div class="label">${t('ph.iGet', { who: `${them.emoji} ${esc(them.name)}` })}</div><div class="tchips">${chips(myProps(them.id), 'getProps')}</div>
        <div style="margin-top:8px">${stepper('getCash')}</div>
        ${them.jailCards.length ? `<label style="display:block;margin-top:6px"><input type="checkbox" data-card="getCards" ${draft.getCards ? 'checked' : ''}> ${t('ph.theirCard')}</label>` : ''}</div>
      <div class="hint">${t('ph.tradeHint')}</div>
      <button class="btn-pink huge" data-send>${t('ph.send')}</button>`;
  }
  html += `</div>`;
  el.innerHTML = html;
}

$('#tabTrade').onclick = (e) => {
  const cb = e.target.closest('input[data-card]');
  if (cb) { draft[cb.dataset.card] = cb.checked ? 1 : 0; return; }
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const m = meP();
  if (b.dataset.reply) return act('tradeReply', { id: b.dataset.reply, accept: !!b.dataset.yes });
  if (b.dataset.to) { draft = freshDraft(); draft.to = b.dataset.to; }
  else if (b.dataset.chip) {
    const k = b.dataset.chip, pos = Number(b.dataset.p);
    draft[k] = draft[k].includes(pos) ? draft[k].filter((x) => x !== pos) : [...draft[k], pos];
  } else if (b.dataset.step) {
    const k = b.dataset.step, max = k === 'giveCash' ? m.cash : P(draft.to).cash;
    draft[k] = Math.max(0, Math.min(max, draft[k] + Number(b.dataset.d)));
  } else if ('send' in b.dataset) {
    socket.emit('act', { type: 'trade', offer: draft }, (r) => {
      if (r.error) return toast(t(r.error));
      toast(t('ph.sent'));
      draft = freshDraft();
      renderTrade();
    });
    return;
  }
  renderTrade();
};
