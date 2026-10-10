// Monopoly (Greekopoly / Worldopoly): pages under /monopoly, sockets on the /monopoly namespace.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Game } = require('./game');

module.exports = function mountMonopoly(app, io) {
  const nsp = io.of('/monopoly');
  app.get('/monopoly', (req, res, next) => (req.originalUrl.split('?')[0] === '/monopoly' ? res.redirect('/monopoly/') : next()));
  app.use('/monopoly', express.static(path.join(__dirname, 'public')));
  app.use('/monopoly/shared', express.static(path.join(__dirname, 'shared')));
  app.get('/monopoly/play', (req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));
  // Old links and QR codes from before the game hub
  app.get('/play', (req, res) => res.redirect('/monopoly/play' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));

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
    nsp.to(code).emit('state', g.game.view());
  }

  // Forget games nobody has touched for 12 hours.
  setInterval(() => {
    const cutoff = Date.now() - 12 * 3600 * 1000;
    for (const [code, g] of games) if (g.touched < cutoff) games.delete(code);
  }, 3600 * 1000).unref();

  nsp.on('connection', (socket) => {
    const reply = (cb, data) => typeof cb === 'function' && cb(data);

    socket.on('admin:create', ({ lang } = {}, cb) => {
      const code = newCode();
      const adminKey = id();
      const game = new Game(code);
      game.setLang(lang);
      games.set(code, { game, adminKey, touched: Date.now() });
      socket.join(code);
      socket.data = { code, admin: true };
      reply(cb, { code, adminKey, state: games.get(code).game.view() });
    });

    socket.on('admin:resume', ({ code, adminKey } = {}, cb) => {
      const g = games.get(String(code || '').toUpperCase());
      if (!g || g.adminKey !== adminKey) return reply(cb, { error: 'err.nogame' });
      socket.join(g.game.code);
      socket.data = { code: g.game.code, admin: true };
      reply(cb, { code: g.game.code, state: g.game.view() });
    });

    socket.on('admin:do', ({ type, settings, playerId } = {}, cb) => {
      const { code, admin } = socket.data || {};
      const g = games.get(code);
      if (!admin || !g) return reply(cb, { error: 'err.nothost' });
      let err = null;
      if (type === 'start') err = g.game.start(settings);
      else if (type === 'kick') err = g.game.removePlayer(playerId);
      else if (type === 'endAuction') g.game.checkAuctionEnd(true);
      else if (type === 'endGame') g.game.finishGame();
      else if (type === 'settings') {
        g.game.settings.jackpot = !!(settings && settings.jackpot);
        if (settings && settings.theme) g.game.setTheme(settings.theme);
        if (settings && settings.lang) g.game.setLang(settings.lang);
      } else if (type === 'reset') {
        // Back to the lobby with the same players still joined (same code, phones stay connected).
        const old = g.game;
        const fresh = new Game(code);
        fresh.settings.jackpot = old.settings.jackpot;
        fresh.setLang(old.settings.lang);
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
      if (!g) return reply(cb, { error: 'err.nogame' });
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
      reply(cb, g ? { state: g.game.view() } : { error: 'err.nogame' });
    });

    socket.on('act', (action = {}, cb) => {
      const { code, playerId } = socket.data || {};
      const g = games.get(code);
      if (!g || !playerId) return reply(cb, { error: 'err.rejoin' });
      let err;
      try {
        err = g.game.act(playerId, action);
      } catch (e) {
        console.error(e);
        err = 'err.oops';
      }
      reply(cb, { error: err || null });
      broadcast(code);
    });

    socket.on('disconnect', () => {
      const { code, playerId } = socket.data || {};
      const g = games.get(code);
      if (!g || !playerId) return;
      const stillHere = [...(nsp.adapter.rooms.get(code) || [])]
        .some((sid) => nsp.sockets.get(sid)?.data?.playerId === playerId);
      const p = g.game.P(playerId);
      if (p && !stillHere) { p.connected = false; broadcast(code); }
    });
  });
};
