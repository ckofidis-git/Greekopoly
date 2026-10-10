// Treasure Island: pages under /island, sockets on the /island namespace.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Island } = require('./island');

module.exports = function mountIsland(app, io) {
  const nsp = io.of('/island');
  app.get('/island', (req, res, next) => (req.originalUrl.split('?')[0] === '/island' ? res.redirect('/island/') : next()));
  app.use('/island', express.static(path.join(__dirname, 'public')));
  app.get('/island/play', (req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));

  const games = new Map(); // code -> { game, hostKey, touched }
  const newCode = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let c;
    do c = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join('');
    while (games.has(c));
    return c;
  };
  const id = () => crypto.randomBytes(8).toString('hex');

  // Everyone gets the shared view; each phone also gets its own score and answers.
  function broadcast(code) {
    const g = games.get(code);
    if (!g) return;
    g.touched = Date.now();
    for (const sid of nsp.adapter.rooms.get(code) || []) {
      const s = nsp.sockets.get(sid);
      if (s) s.emit('state', g.game.view(s.data.playerId || null));
    }
  }

  setInterval(() => {
    const cutoff = Date.now() - 12 * 3600 * 1000;
    for (const [code, g] of games) if (g.touched < cutoff) { g.game.dispose(); games.delete(code); }
  }, 3600 * 1000).unref();

  nsp.on('connection', (socket) => {
    socket.data = {};
    const reply = (cb, data) => typeof cb === 'function' && cb(data);

    socket.on('host:create', ({ lang } = {}, cb) => {
      const code = newCode();
      const hostKey = id();
      const game = new Island(code, () => broadcast(code));
      game.setSettings({ lang });
      games.set(code, { game, hostKey, touched: Date.now() });
      socket.join(code);
      socket.data = { code, host: true };
      reply(cb, { code, hostKey, state: game.view() });
    });

    socket.on('host:resume', ({ code, hostKey } = {}, cb) => {
      const g = games.get(String(code || '').toUpperCase());
      if (!g || g.hostKey !== hostKey) return reply(cb, { error: 'err.nogame' });
      socket.join(g.game.code);
      socket.data = { code: g.game.code, host: true };
      reply(cb, { code: g.game.code, state: g.game.view() });
    });

    socket.on('host:do', ({ type, settings, playerId } = {}, cb) => {
      const { code, host } = socket.data;
      const g = games.get(code);
      if (!host || !g) return reply(cb, { error: 'err.nothost' });
      const q = g.game;
      let err = null;
      if (type === 'settings') err = q.setSettings(settings);
      else if (type === 'start') err = q.setSettings(settings) || q.start();
      else if (type === 'end') err = q.finish();
      else if (type === 'lobby') q.backToLobby();
      else if (type === 'kick') q.removePlayer(playerId);
      reply(cb, { error: err });
      broadcast(code);
    });

    socket.on('player:join', ({ code, playerId, name, avatar } = {}, cb) => {
      code = String(code || '').toUpperCase().trim();
      const g = games.get(code);
      if (!g) return reply(cb, { error: 'err.nogame' });
      let p = playerId && g.game.P(playerId);
      if (!p) {
        if (!name) return reply(cb, { needJoin: true, lang: g.game.settings.lang });
        const newId = id();
        const err = g.game.join(newId, name, avatar);
        if (err) return reply(cb, { error: err, lang: g.game.settings.lang });
        p = g.game.P(newId);
      }
      p.connected = true;
      socket.join(code);
      socket.data = { code, playerId: p.id };
      reply(cb, { playerId: p.id });
      broadcast(code);
    });

    socket.on('answer', ({ value } = {}, cb) => {
      const { code, playerId } = socket.data;
      const g = games.get(code);
      if (!g || !playerId) return reply(cb, { error: 'err.rejoin' });
      const r = g.game.answer(playerId, value);
      reply(cb, { error: r.error || null });
      broadcast(code);
    });

    socket.on('claim', ({ idx } = {}, cb) => {
      const { code, playerId } = socket.data;
      const g = games.get(code);
      if (!g || !playerId) return reply(cb, { error: 'err.rejoin' });
      const err = g.game.claim(playerId, idx);
      reply(cb, { error: err });
      broadcast(code);
    });

    socket.on('disconnect', () => {
      const { code, playerId } = socket.data;
      const g = games.get(code);
      if (!g || !playerId) return;
      const stillHere = [...(nsp.adapter.rooms.get(code) || [])].some((sid) => nsp.sockets.get(sid)?.data?.playerId === playerId);
      const p = g.game.P(playerId);
      if (p && !stillHere) {
        p.connected = false;
          broadcast(code);
      }
    });
  });
};
