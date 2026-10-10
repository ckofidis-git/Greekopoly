// Helpers shared by the big screen and the phone controller.
const { TOKENS } = window.BOARD;
let SPACES, GROUPS, TH, themeId = null, LANG = null, tr = null;
// Languages: the game's own setting wins; before joining, use the hub choice or the device language.
function guessLang() {
  try { const l = localStorage.getItem('hub_lang'); if (l === 'el' || l === 'en') return l; } catch (e) {}
  return (navigator.language || '').toLowerCase().startsWith('el') ? 'el' : 'en';
}
// Switch names, flags, wording, currency and language. Returns true when anything changed.
function useTheme(id, lang = LANG || guessLang()) {
  if (id === themeId && lang === LANG) return false;
  const t = window.BOARD.themed(id, lang);
  SPACES = t.SPACES; GROUPS = t.GROUPS; TH = t.T; themeId = TH.id; LANG = lang;
  tr = window.I18N.makeT(lang);
  document.documentElement.lang = lang === 'el' ? 'el' : 'en-GB';
  return true;
}
// t('key', params): translated text. Unknown keys (e.g. a message the server already translated) come back unchanged.
function t(key, p = {}) { return tr(key, { T: TH, ...p }); }
// Fill every element marked data-i="key" (text) or data-ih="key" (HTML) or data-ip="key" (placeholder).
function applyStatic() {
  document.querySelectorAll('[data-i]').forEach((el) => { el.textContent = t(el.dataset.i); });
  document.querySelectorAll('[data-ih]').forEach((el) => { el.innerHTML = t(el.dataset.ih); });
  document.querySelectorAll('[data-ip]').forEach((el) => { el.placeholder = t(el.dataset.ip); });
}
useTheme('greece');
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => window.BOARD.money(TH, n);

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
    const labels = ['deed.rent', 'deed.h1', 'deed.h2', 'deed.h3', 'deed.h4', 'deed.hotel'].map((k) => t(k));
    rows = sp.rent.map((r, i) => `<tr><td>${labels[i]}</td><td>${eur(r)}</td></tr>`).join('') +
      `<tr><td class="muted">${t('deed.houseCost')}</td><td>${eur(sp.house)}</td></tr>`;
  } else if (sp.type === 'rail') {
    rows = [25, 50, 100, 200].map((r, i) => `<tr><td>${t('deed.rail', { n: i + 1 })}</td><td>${eur(r)}</td></tr>`).join('');
  } else {
    rows = `<tr><td>${t('deed.util1')}</td><td></td></tr><tr><td>${t('deed.util2')}</td><td></td></tr>`;
  }
  let owner = '';
  if (state && state.owners[pos]) {
    const o = state.players.find((p) => p.id === state.owners[pos]);
    if (o) owner = `<div class="chip" style="margin-top:8px">${t('deed.owner', { who: `${o.emoji} ${esc(o.name)}` })}${state.mortgaged[pos] ? t('deed.mortgaged') : ''}</div>`;
  }
  return `<div class="deed"><div class="band" style="background:${color}">${esc(sp.name)}<small>${sub}</small></div>
    <div class="body"><div class="emoji">${sp.emoji}</div><div style="font-size:1.2rem;font-weight:700">${t('deed.price', { m: eur(sp.price) })}</div>
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
function askConfirm(text, yesLabel, onYes, noLabel = LANG === 'el' ? 'Άκυρο' : 'Cancel') {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.style.zIndex = 300;
  el.innerHTML = `<div class="panel center" style="max-width:440px;display:flex;flex-direction:column;gap:14px">
    <div style="font-size:1.25rem;font-weight:600">${esc(text)}</div>
    <div class="row" style="justify-content:center"><button class="btn-soft big" data-no>${esc(noLabel)}</button><button class="btn-pink big" data-yes>${esc(yesLabel)}</button></div></div>`;
  el.onclick = (e) => {
    if (e.target === el || e.target.closest('[data-no]')) el.remove();
    else if (e.target.closest('[data-yes]')) { el.remove(); onYes(); }
  };
  document.body.appendChild(el);
}
