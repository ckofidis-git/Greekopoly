// Maths Superstars quiz show: pages under /quiz, sockets on the /quiz namespace.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Quiz } = require('./quiz');

module.exports = function mountQuiz(app, io) {
  const nsp = io.of('/quiz');
  app.get('/quiz', (req, res, next) => (req.originalUrl.split('?')[0] === '/quiz' ? res.redirect('/quiz/') : next()));
  app.use('/quiz', express.static(path.join(__dirname, 'public')));
  app.get('/quiz/play', (req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));

  const games = new Map(); // code -> { quiz, hostKey, touched }
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
      if (s) s.emit('state', g.quiz.view(s.data.playerId || null));
    }
  }

  setInterval(() => {
    const cutoff = Date.now() - 12 * 3600 * 1000;
    for (const [code, g] of games) if (g.touched < cutoff) { g.quiz.dispose(); games.delete(code); }
  }, 3600 * 1000).unref();

  nsp.on('connection', (socket) => {
    socket.data = {};
    const reply = (cb, data) => typeof cb === 'function' && cb(data);

    socket.on('host:create', (_, cb) => {
      const code = newCode();
      const hostKey = id();
      const quiz = new Quiz(code, () => broadcast(code));
      games.set(code, { quiz, hostKey, touched: Date.now() });
      socket.join(code);
      socket.data = { code, host: true };
      reply(cb, { code, hostKey, state: quiz.view() });
    });

    socket.on('host:resume', ({ code, hostKey } = {}, cb) => {
      const g = games.get(String(code || '').toUpperCase());
      if (!g || g.hostKey !== hostKey) return reply(cb, { error: 'Game not found' });
      socket.join(g.quiz.code);
      socket.data = { code: g.quiz.code, host: true };
      reply(cb, { code: g.quiz.code, state: g.quiz.view() });
    });

    socket.on('host:do', ({ type, settings, playerId } = {}, cb) => {
      const { code, host } = socket.data;
      const g = games.get(code);
      if (!host || !g) return reply(cb, { error: 'Not the host.' });
      const q = g.quiz;
      let err = null;
      if (type === 'settings') err = q.setSettings(settings);
      else if (type === 'start') err = q.setSettings(settings) || q.start();
      else if (type === 'skip') err = q.skip();
      else if (type === 'end') err = q.endNow();
      else if (type === 'lobby') q.backToLobby();
      else if (type === 'kick') q.removePlayer(playerId);
      reply(cb, { error: err });
      broadcast(code);
    });

    socket.on('player:join', ({ code, playerId, name, avatar } = {}, cb) => {
      code = String(code || '').toUpperCase().trim();
      const g = games.get(code);
      if (!g) return reply(cb, { error: 'No game with that code. Check the big screen!' });
      let p = playerId && g.quiz.P(playerId);
      if (!p) {
        if (!name) return reply(cb, { needJoin: true });
        const newId = id();
        const err = g.quiz.join(newId, name, avatar);
        if (err) return reply(cb, { error: err });
        p = g.quiz.P(newId);
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
      if (!g || !playerId) return reply(cb, { error: 'Please join again.' });
      const err = g.quiz.answer(playerId, value);
      reply(cb, { error: err });
      broadcast(code);
    });

    socket.on('disconnect', () => {
      const { code, playerId } = socket.data;
      const g = games.get(code);
      if (!g || !playerId) return;
      const stillHere = [...(nsp.adapter.rooms.get(code) || [])].some((sid) => nsp.sockets.get(sid)?.data?.playerId === playerId);
      const p = g.quiz.P(playerId);
      if (p && !stillHere) {
        p.connected = false;
        g.quiz.maybeEndQuestion();
        broadcast(code);
      }
    });
  });
};
