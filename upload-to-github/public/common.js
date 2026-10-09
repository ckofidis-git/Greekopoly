// Helpers shared by the big screen and the phone controller.
const { TOKENS } = window.BOARD;
let SPACES, GROUPS, TH, themeId = null;
// Switch names, flags, wording and currency to a theme. Returns true when it changed.
function useTheme(id) {
  if (id === themeId) return false;
  const t = window.BOARD.themed(id);
  SPACES = t.SPACES; GROUPS = t.GROUPS; TH = t.T; themeId = TH.id;
  return true;
}
useTheme('greece');
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => TH.cur + Number(n).toLocaleString('en');

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function dieHTML(n, cls = '') {
  return `<div class="die ${cls}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i) ? 'on' : ''}"></i>`).join('')}</div>`;
}

function spaceColor(pos) {
  const sp = SPACES[pos];
  if (sp.type === 'street') return GROUPS[sp.group].color;
  if (sp.type === 'rail') return '#38bdf8';
  if (sp.type === 'util') return '#a78bfa';
  return '#94a3b8';
}

function deedHTML(pos, state) {
  const sp = SPACES[pos];
  const color = spaceColor(pos);
  const sub = sp.type === 'street' ? GROUPS[sp.group].name : sp.type === 'rail' ? TH.rail : TH.util;
  let rows = '';
  if (sp.type === 'street') {
    const labels = ['Rent', 'With 1 house', 'With 2 houses', 'With 3 houses', 'With 4 houses', 'With a hotel'];
    rows = sp.rent.map((r, i) => `<tr><td>${labels[i]}</td><td>${eur(r)}</td></tr>`).join('') +
      `<tr><td class="muted">Each house costs</td><td>${eur(sp.house)}</td></tr>`;
  } else if (sp.type === 'rail') {
    rows = [25, 50, 100, 200].map((r, i) => `<tr><td>Own ${i + 1} ${i ? TH.rails : TH.rail}</td><td>${eur(r)}</td></tr>`).join('');
  } else {
    rows = `<tr><td>Own 1: dice × 4</td><td></td></tr><tr><td>Own both: dice × 10</td><td></td></tr>`;
  }
  let owner = '';
  if (state && state.owners[pos]) {
    const o = state.players.find((p) => p.id === state.owners[pos]);
    if (o) owner = `<div class="chip" style="margin-top:8px">Owner: ${o.emoji} ${esc(o.name)}${state.mortgaged[pos] ? ' · 💤 mortgaged' : ''}</div>`;
  }
  return `<div class="deed"><div class="band" style="background:${color}">${esc(sp.name)}<small>${sub}</small></div>
    <div class="body"><div class="emoji">${sp.emoji}</div><div style="font-size:1.2rem;font-weight:700">Price ${eur(sp.price)}</div>
    <table>${rows}</table>${owner}</div></div>`;
}

function cardHTML(card) {
  const chance = card.deck === 'chance';
  return `<div class="fcard ${card.deck}"><div class="ico">${chance ? TH.chanceIco : TH.chestIco}</div>
    <h3>${chance ? TH.chanceName : TH.chestName}</h3><p>${esc(card.text)}</p></div>`;
}

function confetti(n = 60) {
  const bits = ['🌸', '💖', '⭐', '✨', '🦋', '💎', '🎀', '🌺'];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.textContent = bits[i % bits.length];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = 2.5 + Math.random() * 2.5 + 's';
    el.style.animationDelay = Math.random() * 1.2 + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6500);
  }
}

let toastTimer;
function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

// Tiny sound effects with WebAudio, no files needed.
let actx;
function beep(notes = [660, 880], dur = 0.09) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const t = actx.currentTime + i * dur;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.8);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur * 2);
    });
  } catch (e) { /* sound is optional */ }
}

// In-page yes/no question (browser confirm() pop-ups can be blocked on TVs and kiosks).
function askConfirm(text, yesLabel, onYes) {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.style.zIndex = 300;
  el.innerHTML = `<div class="panel center" style="max-width:440px;display:flex;flex-direction:column;gap:14px">
    <div style="font-size:1.25rem;font-weight:600">${esc(text)}</div>
    <div class="row" style="justify-content:center"><button class="btn-soft big" data-no>Cancel</button><button class="btn-pink big" data-yes>${esc(yesLabel)}</button></div></div>`;
  el.onclick = (e) => {
    if (e.target === el || e.target.closest('[data-no]')) el.remove();
    else if (e.target.closest('[data-yes]')) { el.remove(); onYes(); }
  };
  document.body.appendChild(el);
}
