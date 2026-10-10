// Game hub: one website, many games. Each game mounts its own pages and socket namespace.
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/healthz', (req, res) => res.send('ok'));
app.get('/qr.svg', async (req, res) => {
  const text = String(req.query.u || '').slice(0, 300);
  if (!text) return res.status(400).end();
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#3b2a7a', light: '#ffffff' } });
  res.type('image/svg+xml').send(svg);
});

require('./games/monopoly/server')(app, io);
require('./games/quiz/server')(app, io);
require('./games/island/server')(app, io);

app.use(express.static(path.join(__dirname, 'public'))); // the game picker

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Game hub running on http://localhost:${PORT}`));
