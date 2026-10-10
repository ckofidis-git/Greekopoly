// UNO: pages under /uno, sockets on the /uno namespace.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Uno } = require('./uno');

module.exports = function mountUno(app, io) {
  const nsp = io.of('/uno');
  app.get('/uno', (req, res, next) => (req.originalUrl.split('?')[0] === '/uno' ? res.redirect('/uno/') : next()));
  app.use('/uno', express.static(path.join(__dirname, 'public')));
  app.get('/uno/play', (req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));

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
      const game = new Uno(code, () => broadcast(code));
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
      else if (type === 'end') err = q.endNow();
      else if (type === 'next') err = q.nextRound();
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

    // Every player action: play, draw, keep, respond (Wild Draw Four), uno, catch
    socket.on('act', ({ type, card, color, challenge } = {}, cb) => {
      const { code, playerId } = socket.data;
      const g = games.get(code);
      if (!g || !playerId) return reply(cb, { error: 'err.rejoin' });
      const u = g.game;
      const err = type === 'play' ? u.play(playerId, card, color)
        : type === 'draw' ? u.draw(playerId)
        : type === 'keep' ? u.keep(playerId)
        : type === 'respond' ? u.respond(playerId, !!challenge)
        : type === 'uno' ? u.sayUno(playerId)
        : type === 'catch' ? u.catchUno(playerId)
        : 'err.notNow';
      reply(cb, { error: err || null });
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
