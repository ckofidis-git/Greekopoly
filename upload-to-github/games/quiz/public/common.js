// Helpers shared by the big screen and the phones.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n).toLocaleString('en-GB');
const FRUITS = ['🍓', '🫐', '🍋', '🥝'];
const AVATARS = ['🦄', '🐱', '🐶', '🐼', '🐨', '🦊', '🐰', '🐸', '🐵', '🦁', '🐯', '🐧', '🐢', '🐬', '🦋', '🐝', '🐞', '🦉', '🐙', '🦖', '🐹', '🐻', '🦩', '🐳'];
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

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
    <div class="row" style="justify-content:center"><button class="btn-soft big" data-no>Cancel</button><button class="btn-pink big" data-yes>${esc(yesLabel)}</button></div></div>`;
  el.onclick = (e) => {
    if (e.target === el || e.target.closest('[data-no]')) el.remove();
    else if (e.target.closest('[data-yes]')) { el.remove(); onYes(); }
  };
  document.body.appendChild(el);
}
