const path = require('path');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { Game } = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.get('/play', (req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));
app.get('/healthz', (req, res) => res.send('ok'));
app.get('/qr.svg', async (req, res) => {
  const text = String(req.query.u || '').slice(0, 300);
  if (!text) return res.status(400).end();
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#3b2a7a', light: '#ffffff' } });
  res.type('image/svg+xml').send(svg);
});

const games = new Map(); // code -> { game, adminKey, touched }
const newCode = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do c = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join('');
  while (games.has(c));
  return c;
};
const id = () => crypto.randomBytes(8).toString('hex');

function broadcast(code) {
  const g = games.get(code);
  if (!g) return;
  g.touched = Date.now();
  io.to(code).emit('state', g.game.view());
}

// Forget games nobody has touched for 12 hours.
setInterval(() => {
  const cutoff = Date.now() - 12 * 3600 * 1000;
  for (const [code, g] of games) if (g.touched < cutoff) games.delete(code);
}, 3600 * 1000).unref();

io.on('connection', (socket) => {
  const reply = (cb, data) => typeof cb === 'function' && cb(data);

  socket.on('admin:create', (_, cb) => {
    const code = newCode();
    const adminKey = id();
    games.set(code, { game: new Game(code), adminKey, touched: Date.now() });
    socket.join(code);
    socket.data = { code, admin: true };
    reply(cb, { code, adminKey, state: games.get(code).game.view() });
  });

  socket.on('admin:resume', ({ code, adminKey } = {}, cb) => {
    const g = games.get(String(code || '').toUpperCase());
    if (!g || g.adminKey !== adminKey) return reply(cb, { error: 'Game not found' });
    socket.join(g.game.code);
    socket.data = { code: g.game.code, admin: true };
    reply(cb, { code: g.game.code, state: g.game.view() });
  });

  socket.on('admin:do', ({ type, settings, playerId } = {}, cb) => {
    const { code, admin } = socket.data || {};
    const g = games.get(code);
    if (!admin || !g) return reply(cb, { error: 'Not the host.' });
    let err = null;
    if (type === 'start') err = g.game.start(settings);
    else if (type === 'kick') err = g.game.removePlayer(playerId);
    else if (type === 'endAuction') g.game.checkAuctionEnd(true);
    else if (type === 'endGame') g.game.finishGame();
    else if (type === 'settings') {
      g.game.settings.jackpot = !!(settings && settings.jackpot);
      if (settings && settings.theme) g.game.setTheme(settings.theme);
    } else if (type === 'reset') {
      // Back to the lobby with the same players still joined (same code, phones stay connected).
      const old = g.game;
      const fresh = new Game(code);
      fresh.settings.jackpot = old.settings.jackpot;
      fresh.setTheme(old.settings.theme);
      for (const p of old.players) {
        fresh.join(p.id, p.name, p.token);
        fresh.P(p.id).connected = p.connected;
      }
      g.game = fresh;
    }
    reply(cb, { error: err });
    broadcast(code);
  });

  socket.on('player:join', ({ code, playerId, name, token } = {}, cb) => {
    code = String(code || '').toUpperCase().trim();
    const g = games.get(code);
    if (!g) return reply(cb, { error: 'No game with that code. Check the big screen!' });
    let p = playerId && g.game.P(playerId);
    if (!p) {
      if (!name) return reply(cb, { needJoin: true, state: g.game.view() });
      const newId = id();
      const err = g.game.join(newId, name, token);
      if (err) return reply(cb, { error: err, state: g.game.view() });
      p = g.game.P(newId);
    }
    p.connected = true;
    socket.join(code);
    socket.data = { code, playerId: p.id };
    reply(cb, { playerId: p.id, state: g.game.view() });
    broadcast(code);
  });

  socket.on('peek', ({ code } = {}, cb) => {
    const g = games.get(String(code || '').toUpperCase());
    reply(cb, g ? { state: g.game.view() } : { error: 'No game with that code.' });
  });

  socket.on('act', (action = {}, cb) => {
    const { code, playerId } = socket.data || {};
    const g = games.get(code);
    if (!g || !playerId) return reply(cb, { error: 'Please join the game again.' });
    let err;
    try {
      err = g.game.act(playerId, action);
    } catch (e) {
      console.error(e);
      err = 'Oops, something went wrong.';
    }
    reply(cb, { error: err || null });
    broadcast(code);
  });

  socket.on('disconnect', () => {
    const { code, playerId } = socket.data || {};
    const g = games.get(code);
    if (!g || !playerId) return;
    const stillHere = [...(io.sockets.adapter.rooms.get(code) || [])]
      .some((sid) => io.sockets.sockets.get(sid)?.data?.playerId === playerId);
    const p = g.game.P(playerId);
    if (p && !stillHere) { p.connected = false; broadcast(code); }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Greekopoly running on http://localhost:${PORT}`));
