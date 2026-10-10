// Helpers shared by the big screen and the phones.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let LANG = 'en', tr = null;
function guessLang() {
  try { const l = localStorage.getItem('hub_lang'); if (l === 'el' || l === 'en') return l; } catch (e) {}
  return (navigator.language || '').toLowerCase().startsWith('el') ? 'el' : 'en';
}
// Switch language; returns true when it changed. Fills every data-i / data-ih / data-ip element.
function useLang(lang) {
  lang = lang === 'el' ? 'el' : 'en';
  const changed = lang !== LANG || !tr;
  LANG = lang; tr = window.QI18N.makeT(lang);
  document.documentElement.lang = lang === 'el' ? 'el' : 'en-GB';
  document.querySelectorAll('[data-i]').forEach((el) => { el.textContent = t(el.dataset.i); });
  document.querySelectorAll('[data-ih]').forEach((el) => { el.innerHTML = t(el.dataset.ih); });
  document.querySelectorAll('[data-ip]').forEach((el) => { el.placeholder = t(el.dataset.ip); });
  return changed;
}
const t = (key, p) => tr(key, p);
const num = (n) => Number(n).toLocaleString(LANG === 'el' ? 'el-GR' : 'en-GB');
const FRUITS = ['🍓', '🫐', '🍋', '🥝'];
const AVATARS = ['🦄', '🐱', '🐶', '🐼', '🐨', '🦊', '🐰', '🐸', '🐵', '🦁', '🐯', '🐧', '🐢', '🐬', '🦋', '🐝', '🐞', '🦉', '🐙', '🦖', '🐹', '🐻', '🦩', '🐳'];
const ordinal = (n) => window.QI18N.ORD[LANG](n);

// The server sends "ms remaining"; turn it into a local end time so clocks never need to agree.
let phaseEndAt = 0, phaseTotal = 1;
function syncTimer(state, totalMs) {
  phaseEndAt = performance.now() + (state.remainingMs || 0);
  phaseTotal = totalMs;
}
function timeLeft() { return Math.max(0, phaseEndAt - performance.now()); }
function runTimerBar(bar, onTick) {
  cancelAnimationFrame(runTimerBar.raf);
  const step = () => {
    const left = timeLeft();
    if (bar) {
      bar.querySelector('i').style.transform = `scaleX(${Math.min(1, left / phaseTotal)})`;
      bar.classList.toggle('low', left < 4000);
    }
    if (onTick) onTick(left);
    if (left > 0) runTimerBar.raf = requestAnimationFrame(step);
  };
  step();
}

function confetti(n = 60) {
  const bits = ['⭐', '🌟', '✨', '💖', '🎉', '🍓', '🫐', '🍋', '🥝'];
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
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

let actx, soundOn = true;
function beep(notes = [660, 880], dur = 0.09, type = 'triangle') {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f;
      const t = actx.currentTime + i * dur;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.8);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur * 2);
    });
  } catch (e) { /* sound is optional */ }
}

function askConfirm(text, yesLabel, onYes) {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.innerHTML = `<div class="panel center" style="max-width:440px;display:flex;flex-direction:column;gap:14px">
    <div style="font-size:1.25rem;font-weight:600">${esc(text)}</div>
    <div class="row" style="justify-content:center"><button class="btn-soft big" data-no>${esc(t('cancel'))}</button><button class="btn-pink big" data-yes>${esc(yesLabel)}</button></div></div>`;
  el.onclick = (e) => {
    if (e.target === el || e.target.closest('[data-no]')) el.remove();
    else if (e.target.closest('[data-yes]')) { el.remove(); onYes(); }
  };
  document.body.appendChild(el);
}
